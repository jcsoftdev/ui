// SVG builders for the axes shared by the cartesian, scatter and histogram charts. Text is styled
// by e17-chart.css (`[data-e17]`), so a theme change needs no redraw.
import type { AxisTick } from "@jcsoftdev/ui-core/chart/axis";
import { svg } from "./chart-dom.js";

const tick = (x: number, y: number, label: string, extra: Record<string, string | number> = {}) =>
  svg("text", { x, y, "data-e17": "tick", ...extra }, label);

/** Soft background lines; the zero line, when visible, is a little stronger. */
export function gridLines(
  ticks: readonly AxisTick[],
  direction: "horizontal" | "vertical",
  length: number,
  zero?: number | null,
): SVGGElement {
  const horizontal = direction === "horizontal";
  const line = (at: number, stroke: string) =>
    svg("line", {
      x1: horizontal ? 0 : at,
      x2: horizontal ? length : at,
      y1: horizontal ? at : 0,
      y2: horizontal ? at : length,
      "shape-rendering": "crispEdges",
      style: `stroke:${stroke}`,
    });
  const group = svg("g", { "data-e17": "grid", "aria-hidden": "true" });
  for (const t of ticks) group.append(line(t.position, "var(--chart-grid)"));
  if (zero != null) group.append(line(zero, "var(--line-strong)"));
  return group;
}

/** Category or time labels under the plot, optionally tilted. */
export function axisBottom(ticks: readonly AxisTick[], offset: number, rotate = 0): SVGGElement {
  const group = svg("g", { transform: `translate(0,${offset})`, "aria-hidden": "true" });
  for (const t of ticks)
    group.append(
      rotate
        ? tick(t.position, 12, t.label, {
            "text-anchor": rotate < 0 ? "end" : "start",
            transform: `rotate(${rotate} ${t.position} 12)`,
          })
        : tick(t.position, 18, t.label, { "text-anchor": "middle" }),
    );
  return group;
}

function valueAxis(
  side: "left" | "right",
  ticks: readonly AxisTick[],
  offset: number,
  title?: string,
  color?: string,
): SVGGElement {
  const left = side === "left";
  const group = svg("g", { transform: `translate(${offset},0)`, "aria-hidden": "true" });
  const paint = color ? `fill:${color}` : undefined;
  if (title)
    group.append(
      svg(
        "text",
        {
          x: left ? -10 : 10,
          y: -16,
          "text-anchor": left ? "end" : "start",
          "data-e17": "title",
          style: paint,
        },
        title,
      ),
    );
  for (const t of ticks)
    group.append(
      tick(left ? -10 : 10, t.position, t.label, {
        dy: "0.34em",
        "text-anchor": left ? "end" : "start",
        ...(paint ? { style: paint } : {}),
      }),
    );
  return group;
}

/** Value labels on the left, right-aligned against the plot. */
export const axisLeft = (
  ticks: readonly AxisTick[],
  offset: number,
  title?: string,
  color?: string,
) => valueAxis("left", ticks, offset, title, color);

/** Value labels on the right, for a secondary axis. */
export const axisRight = (
  ticks: readonly AxisTick[],
  offset: number,
  title?: string,
  color?: string,
) => valueAxis("right", ticks, offset, title, color);

/** Row labels beside a horizontal bar plot. */
export function axisCategoryLeft(ticks: readonly AxisTick[], offset = 0): SVGGElement {
  const group = svg("g", { transform: `translate(${offset},0)`, "aria-hidden": "true" });
  for (const t of ticks)
    group.append(
      svg(
        "text",
        { x: -10, y: t.position, dy: "0.34em", "text-anchor": "end", "data-e17": "tick" },
        t.label,
      ),
    );
  return group;
}

/** The axis line along the plot edge (baseline or zero line). */
export const baseline = (x1: number, x2: number, y1: number, y2: number) =>
  svg("line", {
    x1,
    x2,
    y1,
    y2,
    "shape-rendering": "crispEdges",
    "aria-hidden": "true",
    style: "stroke:var(--line-strong)",
  });
