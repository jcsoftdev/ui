import {
  bezelFor,
  createDisplacementMap,
  createSpecularMap,
  type LensCoverage,
  scaleFor,
  VEIL_FLOOR,
} from "./displacement-map.js";
import { supportsBackdropRefraction } from "./support.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HOST_ID = "ui-glass-refraction-defs";

export interface GlassRefractionOptions {
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
   * and gentle but never zero towards the centre, with at most 24 px of offset. `"rim"`: only the
   * bevel, the middle shows the backdrop undisplaced. CSS: `--glass-lens-coverage: rim`.
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
   * Materialise the lens when it is first applied (the refraction grows from nothing over
   * 280 ms) and lift it while an interactive surface is pressed. Default true; never runs under
   * reduced motion, where the lens is not applied at all.
   */
  animate?: boolean;
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

/** Ease-out cubic. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Minimum time between two rebuilds of the displacement map of one surface. */
const REBUILD_MS = 90;

let counter = 0;
let active = 0;
/** Surfaces that are eligible but found no free slot; the next one is woken when a slot frees. */
const waiting = new Set<() => void>();

/** Size changes are coalesced into one pass per frame, whatever the number of surfaces. */
const dirty = new Set<() => void>();
let frame = 0;
function schedule(run: () => void) {
  dirty.add(run);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const batch = [...dirty];
    dirty.clear();
    for (const task of batch) task();
  });
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

interface Controller {
  configure(options: GlassRefractionOptions): void;
  stop(): void;
}

/** One controller per element, so applying twice never stacks a second `url()` filter. */
const controllers = new WeakMap<HTMLElement, Controller>();

function createController(element: HTMLElement, initial: GlassRefractionOptions): Controller {
  let options = initial;
  let stopped = false;
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
    element.style.removeProperty("--glass-veil");
    element.style.removeProperty("--glass-lens-tint");
  };

  /** `full` (default) bends the whole surface; `rim` only the bevel. `--glass-lens-coverage` in CSS sets it too. */
  const coverageFor = (): LensCoverage =>
    options.coverage ??
    (getComputedStyle(element).getPropertyValue("--glass-lens-coverage").trim() === "rim"
      ? "rim"
      : "full");

  /** Dispersion is off unless asked for: `dispersion` option, or `--glass-lens-dispersion` in CSS. */
  const dispersionFor = (area: number) => {
    const asked =
      options.dispersion ??
      (Number.parseFloat(getComputedStyle(element).getPropertyValue("--glass-lens-dispersion")) ||
        0);
    return area <= DISPERSION_AREA ? asked : 0;
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
    const id = `ui-glass-lens-${++counter}`;
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
    const displace = (channel: string | undefined, factor: number) =>
      displacers.push({
        node: node("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "map",
          scale: "0",
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: channel === "lens" ? "lens" : `d${channel}`,
        }),
        factor,
      });
    // Chromatic dispersion: the three colour channels are displaced by slightly different
    // amounts (blue the least, red the most, so the rim fringes like real glass) and added back.
    if (dispersion > 0) {
      const keep = {
        r: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0",
        g: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0",
        b: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0",
      } as const;
      const factors = { r: 1 + dispersion, g: 1, b: 1 - dispersion } as const;
      for (const c of ["r", "g", "b"] as const) {
        displace(c, factors[c]);
        node("feColorMatrix", { in: `d${c}`, type: "matrix", values: keep[c], result: c });
      }
      node("feComposite", {
        in: "r",
        in2: "g",
        operator: "arithmetic",
        k1: "0",
        k2: "1",
        k3: "1",
        k4: "0",
        result: "rg",
      });
      node("feComposite", {
        in: "rg",
        in2: "b",
        operator: "arithmetic",
        k1: "0",
        k2: "1",
        k3: "1",
        k4: "0",
        result: "lens",
      });
    } else displace("lens", 1);
    // Frosted middle, sharp rim: the blue channel of the map says how soft the backdrop is. The
    // lens is blurred in here (not by the CSS blur, which would soften the rim too) and mixed
    // back with the sharp lens by that weight.
    const computed = getComputedStyle(element);
    element.style.backdropFilter = original;
    const base = getComputedStyle(element).backdropFilter;
    const radius = /blur\(\s*([\d.]+)px\s*\)/.exec(base);
    const rest = !base || base === "none" ? "" : `${base.replace(/blur\([^)]*\)\s*/, "").trim()} `;
    if (radius) {
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
    const layers = [radius ? "mixed" : "lens"];
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
        (alphaPart
          ? alphaPart.endsWith("%")
            ? Number.parseFloat(alphaPart) / 100
            : Number(alphaPart)
          : 1);
      const lightVeil = (r + g + b) / 3 > 0.5;
      const sign = lightVeil ? -1 : 1;
      const base = lightVeil ? strength : 0;
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
      element.style.setProperty("--glass-veil", "transparent");
      element.style.setProperty("--glass-lens-tint", "transparent");
    }
    // Directional rim light from a second map: a dark contour and a faint inner shadow, a glint
    // that is the lensed backdrop itself pushed to a high saturation and brightness (so it takes
    // the colour of what is behind the glass), and a touch of white on top of it.
    const specular = options.specular !== false;
    if (specular) {
      specularImage = node("feImage", { result: "spec", preserveAspectRatio: "none" });
      node("feColorMatrix", {
        in: "spec",
        type: "matrix",
        values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0.4 0 0",
        result: "shade",
      });
      node("feColorMatrix", {
        in: "spec",
        type: "matrix",
        values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0 0 0 0",
        result: "glint-mask",
      });
      node("feColorMatrix", { in: "lens", type: "saturate", values: "2.5", result: "glint-sat" });
      const bright = node("feComponentTransfer", { in: "glint-sat", result: "glint-bright" });
      for (const channel of ["feFuncR", "feFuncG", "feFuncB"]) {
        const fn = document.createElementNS(SVG_NS, channel);
        fn.setAttribute("type", "linear");
        fn.setAttribute("slope", "1.6");
        fn.setAttribute("intercept", "0.2");
        bright.appendChild(fn);
      }
      node("feComposite", {
        in: "glint-bright",
        in2: "glint-mask",
        operator: "in",
        result: "glint-tint",
      });
      node("feFlood", {
        "flood-color": "white",
        "flood-opacity": "0.8",
        result: "glint-white-flood",
      });
      node("feComposite", {
        in: "glint-white-flood",
        in2: "glint-mask",
        operator: "in",
        result: "glint-white",
      });
      layers.push("shade", "glint-tint", "glint-white");
    }
    if (layers.length > 1 || radius) {
      const merge = node("feMerge", {});
      for (const input of layers) {
        const mergeNode = document.createElementNS(SVG_NS, "feMergeNode");
        mergeNode.setAttribute("in", input);
        merge.appendChild(mergeNode);
      }
    }
    host().appendChild(filter);

    const blur = rest;

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
      const bezel = options.bezel ?? bezelFor(radius, width, height, coverage);
      const soft = bezelFor(radius, width, height, "rim");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = [width, height, radius, bezel, coverage, dpr].join("x");
      if (next === key) return;
      key = next;
      built = performance.now();
      baseScale = options.scale ?? scaleFor(width, height, bezel, coverage);
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
        createDisplacementMap({ width, height, radius, bezel, coverage, soft, dpr }),
      );
      if (specularImage) {
        specularImage.setAttribute("width", String(width));
        specularImage.setAttribute("height", String(height));
        specularImage.setAttribute("href", createSpecularMap({ width, height, radius, dpr }));
      }
    };
    update();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
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

    // Materialise: the refraction grows from nothing; and lift it while a control is pressed.
    let tween = 0;
    const ease = (to: number, ms: number) => {
      cancelAnimationFrame(tween);
      const from = level;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        level = from + (to - from) * easeOut(t);
        applyScale();
        if (t < 1) tween = requestAnimationFrame(step);
      };
      tween = requestAnimationFrame(step);
    };
    const press = element.matches('button, a, [role="button"], [data-glass-interactive]');
    const down = () => ease(1.35, 120);
    const up = () => ease(1, 220);
    if (options.animate !== false) {
      if (level < 1) ease(1, 280);
      if (press) {
        element.addEventListener("pointerdown", down);
        for (const type of ["pointerup", "pointercancel", "pointerleave"])
          element.addEventListener(type, up);
      }
    }
    element.style.backdropFilter = `${blur}url(#${id})`;
    element.style.setProperty("-webkit-backdrop-filter", `${blur}url(#${id})`);
    element.dataset.glassRefraction = "on";
    installed = {
      filter,
      observer,
      cancel: () => {
        clearTimeout(timer);
        timer = undefined;
        cancelAnimationFrame(tween);
        element.removeEventListener("pointerdown", down);
        for (const type of ["pointerup", "pointercancel", "pointerleave"])
          element.removeEventListener(type, up);
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

  function stop() {
    if (stopped) return;
    stopped = true;
    for (const list of lists) list.removeEventListener("change", sync);
    mutations?.disconnect();
    waiting.delete(sync);
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
export function applyGlassRefraction(
  element: HTMLElement,
  options: GlassRefractionOptions = {},
): () => void {
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
