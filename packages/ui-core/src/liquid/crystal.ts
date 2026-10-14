import { clamp, type DisplacementField } from "./lens-map.js";
import { cached } from "./raster.js";

/**
 * The crystal map covers the surface and its margin (often several times the surface), and every
 * pixel of it is computed on the main thread: past this many it is rasterised coarser, down to half
 * a pixel per CSS pixel, which the smooth field and the bilinear `feImage` scaling do not show.
 */
const CRYSTAL_MAP_PIXELS = 48_000;

/**
 * The crystal lens: a thick, clear, convex lens that minifies the backdrop. Every output pixel at
 * `p` (measured from the centre of the surface) shows the backdrop at `p + (g(t) - 1) p` with `g(t)
 * = 1 + (gMax - 1) s(t)`, `s(t) = 0.3 + 0.3 t^2 + 0.4 t^6` and `t` the superellipse radial coordinate (1 at
 * the silhouette). The pull is mild in the middle and grows steeply towards the rim, like the
 * side of a ball lens. A radial map `p -> p g(|p|)` with `g >= 1` and `g' >= 0` has the Jacobian
 * determinant `g (g + t g')`, which is at least 1, so it cannot fold back on itself however large
 * `gMax` is: this is what lets the crystal minify by a factor of three at the rim where the other
 * profiles must stay under a slope of one.
 *
 * The samples lie outside the surface (a minifying lens sees a wider area than it covers), so the
 * map is rasterised over the surface plus a margin on every side; the engine lays the filter on a
 * layer that large and clips it back to the silhouette.
 */
export const CRYSTAL_EXPONENT = 2.5;
/** Weights of the constant (even minification), quadratic (whole-surface) and sixth-power (rim) parts of the crystal lens. */
export const CRYSTAL_WEIGHTS = { flat: 0.3, whole: 0.3, rim: 0.4 } as const;
/** `gMax - 1` per unit of `refraction`: how much more the rim minifies than the middle. */
export const CRYSTAL_GAIN = 1.3;
/** Largest source offset of the crystal lens, in px (bounds the margin and the filter area). */
export const CRYSTAL_MAX_OFFSET = 260;

/** `s(t)` of the crystal lens. */
export const crystalShape = (t: number) =>
  CRYSTAL_WEIGHTS.flat + CRYSTAL_WEIGHTS.whole * t ** 2 + CRYSTAL_WEIGHTS.rim * t ** 6;

/** Radial coordinate of a point of a surface: 1 on the superellipse touching the middle of each side, held there beyond it. */
export function crystalRadius(px: number, py: number, hx: number, hy: number): number {
  const u = Math.abs(px) / hx;
  const v = Math.abs(py) / hy;
  return Math.min((u ** CRYSTAL_EXPONENT + v ** CRYSTAL_EXPONENT) ** (1 / CRYSTAL_EXPONENT), 1);
}

/**
 * Largest source offset of the crystal lens, in px, for a surface and a `refraction` of 0 to 2
 * (1.67 is a thick lens, 2 the thickest the margin allows).
 */
export function crystalAmplitude(width: number, height: number, refraction: number): number {
  const half = Math.max(width, height) / 2;
  return Math.min(clamp(refraction, 0, 2) * CRYSTAL_GAIN * half, CRYSTAL_MAX_OFFSET);
}

/** Distance, in px, the crystal lens keeps from the edge of its backdrop (see {@link computeCrystalField}). */
const EDGE_SLACK = 3;

export interface CrystalMapOptions {
  width: number;
  height: number;
  /** Source offset at the silhouette, in px, from {@link crystalAmplitude}; sets the margin. */
  amplitude: number;
  /**
   * Map pixels per CSS pixel. Default 1, between 0.5 and 2: the field is smooth and most of it lies
   * in the margin the layer clips away, so a large lens can go below one.
   */
  dpr?: number;
  /** Margin past the surface, in px. Default {@link crystalMargin} of `amplitude`. */
  margin?: number;
  /**
   * Margin past each side of the surface, in px (default: `margin` on all four). A surface inside
   * a clipping ancestor (an `overflow` or `clip-path` stage) only has the backdrop within it: a
   * layer that reaches past the clip is cut by the browser and its filter is shifted, so the map
   * covers only the backdrop that exists, and the offsets are clamped so no sample lands beyond it.
   */
  room?: Partial<Record<"left" | "right" | "top" | "bottom", number>>;
  /** Largest factor the offset is multiplied by (chromatic dispersion pulls red this much further). Default 1. */
  reach?: number;
}

/**
 * Margin, in px, the crystal layer extends past the surface on every side: the largest offset,
 * plus what chromatic dispersion adds to it.
 */
export const crystalMargin = (amplitude: number, dispersion = 0) =>
  Math.ceil(amplitude * (1 + Math.max(dispersion, 0))) + 2;

/**
 * Displacement field of the crystal lens over the surface and its margin: red and green carry
 * `s(t) p / half` (so `scale = 2 amplitude 255/254` restores the offset), blue is 255 (no soft
 * band: a crystal is not frosted). The size of `data` is the surface plus twice the margin.
 */
export function computeCrystalField({
  width,
  height,
  amplitude,
  dpr = 1,
  margin,
  room,
  reach = 1,
}: CrystalMapOptions): DisplacementField {
  const ratio = clamp(dpr, 0.5, 2);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const m = margin ?? crystalMargin(amplitude);
  const free = (side: "left" | "right" | "top" | "bottom") => Math.max(room?.[side] ?? m, 0);
  const [left, right, top, bottom] = [free("left"), free("right"), free("top"), free("bottom")];
  const pw = Math.max(1, Math.round((w + left + right) * ratio));
  const ph = Math.max(1, Math.round((h + top + bottom) * ratio));
  const data = new Uint8ClampedArray(pw * ph * 4);
  const hx = w / 2;
  const hy = h / 2;
  const half = Math.max(hx, hy);
  // A few px short of the edge: the pre-blur fades the last columns of the backdrop to transparent,
  // and a channel pulled further than the others (dispersion) would read that and drop out.
  // Without `room` the map keeps the plain lens: its margin is the whole reach, nothing to clamp.
  const slack = room ? EDGE_SLACK : 0;
  const bounded = room !== undefined;
  const [minX, maxX] = [-hx - left + slack, hx + right - slack];
  const [minY, maxY] = [-hy - top + slack, hy + bottom - slack];
  const unit = Math.max(amplitude, 1e-6);
  const f = Math.max(reach, 1);
  // Offset (as a fraction of `amplitude`, what the channel encodes) that keeps the source in the room.
  const within = (p: number, offset: number, lo: number, hi: number) =>
    clamp((bounded ? clamp(offset, (lo - p) / f, (hi - p) / f) : offset) / unit, -1, 1);
  for (let j = 0; j < ph; j++) {
    const py = (j + 0.5) / ratio - top - hy;
    for (let i = 0; i < pw; i++) {
      const px = (i + 0.5) / ratio - left - hx;
      const s = crystalShape(crystalRadius(px, py, hx, hy));
      const o = (j * pw + i) * 4;
      data[o] = 128 + within(px, (s * px * amplitude) / half, minX, maxX) * 127;
      data[o + 1] = 128 + within(py, (s * py * amplitude) / half, minY, maxY) * 127;
      data[o + 2] = 255;
      data[o + 3] = 255;
    }
  }
  return { width: pw, height: ph, data };
}

/** Crystal map as a PNG `data:` URI for `feImage` (browser only, cached). */
export function createCrystalMap(options: CrystalMapOptions): string {
  const key = [
    options.width,
    options.height,
    Math.round(options.amplitude),
    options.dpr ?? 1,
    options.margin ?? 0,
    options.reach ?? 1,
    options.room?.left ?? -1,
    options.room?.right ?? -1,
    options.room?.top ?? -1,
    options.room?.bottom ?? -1,
  ]
    .map((n) => Math.round(n * 100) / 100)
    .join("x");
  return cached(`c${key}`, () => computeCrystalField(options));
}

/** Ancestors that cut the backdrop: whatever lies past their edge is not there for a backdrop filter. */
function clippingAncestors(element: Element): Element[] {
  const found: Element[] = [];
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const clips =
      style.clipPath !== "none" ||
      [style.overflowX, style.overflowY].some((value) => value !== "visible") ||
      /paint|strict|content/.test(style.contain);
    if (clips) found.push(node);
  }
  return found;
}

/**
 * How much backdrop lies past each side of `element`, in px, up to `margin` and rounded down to
 * `step` (so a surface dragged along an edge does not rebuild its map on every pixel).
 */
function backdropRoom(element: Element, clips: Element[], margin: number, step = 12) {
  const box = element.getBoundingClientRect();
  const room = { left: margin, right: margin, top: margin, bottom: margin };
  for (const clip of clips) {
    const edge = clip.getBoundingClientRect();
    room.left = Math.min(room.left, box.left - edge.left);
    room.right = Math.min(room.right, edge.right - box.right);
    room.top = Math.min(room.top, box.top - edge.top);
    room.bottom = Math.min(room.bottom, edge.bottom - box.bottom);
  }
  for (const side of ["left", "right", "top", "bottom"] as const)
    room[side] = Math.min(margin, Math.max(0, Math.floor(room[side] / step) * step));
  return room;
}

export interface CrystalMountOptions {
  /** Id of the lens filter the layer references. */
  id: string;
  /** The backdrop filter functions other than the blur (`saturate(...)` and so on), with a trailing space. */
  blur: string;
  /** The author's inline `backdrop-filter`, kept aside by the engine. */
  original: string;
  /** Where the layer and the skin go (a shadow root for a shadow-DOM host). Default: the element. */
  root?: ParentNode;
  /** The layer or the skin was removed by someone else: reinstall. */
  onLost: () => void;
  /** The backdrop room changed (the surface moved along a clipping edge): update. */
  onRoom: () => void;
}

export interface CrystalUpdate {
  width: number;
  height: number;
  radius: number;
  refraction: number;
  dispersion: number;
  dpr: number;
  filter: SVGElement;
  image: SVGElement;
}

export interface CrystalMount {
  /**
   * Places the layer and the map for the current size and returns the filter `scale`, or
   * `undefined` when nothing changed since the last call.
   */
  update(state: CrystalUpdate): number | undefined;
  undo(): void;
}

/**
 * The crystal lens samples the backdrop outside the surface (it minifies), which a filter on the
 * surface itself cannot see. So the filter goes on a layer that extends past the surface by the
 * largest offset, clipped back to the silhouette; the surface's own backdrop filter, background
 * and shadows move to a skin above that layer, because the layer must be the lowest thing in it.
 */
export function mountCrystal(element: HTMLElement, options: CrystalMountOptions): CrystalMount {
  const saved = {
    position: element.style.position,
    isolation: element.style.isolation,
    overflow: element.style.overflow,
    boxShadow: element.style.boxShadow,
    backgroundImage: element.style.backgroundImage,
    backgroundColor: element.style.backgroundColor,
  };
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  element.style.isolation = "isolate";
  element.style.overflow = "visible";
  element.style.backgroundImage = "none";
  element.style.backgroundColor = "transparent";
  element.style.setProperty("--glass-lens-tint", "transparent");
  const border = element.matches('.liquid-clear, [data-ui-liquid="clear"]')
    ? "--glass-clear-border"
    : "--glass-regular-border";
  // Nothing the surface paints may sit under the layer: the lens would minify its own ring and
  // drop shadow into view. They all move to the skin, which paints above the layer.
  element.style.boxShadow = "none";
  const make = (css: string) => {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.style.cssText = `position:absolute;z-index:-1;pointer-events:none;${css}`;
    return span;
  };
  const layer = make("border-radius:0;");
  layer.dataset.glassLensLayer = "";
  layer.style.backdropFilter = `${options.blur}url(#${options.id})`;
  layer.style.setProperty("-webkit-backdrop-filter", `${options.blur}url(#${options.id})`);
  const skin = make(
    "inset:0;border-radius:inherit;" +
      "background-image:var(--glass-noise),radial-gradient(circle at var(--liquid-glow-x,50%) var(--liquid-glow-y,50%),color-mix(in srgb,white calc(var(--liquid-glow,0)*15%),transparent),transparent 70%),linear-gradient(var(--liquid-tint-fill),var(--liquid-tint-fill)),linear-gradient(var(--liquid-veil-fill),var(--liquid-veil-fill));" +
      `box-shadow:var(--liquid-rim-auto,var(--liquid-rim-custom,var(--liquid-rim))),var(--liquid-depth),0 0 0 1px var(${border}),var(--liquid-shadow-custom,var(--liquid-shadow-auto,var(--liquid-shadow)));`,
  );
  skin.dataset.glassLensSkin = "";
  const root = options.root ?? element;
  root.prepend(skin);
  root.prepend(layer);
  const watch =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (!layer.isConnected || !skin.isConnected) options.onLost();
        })
      : undefined;
  watch?.observe(root, { childList: true });

  // A surface that is moved towards the edge of a clipping ancestor (dragged, scrolled) loses
  // backdrop on that side: the layer's overlap with the nearest clip tells when to look again.
  let roomWatch: IntersectionObserver | undefined;
  let roomRoot: Element | undefined;
  const trackRoom = (clips: Element[]) => {
    const clip = clips[0];
    if (clip === roomRoot || typeof IntersectionObserver !== "function") return;
    roomWatch?.disconnect();
    roomRoot = clip;
    if (!clip) return;
    roomWatch = new IntersectionObserver(options.onRoom, {
      root: clip,
      threshold: Array.from({ length: 51 }, (_, i) => i / 50),
    });
    roomWatch.observe(layer);
  };

  let key = "";
  return {
    update({ width, height, radius, refraction, dispersion, dpr, filter, image }) {
      const amplitude = crystalAmplitude(width, height, refraction);
      const margin = crystalMargin(amplitude, dispersion * 0.6);
      const round = Math.min(radius, width / 2, height / 2);
      const clips = clippingAncestors(element);
      const room = backdropRoom(element, clips, margin);
      const reach = 1 + dispersion * 0.6;
      const wide = width + room.left + room.right;
      const tall = height + room.top + room.bottom;
      trackRoom(clips);
      const next = [
        "c",
        width,
        height,
        round,
        amplitude,
        margin,
        dpr,
        room.left,
        room.right,
        room.top,
        room.bottom,
      ].join("x");
      if (next === key) return undefined;
      key = next;
      const box = getComputedStyle(element);
      const left = -(room.left + (Number.parseFloat(box.borderLeftWidth) || 0));
      const top = -(room.top + (Number.parseFloat(box.borderTopWidth) || 0));
      layer.style.left = `${left}px`;
      layer.style.top = `${top}px`;
      layer.style.width = `${wide}px`;
      layer.style.height = `${tall}px`;
      layer.style.clipPath = `inset(${room.top}px ${room.right}px ${room.bottom}px ${room.left}px round ${round}px)`;
      for (const [target, name, value] of [
        [filter, "x", "0"],
        [filter, "y", "0"],
        [filter, "width", String(wide)],
        [filter, "height", String(tall)],
        [image, "width", String(wide)],
        [image, "height", String(tall)],
      ] as const)
        target.setAttribute(name, value);
      image.setAttribute(
        "href",
        createCrystalMap({
          width,
          height,
          amplitude,
          dpr: Math.max(0.5, Math.min(dpr, Math.sqrt(CRYSTAL_MAP_PIXELS / (wide * tall)))),
          margin,
          room,
          reach,
        }),
      );
      return (2 * Math.max(amplitude, 1) * 255) / 254;
    },
    undo() {
      watch?.disconnect();
      roomWatch?.disconnect();
      layer.remove();
      skin.remove();
      for (const [name, value] of Object.entries(saved))
        element.style.setProperty(
          name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
          value,
        );
    },
  };
}
