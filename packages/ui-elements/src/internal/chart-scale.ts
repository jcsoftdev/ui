import { adoptStyles, rootOf } from "./base.js";
import type { LegendScale } from "./chart-protocol.js";
import css from "./chart-scale.css.js";

/**
 * Draws a continuous color scale into `node`: the low value, a gradient bar, the high value, named
 * for assistive tech ("Heat: 0% to 100%"). The legend fetches this only for a chart that publishes
 * a `scale`.
 */
export function renderScale(
  host: HTMLElement,
  node: HTMLElement,
  scale: LegendScale,
  fallbackLabel: string | null,
): void {
  adoptStyles(rootOf(host), css);
  const format = scale.format ?? String;
  const { colors } = scale;
  const stops = colors.map((color, i) => {
    const offset = scale.stops?.[i] ?? (colors.length > 1 ? i / (colors.length - 1) : 0);
    return `${color} ${(offset * 100).toFixed(1)}%`;
  });
  const bar = document.createElement("span");
  bar.dataset.uiPart = "bar";
  bar.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  const low = document.createElement("span");
  low.textContent = format(scale.min);
  const high = document.createElement("span");
  high.textContent = format(scale.max);
  node.dataset.uiPart = "scale";
  node.replaceChildren(low, bar, high);
  node.setAttribute("role", "img");
  node.setAttribute(
    "aria-label",
    `${scale.label ?? fallbackLabel ?? "Scale"}: ${low.textContent} to ${high.textContent}`,
  );
}
