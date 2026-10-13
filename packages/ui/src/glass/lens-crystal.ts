import { createCrystalMap, crystalAmplitude, crystalMargin } from "./crystal-map.js";

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

/** What the engine hands the crystal lens of one installed filter. */
export interface CrystalContext {
  element: HTMLElement;
  /** Id of the SVG filter, and the CSS that comes before it in `backdrop-filter`. */
  id: string;
  blur: string;
  /** The surface's own inline `backdrop-filter` before the engine touched it. */
  original: string;
  filter: SVGFilterElement;
  image: Element;
  /** The layer or the skin was removed from the surface: install again. */
  reinstall: () => void;
  /** The backdrop room around the surface changed: rebuild the map. */
  resize: () => void;
}

export interface CrystalLens {
  /** Lays the map out for a size; returns the filter scale, or `undefined` when nothing changed. */
  update(
    width: number,
    height: number,
    radius: number,
    refraction: number,
    dispersion: number,
    dpr: number,
  ): number | undefined;
  /** Removes the layer and the skin and gives the surface its own styles back. */
  undo(): void;
}

/**
 * The crystal lens samples the backdrop outside the surface (it minifies), which a filter on the
 * surface itself cannot see. So the filter goes on a layer that extends past the surface by the
 * largest offset, clipped back to the silhouette; the surface's own backdrop filter, background and
 * inset shadows move to (or under) that layer's siblings, because the layer must be the lowest
 * thing in the surface. Its own lazy chunk: the engine imports it only for a crystal surface.
 */
export function installCrystal({
  element,
  id,
  blur,
  original,
  filter,
  image,
  reinstall,
  resize,
}: CrystalContext): CrystalLens {
  const saved = {
    position: element.style.position,
    isolation: element.style.isolation,
    overflow: element.style.overflow,
    boxShadow: element.style.boxShadow,
    backgroundImage: element.style.backgroundImage,
    backgroundColor: element.style.backgroundColor,
    backdropFilter: original,
  };
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  element.style.isolation = "isolate";
  element.style.overflow = "visible";
  element.style.backgroundImage = "none";
  element.style.backgroundColor = "transparent";
  element.style.setProperty("--glass-lens-tint", "transparent");
  const border = element.matches(".liquid-clear")
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
  layer.style.backdropFilter = `${blur}url(#${id})`;
  layer.style.setProperty("-webkit-backdrop-filter", `${blur}url(#${id})`);
  const skin = make(
    "inset:0;border-radius:inherit;" +
      "background-image:var(--glass-noise),radial-gradient(circle at var(--liquid-glow-x,50%) var(--liquid-glow-y,50%),color-mix(in srgb,white calc(var(--liquid-glow,0)*15%),transparent),transparent 70%),linear-gradient(var(--liquid-tint-fill),var(--liquid-tint-fill)),linear-gradient(var(--liquid-veil-fill),var(--liquid-veil-fill));" +
      `box-shadow:var(--liquid-rim-auto,var(--liquid-rim-custom,var(--liquid-rim))),var(--liquid-depth),0 0 0 1px var(${border}),var(--liquid-shadow-custom,var(--liquid-shadow-auto,var(--liquid-shadow)));`,
  );
  skin.dataset.glassLensSkin = "";
  element.prepend(skin);
  element.prepend(layer);
  const watch =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (!layer.isConnected || !skin.isConnected) reinstall();
        })
      : undefined;
  watch?.observe(element, { childList: true });

  // A surface that is moved towards the edge of a clipping ancestor (dragged, scrolled) loses
  // backdrop on that side: the layer's overlap with the nearest clip tells when to look again.
  let roomWatch: IntersectionObserver | undefined;
  let roomRoot: Element | undefined;
  const trackRoom = (clips: Element[]) => {
    const root = clips[0];
    if (root === roomRoot || typeof IntersectionObserver !== "function") return;
    roomWatch?.disconnect();
    roomRoot = root;
    if (!root) return;
    roomWatch = new IntersectionObserver(resize, {
      root,
      threshold: Array.from({ length: 51 }, (_, i) => i / 50),
    });
    roomWatch.observe(layer);
  };

  let key = "";
  return {
    update(width, height, radius, refraction, dispersion, dpr) {
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
        createCrystalMap({ width, height, amplitude, dpr, margin, room, reach }),
      );
      return (2 * Math.max(amplitude, 1) * 255) / 254;
    },
    undo() {
      watch?.disconnect();
      roomWatch?.disconnect();
      layer.remove();
      skin.remove();
      for (const [name, value] of Object.entries(saved)) {
        if (name === "backdropFilter") continue;
        element.style.setProperty(
          name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
          value,
        );
      }
    },
  };
}
