import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import type { LegendShape } from "./legend.js";

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
  /** Width of the container; the tooltip flips to the left of the anchor past 60%. */
  containerWidth: number;
  title?: ReactNode;
  rows: readonly TooltipRow[];
  className?: string;
}

/**
 * Floating card that lists every series at the hovered position. Purely
 * visual (`aria-hidden`): screen readers get the same numbers from the live
 * region and the hidden data table. Moves with a GPU transform, so following
 * the pointer never triggers layout.
 */
export function ChartTooltip({ x, y, containerWidth, title, rows, className }: ChartTooltipProps) {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-10 min-w-[148px] max-w-[260px] rounded-event bg-float px-3 py-2.5 text-[12px] shadow-pop",
        "motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out",
        className,
      )}
      style={{
        transform: `translate3d(${Math.round(x + (flip ? -14 : 14))}px, ${Math.round(y)}px, 0)${
          flip ? " translateX(-100%)" : ""
        } translateY(-50%)`,
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
