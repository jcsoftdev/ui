"use client";

import { type KeyboardEvent, type PointerEvent, useState } from "react";
import { cn } from "../../utils/cn.js";

export interface CategoryExplorerOptions {
  count: number;
  /** Hidden categories are skipped by the keyboard and ignored by the pointer. */
  isAvailable?: (index: number) => boolean;
  /** Tooltip anchor (container pixels) when a category is chosen with the keyboard. */
  anchor: (index: number) => { x: number; y: number } | null;
}

export interface CategoryExplorer {
  /** Category under the pointer or the keyboard cursor. */
  active: number | null;
  /** Where the tooltip goes, relative to the chart container. */
  position: { x: number; y: number } | null;
  /** Spread on the `<svg>`; marks carry `data-category={index}`. */
  pointerProps: {
    onPointerMove: (event: PointerEvent<Element>) => void;
    onPointerLeave: () => void;
  };
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Hover and keyboard cursor for charts whose marks belong to categories
 * (units, cells, seats, rows). The pointer finds the category through the
 * nearest `[data-category]` ancestor of the hovered mark, so no mark needs its
 * own handlers; the keyboard moves between available categories.
 */
export function useCategoryExplorer({
  count,
  isAvailable = () => true,
  anchor,
}: CategoryExplorerOptions): CategoryExplorer {
  const [active, setActive] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const available: number[] = [];
  for (let index = 0; index < count; index += 1) if (isAvailable(index)) available.push(index);

  const clear = () => {
    setActive(null);
    setPointer(null);
  };

  const onPointerMove = (event: PointerEvent<Element>) => {
    const target = event.target as Element | null;
    const hit = target?.closest?.("[data-category]");
    const index = hit ? Number(hit.getAttribute("data-category")) : Number.NaN;
    if (!Number.isInteger(index) || !available.includes(index)) {
      clear();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(index);
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!available.length) return;
    const at = active == null ? -1 : available.indexOf(active);
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = Math.min(available.length - 1, at + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = Math.max(0, at - 1);
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = available.length - 1;
    else if (event.key === "Escape") {
      clear();
      return;
    } else return;
    event.preventDefault();
    setPointer(null);
    setActive(available[next] ?? null);
  };

  const shown = active != null && available.includes(active) ? active : null;
  return {
    active: shown,
    position: shown == null ? null : (pointer ?? anchor(shown)),
    pointerProps: { onPointerMove, onPointerLeave: clear },
    onKeyDown,
    onFocus: () => setActive((current) => current ?? available[0] ?? null),
    onBlur: clear,
  };
}

export interface CategorySliderProps {
  explorer: CategoryExplorer;
  label: string;
  count: number;
  /** What a screen reader hears for the current category. */
  valueText: string;
  className?: string;
}

/**
 * Focusable keyboard layer laid over the drawing. It ignores the pointer
 * (`pointer-events: none`), so hovering still reaches the marks underneath.
 */
export function CategorySlider({
  explorer,
  label,
  count,
  valueText,
  className,
}: CategorySliderProps) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={Math.max(1, count)}
      aria-valuenow={(explorer.active ?? 0) + 1}
      aria-valuetext={valueText}
      onKeyDown={explorer.onKeyDown}
      onFocus={explorer.onFocus}
      onBlur={explorer.onBlur}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
        className,
      )}
    />
  );
}
