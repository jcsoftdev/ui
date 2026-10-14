/**
 * The refraction core of Liquid Glass: an SVG displacement filter applied as a backdrop filter
 * (`rim`, `full`, `dome` lenses, the frosted middle and the adaptive veil). The optional features
 * (specular rim light, chromatic dispersion, the crystal lens, motion) are separate modules handed
 * in through `features`; one that is wanted but missing is requested through `load` and the lens
 * is rebuilt once it arrives. The maths and the filter graph are the React kit's.
 */
import type * as CrystalFeature from "./crystal.js";
import type * as DispersionFeature from "./dispersion.js";
import {
  bezelFor,
  createDisplacementMap,
  FULL_CAP,
  isWhole,
  type LensCoverage,
  scaleFor,
  VEIL_FLOOR,
} from "./lens-map.js";
import type * as MotionFeature from "./motion.js";
import { LIQUID_DEFAULTS, liquidShadow } from "./options.js";
import type * as SpecularFeature from "./specular.js";
import { supportsBackdropRefraction } from "./support.js";

/** The optional feature modules of the engine. */
export interface LiquidFeatures {
  specular?: typeof SpecularFeature;
  dispersion?: typeof DispersionFeature;
  crystal?: typeof CrystalFeature;
  motion?: typeof MotionFeature;
}
export type LiquidFeatureName = keyof LiquidFeatures;

const SVG_NS = "http://www.w3.org/2000/svg";
const HOST_ID = "ui-liquid-defs";

export interface LensOptions {
  /**
   * `scale` of the displacement filter (the source offset at the edge is half of it). Default:
   * `scaleFor()`, the strongest bend that cannot fold back on itself. Above that, stripes
   * behind the glass break into a sawtooth.
   */
  scale?: number;
  /**
   * Width of the refracting bevel in px; the middle of the surface shows the backdrop
   * undisplaced. Default: 1.2 times the corner radius, between 14 and 56 px and at most 45% of
   * the short side (so a small pill keeps a clear middle).
   */
  bezel?: number;
  /**
   * `"full"` (default): the lens bends the backdrop over the whole surface, strongest at the rim
   * and gentle but never zero towards the centre, with at most 24 px of offset. `"dome"`: the
   * same with round contours. `"rim"`: only the bevel, the middle shows the backdrop undisplaced.
   * CSS: `--liquid-profile` (older name: `--glass-lens-coverage`). The other `--liquid-*`
   * variables (see `LiquidGlassOptions`) are read live: change them and the lens follows.
   */
  coverage?: LensCoverage;
  /**
   * Chromatic dispersion: how far apart the red and blue channels are pulled, as a fraction of
   * `scale`. It runs three displacement passes instead of one (about +50% to +100% of the lens
   * cost), so it is off by default (it also paints a colour fringe on hard edges). Pass a number,
   * or set `--glass-lens-dispersion` in CSS, to turn it on; it only applies on surfaces up to
   * 100,000 px squared.
   */
  dispersion?: number;
  /**
   * Move the legibility veil of a liquid surface into the filter, where it is adaptive (only as
   * strong as the backdrop needs, so the body stays clear over friendly backdrops) and eases off
   * across the rim. Default true; `false` keeps the uniform CSS veil.
   */
  veil?: boolean;
  /**
   * Directional rim light inside the filter: a glint on the walls facing the upper left (and a
   * weaker one opposite) that is the lensed backdrop pushed to a high saturation, a dark contour
   * and a faint inner shadow. Default true.
   */
  specular?: boolean;
  /**
   * Motion: the lens materialises when it is first applied (the refraction springs up from
   * nothing), a press deepens it and swells the surface, and `--liquid-interactive: drag` lets the
   * surface be pulled and squashed. Default true; `--liquid-motion: off` turns it off per surface.
   * Never runs under reduced motion, where the lens is not applied at all.
   */
  animate?: boolean;
  /**
   * Read the pointer mode (`--liquid-interactive`) only from the element itself (its inline
   * style, or the value of `data-glass-interactive`), not from a scope or theme above it. The
   * overlay components (dialog, popover, sidebar, drawer) set it, so a page-wide
   * `--liquid-interactive` never makes them pressable or draggable. Default false.
   */
  ownInteractive?: boolean;
  /**
   * Only refract while the surface resolves to a liquid material (the `--glass-lens` flag the
   * `liquid` utilities set). This is what the glass components use. Default false.
   */
  auto?: boolean;
  /**
   * `"auto"` (default) only refracts where {@link supportsBackdropRefraction} is true and the user
   * has not asked for less transparency, more contrast or less motion. `"force"` skips the
   * engine check (never the accessibility ones).
   */
  refraction?: "auto" | "force";
  /** The optional features available to this surface (filled in place by `load`). */
  features?: LiquidFeatures;
  /** Loads a feature the surface turned out to need into `features`. */
  load?: (name: LiquidFeatureName) => Promise<unknown>;
  /** Where the crystal layer goes (a shadow root for a shadow-DOM host). Default: the element. */
  layerRoot?: ParentNode;
}

/** Preferences that switch refraction off, live: it comes back when they are cleared. */
const OFF_QUERIES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
  "(prefers-reduced-motion: reduce)",
];
/** Changes that can alter the blur the glass utility resolves to. */
const REBUILD_QUERIES = ["(prefers-color-scheme: dark)"];
const REBUILD_ATTRIBUTES = ["data-theme", "data-style", "data-density", "data-radius"];

/** Surfaces above this area (CSS px squared) keep the plain liquid look: the filter costs per pixel. */
const MAX_AREA = 640_000;
/** Largest surface (CSS px squared) that gets chromatic dispersion by default. */
const DISPERSION_AREA = 100_000;
/** Lenses alive at once; further surfaces keep the plain liquid look until one is released. */
const MAX_ACTIVE = 8;

/**
 * The maps are smooth fields that `feImage` stretches to the surface, so past 1.5 device pixels per
 * CSS pixel they only cost more: the field is computed per pixel on the main thread. A large surface
 * gets fewer, down to one per CSS pixel, so its map stays near `MAP_PIXELS` whatever the screen.
 */
const MAX_MAP_RATIO = 1.5;
const MAP_PIXELS = 120_000;
function mapRatio(width: number, height: number, dpr = window.devicePixelRatio || 1): number {
  const room = Math.sqrt(MAP_PIXELS / Math.max(1, width * height));
  return Math.max(1, Math.min(dpr, MAX_MAP_RATIO, room));
}

/**
 * The specular map is not capped by area: only a thin rim of it is shaded, but the one-pixel
 * contour and the glint are drawn in it, and at one pixel per CSS pixel on a dense screen they
 * come out soft. It keeps the full ratio (up to {@link MAX_MAP_RATIO}) where the refraction map
 * above has dropped to 1.
 */
function specularRatio(dpr = window.devicePixelRatio || 1): number {
  return Math.max(1, Math.min(dpr, MAX_MAP_RATIO));
}

/** Minimum time between two rebuilds of the displacement map of one surface. */
const REBUILD_MS = 90;

let counter = 0;
let active = 0;
/** Surfaces that are eligible but found no free slot; the next one is woken when a slot frees. */
const waiting = new Set<() => void>();

/**
 * Size changes are coalesced into one pass per frame, whatever the number of surfaces. A pass that
 * has used its share of the frame leaves the rest for the next one, so the maps of several surfaces
 * built at once (at load, on a slow phone) are spread over frames instead of one long task. A single
 * task still runs whole: the budget is checked between tasks, not inside one.
 */
const dirty = new Set<() => void>();
let frame = 0;
const FRAME_BUDGET_MS = 12;
function flush() {
  frame = 0;
  const batch = [...dirty];
  const started = performance.now();
  let ran = 0;
  for (const task of batch) {
    if (ran > 0 && performance.now() - started > FRAME_BUDGET_MS) break;
    // A task cancelled by an earlier one in this pass (a lens undone) is no longer in the set.
    if (!dirty.delete(task)) continue;
    ran++;
    task();
  }
  // What is left keeps its place at the front, ahead of anything the tasks rescheduled (those are
  // re-added at the end), so a task that always overruns the budget cannot starve the others.
  if (dirty.size && !frame) frame = requestAnimationFrame(flush);
}
function schedule(run: () => void) {
  dirty.add(run);
  if (!frame) frame = requestAnimationFrame(flush);
}

const matches = (query: string) => typeof matchMedia === "function" && matchMedia(query).matches;
const userWantsLess = () => OFF_QUERIES.some(matches);

function host(): SVGSVGElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing as unknown as SVGSVGElement;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = HOST_ID;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  document.body.appendChild(svg);
  return svg;
}

/** The lens settings the engine reads from `--liquid-*` custom properties. */
interface LiquidRuntime {
  refraction: number;
  bevel: number | undefined;
  profile: LensCoverage | undefined;
  dispersion: number | undefined;
  specular: number;
  angle: number;
  opacity: number;
}

const PROFILES = new Set(["rim", "full", "dome", "crystal"]);

function readRuntime(element: HTMLElement): LiquidRuntime {
  const computed = getComputedStyle(element);
  const read = (name: string) => computed.getPropertyValue(name).trim();
  const number = (name: string) => {
    const value = Number.parseFloat(read(name));
    return Number.isFinite(value) ? value : undefined;
  };
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const profile = read("--liquid-profile") || read("--glass-lens-coverage");
  const dispersion = number("--liquid-dispersion") ?? number("--glass-lens-dispersion");
  return {
    refraction: clamp(number("--liquid-refraction") ?? LIQUID_DEFAULTS.refraction, 0, 2),
    bevel: number("--liquid-bevel"),
    profile: PROFILES.has(profile) ? (profile as LensCoverage) : undefined,
    dispersion: dispersion === undefined ? undefined : clamp(dispersion, 0, 0.2),
    specular: clamp(number("--liquid-specular") ?? LIQUID_DEFAULTS.specular.intensity, 0, 2),
    angle: number("--liquid-specular-angle") ?? LIQUID_DEFAULTS.specular.angle,
    opacity: clamp(number("--liquid-opacity") ?? LIQUID_DEFAULTS.opacity, 0, 1),
  };
}

/** Variables whose change must rebuild the filter (the rest is read when the map is rebuilt). */
const WATCHED_VARS = [
  "--liquid-refraction",
  "--liquid-bevel",
  "--liquid-profile",
  "--glass-lens-coverage",
  "--liquid-dispersion",
  "--glass-lens-dispersion",
  "--liquid-specular",
  "--liquid-specular-angle",
  "--liquid-opacity",
  "--liquid-radius",
  "--liquid-frost",
  "--liquid-saturation",
  "--liquid-brightness",
  "--liquid-motion",
  "--liquid-interactive",
];
/** What can change those variables on an element or an ancestor. */
const CONFIG_ATTRIBUTES = ["style", "class", "data-glass", "data-glass-lens"];
/** Inline properties the engine and its motion write on the surface itself every so often. */
const ENGINE_WRITES = new Set([
  "translate",
  "scale",
  "touch-action",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "--glass-veil",
  "--glass-lens-tint",
  "--liquid-size",
  "--liquid-shadow-auto",
  "position",
  "isolation",
  "overflow",
  "box-shadow",
  "background-image",
  "background-color",
  "--liquid-glow",
  "--liquid-glow-x",
  "--liquid-glow-y",
  "--liquid-rim-auto",
]);

/** A `style` attribute without the declarations the engine writes itself. */
function authorStyle(text: string | null): string {
  return (text ?? "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const name = declaration.slice(0, declaration.indexOf(":")).trim().toLowerCase();
      return declaration !== "" && !ENGINE_WRITES.has(name);
    })
    .join(";");
}

interface Controller {
  configure(options: LensOptions): void;
  stop(): void;
}

/** One controller per element, so applying twice never stacks a second `url()` filter. */
const controllers = new WeakMap<HTMLElement, Controller>();

function createController(element: HTMLElement, initial: LensOptions): Controller {
  let options = initial;
  let stopped = false;
  const requested = new Set<LiquidFeatureName>();
  /** The feature module, or `undefined` after asking for it (the lens is rebuilt when it lands). */
  const feature = <N extends LiquidFeatureName>(name: N): LiquidFeatures[N] => {
    const found = options.features?.[name];
    if (found || !options.load || requested.has(name)) return found;
    requested.add(name);
    options.load(name).then(
      () => !stopped && schedule(sync),
      () => {},
    );
    return undefined;
  };
  let installed:
    | { filter: SVGFilterElement; observer?: ResizeObserver; cancel: () => void }
    | undefined;
  /** Watches the size of an eligible surface that is too large for now, so it lenses once it shrinks. */
  let sizeWatch: ResizeObserver | undefined;
  /** The first install of a controller materialises; later ones (theme change) do not. */
  let intro = true;
  const original = element.style.backdropFilter;
  const originalPrefixed = element.style.getPropertyValue("-webkit-backdrop-filter");

  const flagged = () =>
    !options.auto ||
    (getComputedStyle(element).getPropertyValue("--glass-lens").trim() === "1" &&
      !element.closest('[data-glass-lens="off"]') &&
      getComputedStyle(element).backdropFilter !== "none");

  const eligible = () =>
    !userWantsLess() &&
    (options.refraction === "force" || supportsBackdropRefraction()) &&
    flagged();

  /** Hands a freed slot to the first surface that was waiting for one. */
  const wake = () => {
    const next = waiting.values().next().value;
    if (!next) return;
    waiting.delete(next);
    schedule(next);
  };

  /** The crystal lens lives on a layer that extends past the surface; this puts the surface back. */
  let crystalMount: CrystalFeature.CrystalMount | undefined;

  const uninstall = () => {
    if (!installed) return;
    active--;
    installed.observer?.disconnect();
    installed.cancel();
    installed.filter.remove();
    const defs = document.getElementById(HOST_ID);
    if (defs && !defs.querySelector("filter")) defs.remove();
    installed = undefined;
    element.style.backdropFilter = original;
    if (originalPrefixed) element.style.setProperty("-webkit-backdrop-filter", originalPrefixed);
    else element.style.removeProperty("-webkit-backdrop-filter");
    delete element.dataset.glassRefraction;
    crystalMount?.undo();
    crystalMount = undefined;
    element.style.removeProperty("--glass-veil");
    element.style.removeProperty("--glass-lens-tint");
    element.style.removeProperty("--liquid-size");
    element.style.removeProperty("--liquid-shadow-auto");
  };

  /** `full` (default) bends the whole surface, `dome` is the round variant, `rim` only the bevel. */
  const coverageFor = (): LensCoverage =>
    options.coverage ?? readRuntime(element).profile ?? "full";

  /** Dispersion is off unless asked for: `dispersion` option, or `--liquid-dispersion` in CSS. */
  const dispersionFor = (area: number) => {
    const asked = options.dispersion ?? readRuntime(element).dispersion ?? 0;
    return area <= DISPERSION_AREA && asked > 0 && feature("dispersion") ? asked : 0;
  };

  const install = () => {
    if (!element.isConnected) return;
    if (active >= MAX_ACTIVE) {
      waiting.add(sync);
      return;
    }
    if (element.offsetWidth * element.offsetHeight > MAX_AREA) {
      // Too large for the filter right now; stay on the plain liquid look and look again on resize.
      if (typeof ResizeObserver === "function") {
        sizeWatch = new ResizeObserver(() => schedule(sync));
        sizeWatch.observe(element);
      }
      return;
    }
    const crystal = coverageFor() === "crystal";
    const crystalModule = crystal ? feature("crystal") : undefined;
    // Without its module the crystal keeps the plain liquid look until the module lands.
    if (crystal && !crystalModule) return;
    const displacers: Array<{ node: Element; factor: number }> = [];
    let baseScale = options.scale ?? 0;
    let level = options.animate === false || !intro ? 1 : 0;
    intro = false;
    const applyScale = () => {
      for (const { node: target, factor } of displacers)
        target.setAttribute("scale", String(baseScale * factor * level));
    };
    const dispersion = dispersionFor(element.offsetWidth * element.offsetHeight);
    let specularImage: SVGElement | undefined;
    const id = `ui-liquid-lens-${++counter}`;
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const node = (name: string, attrs: Record<string, string>) => {
      const created = document.createElementNS(SVG_NS, name);
      for (const [key, value] of Object.entries(attrs)) created.setAttribute(key, value);
      filter.appendChild(created);
      return created;
    };
    const image = node("feImage", { result: "map", preserveAspectRatio: "none" });
    // A minifying lens shows several backdrop pixels per output pixel; without a touch of
    // pre-filtering they alias into sparkle (and into rainbow noise with dispersion).
    if (crystal)
      node("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "0.7", result: "pre" });
    const displace = (channel: string, factor: number) =>
      displacers.push({
        node: node("feDisplacementMap", {
          in: crystal ? "pre" : "SourceGraphic",
          in2: "map",
          scale: "0",
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: channel === "lens" ? "lens" : `d${channel}`,
        }),
        factor,
      });
    const disperse = dispersion > 0 ? feature("dispersion") : undefined;
    if (disperse) disperse.buildDispersion(node, displace, dispersion, crystal);
    else displace("lens", 1);
    // Frosted middle, sharp rim: the blue channel of the map says how soft the backdrop is. The
    // lens is blurred in here (not by the CSS blur, which would soften the rim too) and mixed
    // back with the sharp lens by that weight.
    const computed = getComputedStyle(element);
    const runtime = readRuntime(element);
    element.style.backdropFilter = original;
    const base = getComputedStyle(element).backdropFilter;
    const radius = /blur\(\s*([\d.]+)px\s*\)/.exec(base);
    const rest = !base || base === "none" ? "" : `${base.replace(/blur\([^)]*\)\s*/, "").trim()} `;
    const frosted = radius !== null && Number.parseFloat(radius[1] as string) > 0;
    if (frosted) {
      node("feColorMatrix", {
        in: "map",
        type: "matrix",
        values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0",
        result: "soft-weight",
      });
      node("feGaussianBlur", { in: "lens", stdDeviation: radius[1] as string, result: "soft" });
      node("feComposite", { in: "soft", in2: "soft-weight", operator: "in", result: "soft-part" });
      node("feComposite", {
        in: "lens",
        in2: "soft-weight",
        operator: "out",
        result: "sharp-part",
      });
      node("feComposite", {
        in: "soft-part",
        in2: "sharp-part",
        operator: "arithmetic",
        k1: "0",
        k2: "1",
        k3: "1",
        k4: "0",
        result: "mixed",
      });
    }
    // The veil: the CSS veil is switched off (--glass-veil) and the same colour is flooded over
    // the lens, a little lighter along the rim than under the text.
    const veilColor =
      options.veil === false ? "" : computed.getPropertyValue("--glass-lens-dim").trim();
    const layers = [frosted ? "mixed" : "lens"];
    const parts = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/.exec(
      veilColor,
    );
    if (parts) {
      // Adaptive veil: only as strong as the backdrop needs. The lens is blurred wide, its
      // luminance read, and a veil of the ink-contrasting colour is laid down where the backdrop
      // is close to the ink (a light veil over dark areas in the light theme, a dark one over
      // light areas in the dark theme). Over a backdrop that already contrasts with the text
      // there is none, so the body stays clear instead of milky.
      const [r, g, b] = [1, 2, 3].map((n) => Number(parts[n]) / 255) as [number, number, number];
      const alphaPart = parts[4];
      // The CSS value is tuned for the uniform veil of the fallback; the adaptive one needs less.
      const strength =
        0.85 *
        runtime.opacity *
        (alphaPart
          ? alphaPart.endsWith("%")
            ? Number.parseFloat(alphaPart) / 100
            : Number(alphaPart)
          : 1);
      const lightVeil = (r + g + b) / 3 > 0.5;
      const sign = lightVeil ? -1 : 1;
      const base = lightVeil ? strength : 0;
      if (strength > 0) {
        node("feGaussianBlur", { in: "lens", stdDeviation: "7", result: "regional" });
        node("feColorMatrix", {
          in: "regional",
          type: "matrix",
          values: [
            `0 0 0 0 ${r}`,
            `0 0 0 0 ${g}`,
            `0 0 0 0 ${b}`,
            `${sign * 0.2126 * strength} ${sign * 0.7152 * strength} ${sign * 0.0722 * strength} 0 ${base}`,
          ].join(" "),
          result: "adaptive",
        });
        node("feColorMatrix", {
          in: "map",
          type: "matrix",
          values: `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${1 - VEIL_FLOOR} 0 ${VEIL_FLOOR}`,
          result: "veil-weight",
        });
        node("feComposite", { in: "adaptive", in2: "veil-weight", operator: "in", result: "veil" });
        layers.push("veil");
      }
      element.style.setProperty("--glass-veil", "transparent");
      element.style.setProperty("--glass-lens-tint", "transparent");
    }
    // Directional rim light from a second map (the specular feature).
    const light =
      options.specular !== false && runtime.specular > 0 ? feature("specular") : undefined;
    if (light) {
      specularImage = light.buildSpecular(node, runtime.specular);
      layers.push(...light.SPECULAR_LAYERS);
    }
    if (layers.length > 1 || frosted) {
      const merge = node("feMerge", {});
      for (const input of layers) {
        const mergeNode = document.createElementNS(SVG_NS, "feMergeNode");
        mergeNode.setAttribute("in", input);
        merge.appendChild(mergeNode);
      }
    }
    host().appendChild(filter);

    const blur = rest;

    if (crystalModule)
      crystalMount = crystalModule.mountCrystal(element, {
        id,
        blur,
        original,
        root: options.layerRoot,
        onLost: () => schedule(sync),
        onRoom: () => schedule(update),
      });

    let key = "";
    let built = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (!element.isConnected) return stop();
      // Layout size, not the bounding box: an entrance transform must not rebuild the map.
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (!width || !height) return;
      // The budgets are checked on every size, not only at install: a surface that grows past
      // them (a dialog whose content arrives, an entrance that settles) drops the lens or its
      // dispersion, and one that shrinks back under gets it.
      if (width * height > MAX_AREA || dispersionFor(width * height) > 0 !== dispersion > 0)
        return sync();
      const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      const coverage = coverageFor();
      const settings = readRuntime(element);
      const whole = isWhole(coverage);
      const bezel =
        options.bezel ??
        (whole ? undefined : settings.bevel) ??
        bezelFor(radius, width, height, coverage);
      const cap = whole ? (settings.bevel ?? FULL_CAP) : FULL_CAP;
      const soft = bezelFor(radius, width, height, "rim");
      const dpr = mapRatio(width, height);
      // A bigger piece of glass is thicker: its shadow is deeper (see `liquidShadow`).
      element.style.setProperty(
        "--liquid-size",
        String(
          Math.round(Math.min(Math.max(Math.sqrt(width * height) / 240, 0.7), 1.5) * 100) / 100,
        ),
      );
      if (crystalMount) {
        const scale = crystalMount.update({
          width,
          height,
          radius,
          refraction: settings.refraction,
          dispersion,
          dpr,
          filter,
          image,
        });
        if (scale === undefined) return;
        built = performance.now();
        baseScale = scale;
        applyScale();
        return;
      }
      const next = [
        width,
        height,
        radius,
        bezel,
        coverage,
        cap,
        Math.min(settings.refraction, 1),
        dpr,
      ].join("x");
      if (next === key) return;
      key = next;
      built = performance.now();
      baseScale =
        options.scale ??
        scaleFor(width, height, bezel, coverage, cap) * Math.min(settings.refraction, 1);
      applyScale();
      for (const [target, name, value] of [
        [filter, "x", "0"],
        [filter, "y", "0"],
        [filter, "width", String(width)],
        [filter, "height", String(height)],
        [image, "width", String(width)],
        [image, "height", String(height)],
      ] as const)
        target.setAttribute(name, value);
      image.setAttribute(
        "href",
        createDisplacementMap({ width, height, radius, bezel, coverage, soft, cap, dpr }),
      );
      if (specularImage && light) {
        specularImage.setAttribute("width", String(width));
        specularImage.setAttribute("height", String(height));
        specularImage.setAttribute(
          "href",
          light.createSpecularMap({
            width,
            height,
            radius,
            dpr: specularRatio(),
            angle: runtime.angle,
          }),
        );
      }
    };
    update();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            // A removed element is released at once, whatever the throttle below says.
            if (!element.isConnected) return stop();
            // Rebuilding the map costs a few ms: while a surface is being resized, at most
            // about ten rebuilds a second, and the last size always lands.
            const wait = REBUILD_MS - (performance.now() - built);
            if (wait <= 0) return schedule(update);
            if (timer === undefined)
              timer = setTimeout(() => {
                timer = undefined;
                schedule(update);
              }, wait);
          })
        : undefined;
    observer?.observe(element);

    // Motion (see `./liquid-motion.js`): the lens materialises, a press deepens it, and the
    // pointer modes move the surface. It drives `level`, the multiplier of the filter scale.
    const wantsMotion =
      options.animate !== false &&
      getComputedStyle(element).getPropertyValue("--liquid-motion").trim() !== "off";
    const moving = wantsMotion ? feature("motion") : undefined;
    const motion = !moving
      ? undefined
      : moving.startLiquidMotion(
          element,
          {
            onLevel(next) {
              level = next;
              applyScale();
            },
          },
          { materialize: level < 1, ownInteractive: options.ownInteractive },
        );
    if (!motion) {
      // No motion (switched off, or not wanted): the lens is at full strength at once.
      level = 1;
      applyScale();
    }
    element.style.setProperty("--liquid-shadow-auto", liquidShadow());
    element.style.backdropFilter = crystal ? "none" : `${blur}url(#${id})`;
    element.style.setProperty("-webkit-backdrop-filter", crystal ? "none" : `${blur}url(#${id})`);
    element.dataset.glassRefraction = "on";
    installed = {
      filter,
      observer,
      cancel: () => {
        clearTimeout(timer);
        timer = undefined;
        dirty.delete(update);
        motion?.dispose();
      },
    };
    active++;
  };

  /** Bring the element in line with the current preferences, engine and tokens. */
  function sync() {
    if (stopped) return;
    waiting.delete(sync);
    sizeWatch?.disconnect();
    sizeWatch = undefined;
    const was = installed !== undefined;
    uninstall();
    if (eligible()) install();
    if (was && !installed) wake();
  }

  const lists = [...OFF_QUERIES, ...REBUILD_QUERIES].map((q) => matchMedia(q));
  for (const list of lists) list.addEventListener("change", sync);
  const mutations = typeof MutationObserver === "function" ? new MutationObserver(sync) : undefined;
  mutations?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: REBUILD_ATTRIBUTES,
  });

  // Live configuration: when an element or an ancestor changes the variables the lens reads (a
  // `style` prop, a preset on `data-glass`), the filter is rebuilt once the values really differ.
  const configKey = () => {
    const computed = getComputedStyle(element);
    return WATCHED_VARS.map((name) =>
      // An overlay's pointer mode is its own: what a scope sets above it does not count.
      name === "--liquid-interactive" && options.ownInteractive
        ? element.style.getPropertyValue(name).trim()
        : computed.getPropertyValue(name).trim(),
    ).join("|");
  };
  let configSeen = configKey();
  const refresh = () => {
    if (stopped) return;
    const next = configKey();
    if (next === configSeen) return;
    configSeen = next;
    sync();
  };
  /** The elements whose attributes are watched: the surface and its ancestors. */
  let watched: Element[] = [];
  const chain = () => {
    const nodes: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) nodes.push(node);
    return nodes;
  };
  const sameChain = (nodes: Element[]) =>
    nodes.length === watched.length && nodes.every((node, i) => node === watched[i]);
  let styleSeen = element.getAttribute("style");
  const configObserver =
    typeof MutationObserver === "function"
      ? new MutationObserver((records) => {
          let relevant = false;
          for (const record of records) {
            if (record.type === "childList") {
              // Moved to another parent (or an ancestor was): watch the new chain.
              const moved = (nodes: NodeList) => [...nodes].some((node) => node.contains(element));
              if (moved(record.addedNodes) || moved(record.removedNodes)) relevant = true;
              continue;
            }
            // The motion rewrites the surface's own `style` every frame: not a configuration change.
            if (record.target === element && record.attributeName === "style") {
              const now = element.getAttribute("style");
              if (authorStyle(now) === authorStyle(styleSeen)) {
                styleSeen = now;
                continue;
              }
              styleSeen = now;
            }
            relevant = true;
          }
          if (!relevant) return;
          if (!sameChain(chain())) watch();
          schedule(refresh);
        })
      : undefined;
  /** (Re)observe the surface and its ancestors; childList of each catches a move of the chain. */
  function watch() {
    configObserver?.disconnect();
    watched = chain();
    for (const node of watched)
      configObserver?.observe(node, {
        attributes: true,
        attributeFilter: CONFIG_ATTRIBUTES,
        childList: node !== element,
      });
  }
  watch();

  function stop() {
    if (stopped) return;
    stopped = true;
    for (const list of lists) list.removeEventListener("change", sync);
    configObserver?.disconnect();
    mutations?.disconnect();
    waiting.delete(sync);
    dirty.delete(sync);
    dirty.delete(refresh);
    sizeWatch?.disconnect();
    sizeWatch = undefined;
    const was = installed !== undefined;
    uninstall();
    if (was) wake();
    controllers.delete(element);
  }

  sync();
  return {
    configure(next) {
      options = next;
      sync();
    },
    stop,
  };
}

/**
 * Opt-in lensing for a glass surface (`glass`, `glass-clear`, `surface-overlay`): bends the
 * backdrop along the rim with an SVG displacement filter and marks the element
 * `data-glass-refraction="on"`.
 *
 * It does nothing, and leaves the plain blur, where the engine cannot paint it. It also follows
 * the user's preferences live: reduced transparency, more contrast, forced colors or reduced
 * motion remove it, and clearing them brings it back. Calling it again on the same element
 * updates the options instead of stacking a second filter. Returns the cleanup function (every
 * returned cleanup stops the same refraction). Never on by default: it re-rasterises the
 * backdrop every frame.
 */
export function applyLens(element: HTMLElement, options: LensOptions = {}): () => void {
  if (typeof document === "undefined" || typeof matchMedia !== "function") return () => {};
  const existing = controllers.get(element);
  if (existing) {
    existing.configure(options);
    return existing.stop;
  }
  const controller = createController(element, options);
  controllers.set(element, controller);
  return controller.stop;
}
