"use client";

import { type ReactNode, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import type { LegendShape } from "./legend.js";
import { useIsomorphicLayoutEffect } from "./use-chart-size.js";

const OFFSET = 14;
const EDGE = 4;

export interface TooltipRow {
  id: string;
  name: string;
  value: string;
  color: string;
  shape?: LegendShape;
  /** Secondary text after the value, e.g. a share "(32%)". */
  note?: string;
  /** Rendered bold and separated, e.g. a total. */
  emphasis?: boolean;
}

export interface ChartTooltipProps {
  /** Anchor in pixels, relative to the positioned chart container. */
  x: number;
  y: number;
  /** Width of the container; the tooltip prefers the left of the anchor past 60% and never leaves it. */
  containerWidth: number;
  title?: ReactNode;
  rows: readonly TooltipRow[];
  className?: string;
}

/**
 * Floating card that lists every series at the hovered position. Purely
 * visual (`aria-hidden`): screen readers get the same numbers from the live
 * region and the hidden data table. Moves with a GPU transform, so following
 * the pointer never triggers layout. Its own width is measured so the card
 * always stays inside the container: it takes the side of the anchor with
 * room, and is clamped to the edges when neither side fits (narrow charts).
 */
export function ChartTooltip({ x, y, containerWidth, title, rows, className }: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const next = ref.current?.offsetWidth ?? 0;
    if (Math.abs(next - size) > 0.5) setSize(next);
  });
  const left = tooltipLeft(x, size, containerWidth);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-10 min-w-[120px] rounded-event bg-float px-3 py-2.5 text-[12px] shadow-pop",
        "motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out",
        className,
      )}
      style={{
        maxWidth: Math.max(120, Math.min(260, containerWidth - EDGE * 2)),
        transform: `translate3d(${Math.round(left)}px, ${Math.round(y)}px, 0) translateY(-50%)`,
      }}
    >
      {title ? <div className="mb-1.5 font-bold text-[12px] text-ink">{title}</div> : null}
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "flex items-center gap-2 text-ink-2",
              row.emphasis && "mt-0.5 border-line border-t pt-1.5 text-ink",
            )}
          >
            {row.emphasis ? (
              <span className="w-2.5 shrink-0" />
            ) : (
              <span
                className={cn(
                  "size-2.5 shrink-0",
                  row.shape === "line" || row.shape === "dashed" || row.shape === "dot"
                    ? "rounded-pill"
                    : "rounded-[3px]",
                )}
                style={{ background: row.color }}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="font-bold text-ink tabular-nums">{row.value}</span>
            {row.note ? <span className="text-ink-3 tabular-nums">{row.note}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Left edge of a tooltip `width` wide next to anchor `x`, kept inside `containerWidth`. */
export function tooltipLeft(x: number, width: number, containerWidth: number): number {
  const right = x + OFFSET;
  const leftSide = x - OFFSET - width;
  const preferLeft = x > containerWidth * 0.6;
  const fitsRight = right + width <= containerWidth - EDGE;
  const fitsLeft = leftSide >= EDGE;
  const chosen =
    preferLeft && fitsLeft ? leftSide : fitsRight ? right : fitsLeft ? leftSide : right;
  return Math.max(EDGE, Math.min(chosen, containerWidth - width - EDGE));
}
