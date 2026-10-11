"use client";

import { cn } from "../../utils/cn.js";

export type LegendShape = "line" | "dashed" | "square" | "dot";

export interface LegendItem {
  id: string;
  name: string;
  color: string;
  shape?: LegendShape;
  hidden?: boolean;
}

export interface ChartLegendProps {
  items: readonly LegendItem[];
  /** Click toggles a series. Omit for a read-only legend. */
  onToggle?: (id: string) => void;
  /** Hover or focus of an item, `null` when leaving: used to dim the other series. */
  onHighlight?: (id: string | null) => void;
  align?: "start" | "end" | "center";
  className?: string;
}

function Swatch({ color, shape = "square" }: { color: string; shape?: LegendShape }) {
  if (shape === "line" || shape === "dashed") {
    return (
      <svg aria-hidden="true" width="16" height="8" className="shrink-0 overflow-visible">
        <line
          x1="1"
          x2="15"
          y1="4"
          y2="4"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={shape === "dashed" ? "3 3.5" : undefined}
          style={{ stroke: color }}
        />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0", shape === "dot" ? "rounded-pill" : "rounded-xs")}
      style={{ background: color }}
    />
  );
}

/**
 * Series legend. Each item is a toggle button (`aria-pressed`), so hiding a
 * series works with mouse, touch and keyboard; hovering or focusing one dims
 * the rest of the chart.
 */
export function ChartLegend({
  items,
  onToggle,
  onHighlight,
  align = "start",
  className,
}: ChartLegendProps) {
  const visibleCount = items.filter((item) => !item.hidden).length;
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-wrap gap-x-1 gap-y-0.5 p-0",
        align === "end" && "justify-end",
        align === "center" && "justify-center",
        className,
      )}
    >
      {items.map((item) => {
        const content = (
          <>
            <Swatch color={item.color} shape={item.shape} />
            <span className="truncate">{item.name}</span>
          </>
        );
        const itemClass = cn(
          "inline-flex max-w-[220px] items-center gap-1.5 rounded-pill px-2 py-1 font-semibold text-fs-120 text-ink-2 transition-[opacity,background-color] duration-150",
          item.hidden && "opacity-45 [&>span:last-child]:line-through",
        );
        return (
          <li key={item.id}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!item.hidden}
                disabled={!item.hidden && visibleCount <= 1}
                onClick={() => onToggle(item.id)}
                onPointerEnter={() => onHighlight?.(item.id)}
                onPointerLeave={() => onHighlight?.(null)}
                onFocus={() => onHighlight?.(item.id)}
                onBlur={() => onHighlight?.(null)}
                className={cn(
                  itemClass,
                  "cursor-pointer border-0 bg-transparent hover:bg-surface-2 hover:text-ink disabled:cursor-default disabled:hover:bg-transparent",
                )}
              >
                {content}
              </button>
            ) : (
              <span className={itemClass}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
