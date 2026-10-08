"use client";

import { type PointerEvent, useRef } from "react";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { formatPercent } from "../core/format.js";
import { DIRECTION_COLORS } from "../core/palette.js";
import {
  distanceToSegment,
  durationDays,
  fibLevels,
  indexAtTime,
  measureRange,
  type StockAnchor,
  type StockDrawing,
  type StockTool,
  timeAtIndex,
} from "./stock-drawings.js";

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
const COLORS = {
  trend: "var(--chart-cat-2)",
  horizontal: "var(--chart-cat-3)",
  range: "var(--chart-cat-4)",
  fib: "var(--chart-cat-5)",
} as const;

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

function Handle({ x, y }: { x: number; y: number }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={4.5}
      strokeWidth={2}
      style={{ fill: "var(--surface)", stroke: "var(--ink)" }}
    />
  );
}

export function DrawingShape({
  drawing,
  geometry,
  selected,
  fmt,
  draft,
}: {
  drawing: StockDrawing;
  geometry: DrawingGeometry;
  selected: boolean;
  fmt: (value: number) => string;
  draft?: boolean;
}) {
  const width = selected ? 2.5 : 1.75;
  const dash = draft ? "4 3" : undefined;
  if (drawing.type === "horizontal") {
    const py = geometry.y(drawing.price);
    return (
      <g {...DECORATIVE}>
        <line
          x1={0}
          x2={geometry.innerWidth}
          y1={py}
          y2={py}
          strokeWidth={width}
          strokeDasharray={dash ?? "6 4"}
          style={{ stroke: COLORS.horizontal }}
        />
        <text
          x={6}
          y={py - 5}
          className="font-semibold text-[10.5px] tabular-nums"
          style={{ fill: COLORS.horizontal }}
        >
          {fmt(drawing.price)}
        </text>
      </g>
    );
  }
  const ax = xOfTime(geometry, drawing.a.time);
  const ay = geometry.y(drawing.a.price);
  const bx = xOfTime(geometry, drawing.b.time);
  const by = geometry.y(drawing.b.price);
  if (drawing.type === "trend") {
    return (
      <g {...DECORATIVE}>
        <line
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dash}
          style={{ stroke: COLORS.trend }}
        />
        {selected ? (
          <>
            <Handle x={ax} y={ay} />
            <Handle x={bx} y={by} />
          </>
        ) : null}
      </g>
    );
  }
  if (drawing.type === "range") {
    const change = drawing.a.price
      ? (drawing.b.price - drawing.a.price) / Math.abs(drawing.a.price)
      : 0;
    const left = Math.min(ax, bx);
    const top = Math.min(ay, by);
    return (
      <g {...DECORATIVE}>
        <rect
          x={left}
          y={top}
          width={Math.abs(bx - ax)}
          height={Math.abs(by - ay)}
          rx={3}
          strokeWidth={selected ? 2 : 1.25}
          strokeDasharray={dash}
          style={{ fill: COLORS.range, fillOpacity: 0.12, stroke: COLORS.range }}
        />
        <text
          x={left + 6}
          y={top + 14}
          className="font-bold text-[10.5px] tabular-nums"
          style={{ fill: COLORS.range }}
        >
          {change > 0 ? "+" : ""}
          {formatPercent(change)}
        </text>
        {selected ? (
          <>
            <Handle x={ax} y={ay} />
            <Handle x={bx} y={by} />
          </>
        ) : null}
      </g>
    );
  }
  const levels = fibLevels(drawing.a.price, drawing.b.price);
  const left = Math.max(0, Math.min(ax, bx));
  return (
    <g {...DECORATIVE}>
      <rect
        x={left}
        y={Math.min(ay, by)}
        width={Math.max(0, geometry.innerWidth - left)}
        height={Math.abs(by - ay)}
        style={{ fill: COLORS.fib, fillOpacity: 0.06 }}
      />
      {levels.map((level) => {
        const py = geometry.y(level.price);
        return (
          <g key={level.ratio}>
            <line
              x1={left}
              x2={geometry.innerWidth}
              y1={py}
              y2={py}
              strokeWidth={selected ? 1.75 : 1}
              strokeDasharray={level.ratio === 0 || level.ratio === 1 ? dash : (dash ?? "3 3")}
              style={{ stroke: COLORS.fib, strokeOpacity: 0.85 }}
            />
            <text
              x={geometry.innerWidth - 4}
              y={py - 4}
              textAnchor="end"
              className="font-semibold text-[10px] tabular-nums"
              style={{ fill: COLORS.fib }}
            >
              {level.ratio} · {fmt(level.price)}
            </text>
          </g>
        );
      })}
      {selected ? (
        <>
          <Handle x={ax} y={ay} />
          <Handle x={bx} y={by} />
        </>
      ) : null}
    </g>
  );
}

/** The ruler: a dashed box between the two ends and a label with the change, bars and days. */
export function MeasureShape({
  a,
  b,
  geometry,
  texts,
}: {
  a: StockAnchor;
  b: StockAnchor;
  geometry: DrawingGeometry;
  texts: DrawingTexts;
}) {
  const measure = measureRange(geometry.times, a, b);
  const color = measure.change >= 0 ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
  const ax = xOfTime(geometry, a.time);
  const bx = xOfTime(geometry, b.time);
  const ay = geometry.y(a.price);
  const by = geometry.y(b.price);
  const label = `${measure.percent > 0 ? "+" : ""}${formatPercent(measure.percent)} · ${measure.bars} ${texts.bars} · ${durationDays(measure.duration)} ${texts.days}`;
  const boxWidth = estimateTextWidth(label) + 16;
  const boxX = Math.max(0, Math.min(geometry.innerWidth - boxWidth, (ax + bx) / 2 - boxWidth / 2));
  const boxY = Math.max(0, Math.min(geometry.priceHeight - 22, Math.min(ay, by) - 28));
  return (
    <g {...DECORATIVE}>
      <rect
        x={Math.min(ax, bx)}
        y={Math.min(ay, by)}
        width={Math.abs(bx - ax)}
        height={Math.abs(by - ay)}
        strokeDasharray="4 3"
        style={{ fill: color, fillOpacity: 0.1, stroke: color }}
      />
      <line x1={ax} y1={ay} x2={bx} y2={by} strokeWidth={1.5} style={{ stroke: color }} />
      <rect x={boxX} y={boxY} width={boxWidth} height={22} rx={6} style={{ fill: color }} />
      <text
        x={boxX + boxWidth / 2}
        y={boxY + 11}
        dy="0.34em"
        textAnchor="middle"
        className="font-bold text-[10.5px] tabular-nums"
        style={{ fill: "var(--surface)" }}
      >
        {label}
      </text>
    </g>
  );
}

export interface DrawingInputProps {
  tool: Exclude<StockTool, "cursor">;
  geometry: DrawingGeometry;
  left: number;
  top: number;
  onCreate: (drawing: StockDrawing) => void;
  onDone: () => void;
  onDraft: (state: { tool: StockTool; a: StockAnchor; b: StockAnchor } | null) => void;
  /** Called when a measure drag ends, so the label stays until the next gesture. */
  onMeasure: (state: { a: StockAnchor; b: StockAnchor } | null) => void;
  label: string;
}

let counter = 0;
export function newDrawingId(): string {
  counter += 1;
  return `d${Date.now().toString(36)}${counter}`;
}

/**
 * Transparent layer over the price pane while a tool is armed: press, drag and
 * release draws a two-point shape; a horizontal line is a single click.
 */
export function DrawingInput({
  tool,
  geometry,
  left,
  top,
  onCreate,
  onDone,
  onDraft,
  onMeasure,
  label,
}: DrawingInputProps) {
  const start = useRef<{ anchor: StockAnchor; x: number; y: number } | null>(null);
  const local = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const origin = start.current;
    start.current = null;
    onDraft(null);
    if (!origin || !commit) return;
    const point = local(event);
    const end = anchorAt(geometry, point.x, point.y);
    const moved = Math.hypot(point.x - origin.x, point.y - origin.y) > 6;
    if (!moved) return;
    if (tool === "measure") {
      onMeasure({ a: origin.anchor, b: end });
      return;
    }
    if (tool === "horizontal") return;
    onCreate({ id: newDrawingId(), type: tool, a: origin.anchor, b: end });
    onDone();
  };
  return (
    <div
      role="presentation"
      aria-label={label}
      className="absolute cursor-crosshair touch-none"
      style={{ left, top, width: geometry.innerWidth, height: geometry.priceHeight }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = local(event);
        const anchor = anchorAt(geometry, point.x, point.y);
        onMeasure(null);
        if (tool === "horizontal") {
          onCreate({ id: newDrawingId(), type: "horizontal", price: anchor.price });
          onDone();
          return;
        }
        start.current = { anchor, x: point.x, y: point.y };
        onDraft({ tool, a: anchor, b: anchor });
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin) return;
        const point = local(event);
        onDraft({ tool, a: origin.anchor, b: anchorAt(geometry, point.x, point.y) });
      }}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, false)}
    />
  );
}
