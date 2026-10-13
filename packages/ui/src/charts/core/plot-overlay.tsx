"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "../../utils/cn.js";

export interface PlotPointer {
  /** Pointer position relative to the plot, in pixels. */
  x: number;
  y: number;
}

export interface PlotOverlayProps {
  /** Position and size of the plot inside the chart container. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Accessible name (`labels.explore`). */
  label: string;
  /** Number of explorable points. */
  count: number;
  /** Active point, or null. */
  active: number | null;
  /** Reads the active point aloud: category and values. */
  valueText: string;
  onActiveChange: (index: number | null) => void;
  /** Maps a plot-relative pointer to a point; return null to clear (hit-testing charts). */
  indexAt: (pointer: PlotPointer) => number | null;
  /** Which arrow keys step through the points. "both" maps Right/Down to next and Left/Up to previous. */
  keys?: "horizontal" | "vertical" | "both";
  /** Extra key handling, e.g. switching streams with Up/Down. Return true when handled. */
  onKey?: (event: KeyboardEvent<HTMLDivElement>) => boolean;
  className?: string;
}

/**
 * Transparent, focusable layer over a plot: one place for pointer hover and
 * keyboard exploration, shared by the non-cartesian charts. It is a
 * `role="slider"` so assistive tech announces `valueText` as the arrows move.
 * Arrows step, Home/End jump, Escape clears.
 */
export function PlotOverlay({
  left,
  top,
  width,
  height,
  label,
  count,
  active,
  valueText,
  onActiveChange,
  indexAt,
  keys = "horizontal",
  onKey,
  className,
}: PlotOverlayProps) {
  const local = (event: PointerEvent<HTMLDivElement>): PlotPointer => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const move = (delta: number) => {
    const from = active ?? (delta > 0 ? -1 : count);
    onActiveChange(Math.min(count - 1, Math.max(0, from + delta)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onKey?.(event)) {
      event.preventDefault();
      return;
    }
    const next =
      (keys !== "vertical" && event.key === "ArrowRight") ||
      (keys !== "horizontal" && event.key === "ArrowDown");
    const previous =
      (keys !== "vertical" && event.key === "ArrowLeft") ||
      (keys !== "horizontal" && event.key === "ArrowUp");
    if (next) move(1);
    else if (previous) move(-1);
    else if (event.key === "Home") onActiveChange(0);
    else if (event.key === "End") onActiveChange(count - 1);
    else if (event.key === "Escape") onActiveChange(null);
    else return;
    event.preventDefault();
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={Math.max(1, count)}
      aria-valuenow={(active ?? 0) + 1}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) onActiveChange(active ?? 0);
      }}
      onBlur={() => onActiveChange(null)}
      onPointerMove={(event) => onActiveChange(indexAt(local(event)))}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") onActiveChange(indexAt(local(event)));
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onActiveChange(null);
      }}
      className={cn(
        "absolute rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
        className,
      )}
      style={{ left, top, width, height }}
    />
  );
}
