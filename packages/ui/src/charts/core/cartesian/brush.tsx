"use client";

import { type KeyboardEvent, type PointerEvent, useMemo, useRef } from "react";
import { cn } from "../../../utils/cn.js";
import { areaPath, linePath, type Point } from "../path.js";
import { pointScale } from "../scales/band.js";
import { extent } from "../scales/linear.js";

export type IndexRange = readonly [number, number];

export interface ChartBrushProps {
  /** Total number of categories (the full, un-zoomed data). */
  count: number;
  /** Full-length series drawn as the overview. */
  series: ReadonlyArray<{ id: string; color: string; data: ReadonlyArray<number | null> }>;
  /** Selected window, inclusive indices. */
  range: IndexRange;
  onChange: (range: IndexRange) => void;
  width: number;
  /** Align with the plot above. */
  left: number;
  right: number;
  height?: number;
  label: string;
  /** Text for screen readers describing the window, e.g. "6 oct – 20 oct". */
  valueText: string;
  className?: string;
}

type DragMode =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "move"; offset: number }
  | { kind: "new"; anchor: number };

const MIN_SPAN = 1;

/**
 * Overview of the whole series with a draggable window. Drag the window to
 * pan, its handles to resize, or anywhere outside to draw a new window.
 * Keyboard: arrows pan, Shift+arrows resize the end, Home/End jump.
 */
export function ChartBrush({
  count,
  series,
  range,
  onChange,
  width,
  left,
  right,
  height = 52,
  label,
  valueText,
  className,
}: ChartBrushProps) {
  const innerWidth = Math.max(10, width - left - right);
  const scale = useMemo(() => pointScale({ count, range: [0, innerWidth] }), [count, innerWidth]);
  const drag = useRef<DragMode | null>(null);
  const latest = useRef<IndexRange>(range);
  latest.current = range;

  const paths = useMemo(() => {
    const domain = extent(series.flatMap((item) => item.data)) ?? [0, 1];
    const lo = Math.min(0, domain[0]);
    const span = domain[1] - lo || 1;
    const y = (value: number) => height - 6 - ((value - lo) / span) * (height - 14);
    return series.map((item, index) => {
      const points: Array<Point | null> = item.data.map((value, i) =>
        value == null ? null : { x: scale.center(i), y: y(value) },
      );
      const bottom = points.map((point, i) => ({ x: point?.x ?? scale.center(i), y: height - 6 }));
      return {
        id: item.id,
        color: item.color,
        line: linePath(points, "smooth"),
        area: index === 0 ? areaPath(points, bottom, "smooth") : undefined,
      };
    });
  }, [series, scale, height]);

  const [start, end] = range;
  const x0 = scale.center(start);
  const x1 = scale.center(end);
  const clampRange = (a: number, b: number): IndexRange => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(count - 1, Math.max(a, b));
    if (hi - lo >= MIN_SPAN) return [lo, hi];
    return lo + MIN_SPAN <= count - 1 ? [lo, lo + MIN_SPAN] : [Math.max(0, hi - MIN_SPAN), hi];
  };

  const localX = (event: PointerEvent<SVGSVGElement>) =>
    event.clientX - event.currentTarget.getBoundingClientRect().left - left;

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const x = localX(event);
    if (Math.abs(x - x0) <= 10) drag.current = { kind: "start" };
    else if (Math.abs(x - x1) <= 10) drag.current = { kind: "end" };
    else if (x > x0 && x < x1) drag.current = { kind: "move", offset: scale.indexAt(x) - start };
    else drag.current = { kind: "new", anchor: scale.indexAt(x) };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const mode = drag.current;
    if (!mode) return;
    const index = scale.indexAt(localX(event));
    if (mode.kind === "start") onChange(clampRange(Math.min(index, end - MIN_SPAN), end));
    else if (mode.kind === "end") onChange(clampRange(start, Math.max(index, start + MIN_SPAN)));
    else if (mode.kind === "new") onChange(clampRange(mode.anchor, index));
    else {
      const span = end - start;
      const lo = Math.min(Math.max(0, index - mode.offset), count - 1 - span);
      if (lo !== start) onChange([lo, lo + span]);
    }
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Read the latest window: key repeats can arrive before the parent re-renders.
    const [from, to] = latest.current;
    const span = to - from;
    const emit = (next: IndexRange) => {
      latest.current = next;
      onChange(next);
    };
    const stepBy = (delta: number) => {
      if (event.shiftKey) return emit(clampRange(from, Math.max(from + MIN_SPAN, to + delta)));
      const lo = Math.min(Math.max(0, from + delta), count - 1 - span);
      emit([lo, lo + span]);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowUp") stepBy(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") stepBy(-1);
    else if (event.key === "Home") emit([0, span]);
    else if (event.key === "End") emit([count - 1 - span, count - 1]);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={start}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-full touch-none select-none rounded-event outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2",
        className,
      )}
      style={{ height }}
    >
      <svg
        aria-hidden="true"
        width={width}
        height={height}
        className="block cursor-crosshair overflow-visible"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g transform={`translate(${left},0)`}>
          <rect
            x={0}
            y={0.5}
            width={innerWidth}
            height={height - 1}
            rx={10}
            style={{ fill: "var(--surface-2)", fillOpacity: 0.5 }}
          />
          {paths.map((path) => (
            <g key={path.id}>
              {path.area ? (
                <path d={path.area} style={{ fill: path.color, fillOpacity: 0.14 }} />
              ) : null}
              <path
                d={path.line}
                fill="none"
                strokeWidth={1.25}
                style={{ stroke: path.color, strokeOpacity: 0.85 }}
              />
            </g>
          ))}
          <rect
            x={0}
            y={0}
            width={Math.max(0, x0)}
            height={height}
            style={{ fill: "var(--surface)", fillOpacity: 0.72 }}
          />
          <rect
            x={x1}
            y={0}
            width={Math.max(0, innerWidth - x1)}
            height={height}
            style={{ fill: "var(--surface)", fillOpacity: 0.72 }}
          />
          <rect
            x={x0}
            y={0.5}
            width={Math.max(0, x1 - x0)}
            height={height - 1}
            rx={8}
            className="cursor-grab"
            strokeWidth={1.25}
            style={{ fill: "var(--accent)", fillOpacity: 0.1, stroke: "var(--accent-word)" }}
          />
          {[x0, x1].map((x, index) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: always two handles, start then end.
              key={index}
              x={x - 4}
              y={height / 2 - 12}
              width={8}
              height={24}
              rx={4}
              className="cursor-ew-resize"
              strokeWidth={1.25}
              style={{ fill: "var(--float)", stroke: "var(--accent-word)" }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
