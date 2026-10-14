/** Drawings over the price pane (trend line, horizontal line, range box, Fibonacci, ruler) as SVG. */
import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { svg } from "./chart-dom.js";
import {
  distanceToSegment,
  durationDays,
  fibLevels,
  indexAtTime,
  measureRange,
  type StockAnchor,
  type StockDrawing,
  timeAtIndex,
} from "./e23-stock.js";
import css from "./e23-stock-drawings.css.js";

/** The styles of the drawing tools, adopted by the chart when this module loads. */
export const styles = css;

/** Where the price pane sits and how pixels map to moments and prices. */
export interface DrawingGeometry {
  /** Time of every bar of the whole series (not only the visible window). */
  times: readonly number[];
  /** First visible bar. */
  from: number;
  /** Pixel of the first visible bar and distance between bars. */
  x0: number;
  step: number;
  innerWidth: number;
  priceHeight: number;
  y: (price: number) => number;
  invert: (pixel: number) => number;
}

export interface DrawingTexts {
  bars: string;
  days: string;
}

const HIT = 7;

export function xOfTime(geometry: DrawingGeometry, time: number): number {
  return geometry.x0 + (indexAtTime(geometry.times, time) - geometry.from) * geometry.step;
}

/** Anchor under a pixel of the price pane, snapped to the nearest bar and clamped inside. */
export function anchorAt(geometry: DrawingGeometry, px: number, py: number): StockAnchor {
  const last = Math.max(0, geometry.times.length - 1);
  const index = (px - geometry.x0) / (geometry.step || 1) + geometry.from;
  const snapped = Math.min(last, Math.max(0, Math.round(index)));
  const row = Math.min(geometry.priceHeight, Math.max(0, py));
  return { time: timeAtIndex(geometry.times, snapped), price: geometry.invert(row) };
}

/** Topmost drawing within a few pixels of the point, or null. */
export function hitDrawing(
  drawings: readonly StockDrawing[],
  geometry: DrawingGeometry,
  point: { x: number; y: number },
): string | null {
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const drawing = drawings[i] as StockDrawing;
    if (drawing.type === "horizontal") {
      if (Math.abs(point.y - geometry.y(drawing.price)) <= HIT) return drawing.id;
      continue;
    }
    const a = { x: xOfTime(geometry, drawing.a.time), y: geometry.y(drawing.a.price) };
    const b = { x: xOfTime(geometry, drawing.b.time), y: geometry.y(drawing.b.price) };
    if (drawing.type === "trend") {
      if (distanceToSegment(point, a, b) <= HIT) return drawing.id;
    } else if (drawing.type === "range") {
      const inside =
        point.x >= Math.min(a.x, b.x) - HIT &&
        point.x <= Math.max(a.x, b.x) + HIT &&
        point.y >= Math.min(a.y, b.y) - HIT &&
        point.y <= Math.max(a.y, b.y) + HIT;
      if (inside) return drawing.id;
    } else {
      const near = fibLevels(drawing.a.price, drawing.b.price).some(
        (level) => Math.abs(point.y - geometry.y(level.price)) <= HIT,
      );
      if (near) return drawing.id;
    }
  }
  return null;
}

const handle = (x: number, y: number) => svg("circle", { class: "handle", cx: x, cy: y, r: 4.5 });

/** One drawing; `draft` is the dashed preview while the pointer is still down. */
export function drawingNode(
  drawing: StockDrawing,
  geometry: DrawingGeometry,
  selected: boolean,
  fmt: (value: number) => string,
  percent: (value: number) => string,
  draft = false,
): SVGGElement {
  const g = svg("g", { class: `drawing drawing-${drawing.type}`, "aria-hidden": "true" });
  const width = selected ? 2.5 : 1.75;
  const dash = draft ? "4 3" : undefined;
  if (drawing.type === "horizontal") {
    const py = geometry.y(drawing.price);
    g.append(
      svg("line", {
        x1: 0,
        x2: geometry.innerWidth,
        y1: py,
        y2: py,
        "stroke-width": width,
        "stroke-dasharray": dash ?? "6 4",
      }),
      svg("text", { x: 6, y: py - 5, class: "drawing-label" }, fmt(drawing.price)),
    );
    return g;
  }
  const ax = xOfTime(geometry, drawing.a.time);
  const ay = geometry.y(drawing.a.price);
  const bx = xOfTime(geometry, drawing.b.time);
  const by = geometry.y(drawing.b.price);
  if (drawing.type === "trend") {
    g.append(
      svg("line", {
        x1: ax,
        y1: ay,
        x2: bx,
        y2: by,
        "stroke-width": width,
        "stroke-linecap": "round",
        "stroke-dasharray": dash,
      }),
    );
  } else if (drawing.type === "range") {
    const change = drawing.a.price
      ? (drawing.b.price - drawing.a.price) / Math.abs(drawing.a.price)
      : 0;
    const left = Math.min(ax, bx);
    const top = Math.min(ay, by);
    g.append(
      svg("rect", {
        class: "range-box",
        x: left,
        y: top,
        width: Math.abs(bx - ax),
        height: Math.abs(by - ay),
        rx: 3,
        "stroke-width": selected ? 2 : 1.25,
        "stroke-dasharray": dash,
      }),
      svg(
        "text",
        { x: left + 6, y: top + 14, class: "drawing-label strong" },
        `${change > 0 ? "+" : ""}${percent(change)}`,
      ),
    );
  } else {
    const left = Math.max(0, Math.min(ax, bx));
    g.append(
      svg("rect", {
        class: "fib-box",
        x: left,
        y: Math.min(ay, by),
        width: Math.max(0, geometry.innerWidth - left),
        height: Math.abs(by - ay),
      }),
    );
    for (const level of fibLevels(drawing.a.price, drawing.b.price)) {
      const py = geometry.y(level.price);
      g.append(
        svg("line", {
          x1: left,
          x2: geometry.innerWidth,
          y1: py,
          y2: py,
          "stroke-width": selected ? 1.75 : 1,
          "stroke-dasharray": level.ratio === 0 || level.ratio === 1 ? dash : (dash ?? "3 3"),
          "stroke-opacity": 0.85,
        }),
        svg(
          "text",
          {
            x: geometry.innerWidth - 4,
            y: py - 4,
            "text-anchor": "end",
            class: "drawing-label small",
          },
          `${level.ratio} · ${fmt(level.price)}`,
        ),
      );
    }
  }
  if (selected) g.append(handle(ax, ay), handle(bx, by));
  return g;
}

/** The ruler: a dashed box between the two ends and a label with the change, bars and days. */
export function measureNode(
  a: StockAnchor,
  b: StockAnchor,
  geometry: DrawingGeometry,
  texts: DrawingTexts,
  percent: (value: number) => string,
): SVGGElement {
  const measure = measureRange(geometry.times, a, b);
  const tone = measure.change >= 0 ? "up" : "down";
  const ax = xOfTime(geometry, a.time);
  const bx = xOfTime(geometry, b.time);
  const ay = geometry.y(a.price);
  const by = geometry.y(b.price);
  const label = `${measure.percent > 0 ? "+" : ""}${percent(measure.percent)} · ${measure.bars} ${texts.bars} · ${durationDays(measure.duration)} ${texts.days}`;
  const boxWidth = estimateTextWidth(label) + 16;
  const boxX = Math.max(0, Math.min(geometry.innerWidth - boxWidth, (ax + bx) / 2 - boxWidth / 2));
  const boxY = Math.max(0, Math.min(geometry.priceHeight - 22, Math.min(ay, by) - 28));
  return svg(
    "g",
    { class: `drawing measure measure-${tone}`, "aria-hidden": "true" },
    svg("rect", {
      class: "measure-box",
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      width: Math.abs(bx - ax),
      height: Math.abs(by - ay),
      "stroke-dasharray": "4 3",
    }),
    svg("line", { x1: ax, y1: ay, x2: bx, y2: by, "stroke-width": 1.5 }),
    svg("rect", { class: "measure-tag", x: boxX, y: boxY, width: boxWidth, height: 22, rx: 6 }),
    svg(
      "text",
      {
        class: "measure-label",
        x: boxX + boxWidth / 2,
        y: boxY + 11,
        dy: "0.34em",
        "text-anchor": "middle",
      },
      label,
    ),
  );
}

let counter = 0;
export function newDrawingId(): string {
  counter += 1;
  return `d${Date.now().toString(36)}${counter}`;
}
