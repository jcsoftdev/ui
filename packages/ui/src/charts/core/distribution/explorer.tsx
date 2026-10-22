"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { cn } from "../../../utils/cn.js";
import { TOUCH_TARGET } from "../chart-dock.js";
import type { PlotMargin } from "./layout.js";

export interface PlotExplorerProps {
  /** Number of explorable items (boxes, bins, points), in reading order. */
  count: number;
  active: number | null;
  onActiveChange: (index: number | null) => void;
  /**
   * Item under a plot-relative pixel, or null. `radius` is set for a finger: snap to the nearest
   * item within that many pixels instead of the chart's own, tighter mouse tolerance.
   */
  pick: (x: number, y: number, radius?: number) => number | null;
  /** Accessible name, e.g. `labels.explore`. */
  label: string;
  /** What a screen reader announces for the active item. */
  valueText: string;
  margin: PlotMargin;
  width: number;
  height: number;
  className?: string;
}

/**
 * Transparent overlay that owns pointer and keyboard exploration of a plot:
 * a focusable `role="slider"` (arrows move, Home/End jump, Escape clears),
 * the same contract as the cartesian charts.
 */
export function PlotExplorer({
  count,
  active,
  onActiveChange,
  pick,
  label,
  valueText,
  margin,
  width,
  height,
  className,
}: PlotExplorerProps) {
  // Fast key repeats can arrive before the next render: read the latest index from a ref.
  const latest = useRef(active);
  latest.current = active;
  const change = (index: number | null) => {
    latest.current = index;
    onActiveChange(index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const last = count - 1;
    const current = latest.current ?? -1;
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(last, current + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "PageDown") next = Math.min(last, current + 10);
    else if (event.key === "PageUp") next = Math.max(0, current - 10);
    else if (event.key === "Escape") {
      change(null);
      return;
    } else return;
    event.preventDefault();
    change(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = event.pointerType === "touch" ? TOUCH_TARGET : undefined;
    change(pick(event.clientX - rect.left, event.clientY - rect.top, radius));
  };

  return (
    <div
      role="slider"
      tabIndex={count > 0 ? 0 : -1}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={Math.max(1, count)}
      aria-valuenow={(active ?? 0) + 1}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (latest.current == null && count > 0 && event.currentTarget.matches(":focus-visible"))
          change(0);
      }}
      onBlur={() => change(null)}
      onPointerMove={onPointerMove}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") onPointerMove(event);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") change(null);
      }}
      className={cn(
        "absolute cursor-default rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
        className,
      )}
      style={{ left: margin.left, top: margin.top, width, height }}
    />
  );
}
