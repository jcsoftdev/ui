// Axes, grid and number formats shared by the E19 charts (stream graph, beeswarm, candlestick, timeline, heatmap).
import type { AxisTick } from "@jcsoftdev/ui-core/chart/axis";
import {
  resolveAxisFormat,
  type ValueFormat,
  type ValueFormatter,
} from "@jcsoftdev/ui-core/chart/format";
import { svg } from "./chart-dom.js";

const TEXT = "fill:var(--ink-3);font-size:11px;font-weight:500;font-variant-numeric:tabular-nums";
const TITLE = "fill:var(--ink-3);font-size:10.5px;font-weight:700";
const PRESETS = new Set(["number", "integer", "currency", "percent", "compact"]);

/** The `value-format` of a chart: its property, else the preset named by the attribute. */
export function formatOf(
  element: Element & { valueFormat?: ValueFormat },
): ValueFormat | undefined {
  const preset = element.getAttribute("value-format");
  return (
    element.valueFormat ?? (preset && PRESETS.has(preset) ? (preset as ValueFormat) : undefined)
  );
}

/** The short tick format of a chart (currency drops the cents, large numbers turn compact). */
export function axisFormatOf(
  element: Element & { valueFormat?: ValueFormat },
  locale: string,
): ValueFormatter {
  return resolveAxisFormat(formatOf(element), {
    locale,
    currency: element.getAttribute("currency") || undefined,
  });
}

/** Soft background lines; `zero`, when given, is drawn a little stronger. */
export function gridLines(
  ticks: readonly AxisTick[],
  direction: "horizontal" | "vertical",
  length: number,
  zero?: number,
): SVGGElement {
  const horizontal = direction === "horizontal";
  const line = (position: number, stroke: string) =>
    svg("line", {
      x1: horizontal ? 0 : position,
      x2: horizontal ? length : position,
      y1: horizontal ? position : 0,
      y2: horizontal ? position : length,
      "shape-rendering": "crispEdges",
      "aria-hidden": "true",
      style: `stroke:${stroke}`,
    });
  const group = svg("g", { "aria-hidden": "true" });
  for (const tick of ticks) group.append(line(tick.position, "var(--chart-grid)"));
  if (zero != null) group.append(line(zero, "var(--line-strong)"));
  return group;
}

/** Category or time labels under the plot, at `offset` pixels from the top of the plot. */
export function axisBottom(ticks: readonly AxisTick[], offset: number): SVGGElement {
  const group = svg("g", { transform: `translate(0,${offset})`, "aria-hidden": "true" });
  for (const tick of ticks)
    group.append(
      svg("text", { x: tick.position, y: 18, "text-anchor": "middle", style: TEXT }, tick.label),
    );
  return group;
}

/** Value labels on the left, right-aligned against the plot at `offset`. */
export function axisLeft(ticks: readonly AxisTick[], offset: number, title?: string): SVGGElement {
  const group = svg("g", { transform: `translate(${offset},0)`, "aria-hidden": "true" });
  if (title)
    group.append(svg("text", { x: -10, y: -16, "text-anchor": "end", style: TITLE }, title));
  for (const tick of ticks)
    group.append(
      svg(
        "text",
        { x: -10, y: tick.position, dy: "0.34em", "text-anchor": "end", style: TEXT },
        tick.label,
      ),
    );
  return group;
}

/** Row labels on the left of a horizontal category axis, ink-2 and semibold. */
export function rowLabels(ticks: readonly AxisTick[]): SVGGElement {
  const group = svg("g", { "aria-hidden": "true" });
  for (const tick of ticks)
    group.append(
      svg(
        "text",
        {
          x: -12,
          y: tick.position,
          dy: "0.34em",
          "text-anchor": "end",
          style: "fill:var(--ink-2);font-size:12px;font-weight:600",
        },
        tick.label,
      ),
    );
  return group;
}

/** A short axis title (unit), e.g. at the end of a horizontal value axis. */
export function axisTitle(text: string, x: number, y: number): SVGTextElement {
  return svg("text", { x, y, "text-anchor": "end", "aria-hidden": "true", style: TITLE }, text);
}

/** The strong baseline of a plot. */
export function baseline(x1: number, x2: number, y1: number, y2: number): SVGLineElement {
  return svg("line", {
    x1,
    x2,
    y1,
    y2,
    "shape-rendering": "crispEdges",
    "aria-hidden": "true",
    style: "stroke:var(--line-strong)",
  });
}

/** Elements of a cleared `group`, keeping the group: shorthand for `replaceChildren`. */
export const EASE = "cubic-bezier(.22,1,.36,1)";

const probes = new WeakMap<Element, HTMLElement>();

/**
 * A CSS color (including `var(--token)`) as a color a canvas can paint with. The canvas layer
 * cannot read custom properties, so the chart resolves each color once per draw through a hidden
 * probe element inside the host.
 */
export function cssColor(host: Element, value: string): string {
  let probe = probes.get(host);
  if (!probe?.isConnected) {
    probe = document.createElement("i");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    host.append(probe);
    probes.set(host, probe);
  }
  probe.style.color = "";
  probe.style.color = value;
  return getComputedStyle(probe).color;
}

const autoHeights = new WeakMap<Element, string>();

/**
 * Sizes a chart from its content when the author gave no `height`: sets the attribute and keeps
 * updating it for as long as it holds our own value (an author's height is never touched).
 */
export function autoHeight(host: HTMLElement, px: number): void {
  const current = host.getAttribute("height");
  if (current !== null && current !== autoHeights.get(host)) return;
  if (host.hasAttribute("aspect-ratio")) return;
  const next = `${Math.round(px)}`;
  autoHeights.set(host, next);
  if (current !== next) host.setAttribute("height", next);
}
