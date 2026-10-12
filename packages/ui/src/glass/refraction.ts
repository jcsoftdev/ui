import { createDisplacementMap } from "./displacement-map.js";
import { supportsBackdropRefraction } from "./support.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const HOST_ID = "ui-glass-refraction-defs";

export interface GlassRefractionOptions {
  /** Strength of the lens in px of displacement at the rim. Default 18. */
  scale?: number;
  /** Width of the refracting rim in px. Default 14. */
  bezel?: number;
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

let counter = 0;

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
  let installed: { filter: SVGFilterElement; observer?: ResizeObserver } | undefined;
  const original = element.style.backdropFilter;
  const originalPrefixed = element.style.getPropertyValue("-webkit-backdrop-filter");

  const eligible = () =>
    !userWantsLess() && (options.refraction === "force" || supportsBackdropRefraction());

  const uninstall = () => {
    if (!installed) return;
    installed.observer?.disconnect();
    installed.filter.remove();
    const defs = document.getElementById(HOST_ID);
    if (defs && !defs.querySelector("filter")) defs.remove();
    installed = undefined;
    element.style.backdropFilter = original;
    if (originalPrefixed) element.style.setProperty("-webkit-backdrop-filter", originalPrefixed);
    else element.style.removeProperty("-webkit-backdrop-filter");
    delete element.dataset.glassRefraction;
  };

  const install = () => {
    if (!element.isConnected) return;
    const { scale = 18, bezel = 14 } = options;
    const id = `ui-glass-lens-${++counter}`;
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const image = document.createElementNS(SVG_NS, "feImage");
    image.setAttribute("result", "map");
    image.setAttribute("preserveAspectRatio", "none");
    const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
    displace.setAttribute("in", "SourceGraphic");
    displace.setAttribute("in2", "map");
    displace.setAttribute("scale", String(scale));
    displace.setAttribute("xChannelSelector", "R");
    displace.setAttribute("yChannelSelector", "B");
    filter.append(image, displace);
    host().appendChild(filter);

    // The blur comes from the stylesheet every time (theme and preset change it), never from a
    // value captured once: read it with our own inline value out of the way.
    element.style.backdropFilter = original;
    const base = getComputedStyle(element).backdropFilter;
    const blur = !base || base === "none" ? "" : `${base} `;

    const update = () => {
      if (!element.isConnected) return stop();
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      for (const [node, name, value] of [
        [filter, "x", "0"],
        [filter, "y", "0"],
        [filter, "width", String(width)],
        [filter, "height", String(height)],
        [image, "width", String(width)],
        [image, "height", String(height)],
      ] as const)
        node.setAttribute(name, value);
      image.setAttribute("href", createDisplacementMap({ width, height, radius, bezel }));
    };
    update();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : undefined;
    observer?.observe(element);
    element.style.backdropFilter = `${blur}url(#${id})`;
    element.style.setProperty("-webkit-backdrop-filter", `${blur}url(#${id})`);
    element.dataset.glassRefraction = "on";
    installed = { filter, observer };
  };

  /** Bring the element in line with the current preferences, engine and tokens. */
  const sync = () => {
    if (stopped) return;
    uninstall();
    if (eligible()) install();
  };

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
    uninstall();
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
