// Shared by the E18 charts (dumbbell, slope, range-area, waterfall, bullet and the distribution
// family): axis and grid drawing, label fitting and the small animation helpers. Charts import
// this file, never each other's entry.
import { type AxisTick, estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  formatPercent,
  resolveAxisFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import { adoptStyles, rootOf } from "./base.js";
import { svg } from "./chart-dom.js";
import css from "./e18-plot.css.js";

export const EASE = "cubic-bezier(.22,1,.36,1)";

/** Marks the host so the row highlight and dim rules of `e18-plot.css` apply, and adopts them. */
export function adoptPlot(host: HTMLElement): void {
  host.setAttribute("data-e18", "");
  adoptStyles(rootOf(host), css);
}

const TICK = "fill:var(--ink-3);font-size:11px;font-weight:500;font-variant-numeric:tabular-nums";

/** A `<text>`; `style` is appended to nothing else, so pass the whole look. */
export function text(
  content: string,
  attrs: Record<string, string | number | undefined>,
  style: string,
): SVGTextElement {
  return svg("text", { ...attrs, style }, content);
}

/** Soft background lines; the zero line, when given, is a little stronger. */
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
      style: `stroke:${stroke}`,
    });
  const group = svg("g", { "aria-hidden": "true" });
  for (const tick of ticks) group.append(line(tick.position, "var(--chart-grid)"));
  if (zero != null) group.append(line(zero, "var(--line-strong)"));
  return group;
}

/** Category or value labels under the plot, centered on their ticks. */
export function axisBottom(
  ticks: readonly AxisTick[],
  offset: number,
  rotate?: number,
): SVGGElement {
  const group = svg("g", { transform: `translate(0,${offset})`, "aria-hidden": "true" });
  for (const tick of ticks)
    group.append(
      rotate
        ? text(
            tick.label,
            {
              x: tick.position,
              y: 12,
              "text-anchor": rotate < 0 ? "end" : "start",
              transform: `rotate(${rotate} ${tick.position} 12)`,
            },
            TICK,
          )
        : text(tick.label, { x: tick.position, y: 18, "text-anchor": "middle" }, TICK),
    );
  return group;
}

/** Value labels on the left, right-aligned against the plot, with an optional title above. */
export function axisLeft(ticks: readonly AxisTick[], offset: number, title?: string): SVGGElement {
  const group = svg("g", { transform: `translate(${offset},0)`, "aria-hidden": "true" });
  if (title)
    group.append(
      text(
        title,
        { x: -10, y: -16, "text-anchor": "end" },
        "fill:var(--ink-3);font-size:10.5px;font-weight:700",
      ),
    );
  for (const tick of ticks)
    group.append(
      text(tick.label, { x: -10, y: tick.position, dy: "0.34em", "text-anchor": "end" }, TICK),
    );
  return group;
}

/** Shortens `text` with an ellipsis so it fits `room` pixels (about 7 per character at 12px). */
export function fitLabel(label: string, room: number, size = 12): string {
  if (estimateTextWidth(label, size) <= room) return label;
  const chars = Math.max(2, Math.floor(room / (size * 0.58)) - 1);
  return `${label.slice(0, chars).trimEnd()}…`;
}

/** Transparent rectangle that is the keyboard stop and the hit area of a mark. */
export function hitRect(x: number, y: number, width: number, height: number): SVGRectElement {
  return svg("rect", {
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    fill: "transparent",
  });
}

/** Scales `element` in from nothing on one axis (entry animation; call only when `animate`). */
export function grow(
  element: Element,
  axis: "x" | "y",
  index: number,
  { duration = 560, step = 40, max = 400 }: { duration?: number; step?: number; max?: number } = {},
): void {
  const from = axis === "x" ? "scaleX(0)" : "scaleY(0)";
  const to = axis === "x" ? "scaleX(1)" : "scaleY(1)";
  element.animate([{ transform: from }, { transform: to }], {
    duration,
    delay: Math.min(index * step, max),
    easing: EASE,
    fill: "backwards",
  });
}

/** Fades `element` in after `delay` ms (entry animation). */
export function fadeIn(element: Element, duration = 360, delay = 0): void {
  element.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration,
    delay,
    easing: EASE,
    fill: "backwards",
  });
}

/** An axis bound as a number, or as a function of the value the data would give. */
export type AxisBound = number | ((dataValue: number) => number);

/** The bound to use: `bound` itself, `bound(dataValue)` for a function, else `dataValue`. */
export const resolveBound = (bound: AxisBound | undefined, dataValue: number): number =>
  bound == null ? dataValue : typeof bound === "function" ? bound(dataValue) : bound;

/** The value axis options of the E18 charts (the React `ValueAxisOptions`). */
export interface ValueAxis {
  min?: AxisBound;
  max?: AxisBound;
  /** Approximate number of ticks; derived from the size by default. */
  tickCount?: number;
  /** Tick format; defaults to a short form of the chart's `value-format`. */
  format?: ValueFormat;
  /** Short axis title above the ticks. */
  title?: string;
}

const PRESETS = new Set(["number", "integer", "currency", "percent", "compact"]);

/** The chart's `ValueFormat` (property, else the `value-format` preset) for its axis labels. */
export function valueFormatOf(
  host: HTMLElement & { valueFormat?: ValueFormat },
): ValueFormat | undefined {
  const preset = host.getAttribute("value-format");
  return host.valueFormat ?? (preset && PRESETS.has(preset) ? (preset as ValueFormat) : undefined);
}

/** Tick labels formatter of a chart: short currency and compact forms, in the chart's locale. */
export function axisFormatter(
  host: HTMLElement & { valueFormat?: ValueFormat; locale: string },
  override?: ValueFormat,
): (value: number) => string {
  return resolveAxisFormat(override ?? valueFormatOf(host), {
    locale: host.locale,
    currency: host.getAttribute("currency") || undefined,
  });
}

/** Parses a JSON attribute (`items='[...]'`); undefined when absent or malformed. */
export function jsonAttr<T>(host: Element, name: string): T | undefined {
  const raw = host.getAttribute(name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * A chart whose natural height depends on its data (rows) sets `height` for the author unless the
 * author set one. The base reads the attribute before each draw, so call `apply()` first.
 */
export class AutoHeight {
  #set: string | null = null;
  constructor(private readonly host: HTMLElement) {}
  /** True when the author chose the height (or an aspect ratio). */
  get author(): boolean {
    return (
      this.host.hasAttribute("aspect-ratio") ||
      (this.host.hasAttribute("height") && this.host.getAttribute("height") !== this.#set)
    );
  }
  apply(pixels: number): void {
    if (this.author) return;
    const next = `${Math.round(pixels)}`;
    if (this.host.getAttribute("height") !== next) this.host.setAttribute("height", next);
    this.#set = next;
  }
}

/** Percent change text with a leading `+`, or an em dash when the base is zero. */
export function percentChange(from: number, to: number, locale: string): string {
  if (from === 0) return "—";
  const diff = to - from;
  return `${diff > 0 ? "+" : ""}${formatPercent(diff / Math.abs(from), { decimals: 0, locale })}`;
}

/** Whether a boolean-ish attribute is on: present, and not "off" or "false". */
export const flag = (host: Element, name: string, fallback = false): boolean => {
  const value = host.getAttribute(name);
  return value === null ? fallback : value !== "off" && value !== "false";
};
