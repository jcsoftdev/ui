import { createDisplacementMap } from "./displacement-map.js";
import { supportsBackdropRefraction } from "./support.js";

const SVG_NS = "http://www.w3.org/2000/svg";

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

let counter = 0;

function userWantsLess(): boolean {
  const query = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
  return (
    query("(prefers-reduced-transparency: reduce)") ||
    query("(prefers-contrast: more)") ||
    query("(forced-colors: active)") ||
    query("(prefers-reduced-motion: reduce)")
  );
}

function host(): SVGSVGElement {
  const id = "ui-glass-refraction-defs";
  const existing = document.getElementById(id);
  if (existing) return existing as unknown as SVGSVGElement;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = id;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  document.body.appendChild(svg);
  return svg;
}

/**
 * Opt-in lensing for a glass surface (`glass`, `glass-clear`, `surface-overlay`): bends the
 * backdrop along the rim with an SVG displacement filter and marks the element
 * `data-glass-refraction="on"`. Does nothing, and leaves the plain blur, where the engine cannot
 * paint it or the user prefers less transparency, more contrast or less motion. Returns the
 * cleanup function. Never on by default: it re-rasterises the backdrop every frame.
 */
export function applyGlassRefraction(
  element: HTMLElement,
  { scale = 18, bezel = 14, refraction = "auto" }: GlassRefractionOptions = {},
): () => void {
  if (typeof document === "undefined") return () => {};
  if (userWantsLess()) return () => {};
  if (refraction !== "force" && !supportsBackdropRefraction()) return () => {};

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

  const base = getComputedStyle(element).backdropFilter;
  const blur = !base || base === "none" ? "" : `${base} `;
  const original = element.style.backdropFilter;

  const update = () => {
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

  return () => {
    observer?.disconnect();
    filter.remove();
    element.style.backdropFilter = original;
    element.style.removeProperty("-webkit-backdrop-filter");
    delete element.dataset.glassRefraction;
  };
}
