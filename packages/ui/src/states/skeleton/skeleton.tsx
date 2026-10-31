"use client";

import type { ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";

export type SkeletonVariant = "lines" | "table" | "card" | "list" | "kpis" | "key-value" | "bar";

const PLACEHOLDER_IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] as const;

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Number of lines for the `lines` variant. */
  lines?: number;
  /** Number of rows for the `table` variant. */
  rows?: number;
  /** Number of items for the `list`, `kpis` and `key-value` variants. Defaults to 4, at most 12. */
  count?: number;
  /** Text announced to screen readers while loading. */
  label?: string;
  /**
   * Classes on the root. The `bar` variant is one block sized by them (`h-8 w-32`), 12px tall and
   * full width otherwise.
   */
  className?: string;
}

/** A decorative placeholder bar; the status region around it carries the announcement. */
function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block h-3 rounded-xs bg-surface-2", className)} />;
}

function items(count: number, render: (id: string, index: number) => ReactNode): ReactNode[] {
  return PLACEHOLDER_IDS.slice(0, Math.max(0, count)).map((id, index) => render(id, index));
}

// None of the variants pads the inline edges: the container the skeleton sits in owns its inset,
// so the placeholder lines up with the content it stands in for.
export function Skeleton({
  variant = "lines",
  lines = 3,
  rows = 4,
  count = 4,
  label,
  className,
}: SkeletonProps) {
  const strings = useUiStrings();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? strings.loading}
      className={cn(
        "animate-pulse",
        variant === "bar" && "block h-3 w-full rounded-xs bg-surface-2",
        className,
      )}
    >
      {variant === "lines" ? (
        <div className="flex flex-col gap-2">
          {PLACEHOLDER_IDS.slice(0, lines).map((id, index) => (
            <div
              key={id}
              className="h-3 rounded-xs bg-surface-2"
              style={{ width: index === lines - 1 ? "60%" : "100%" }}
            />
          ))}
        </div>
      ) : null}
      {variant === "table" ? (
        <div className="flex flex-col gap-2">
          {PLACEHOLDER_IDS.slice(0, rows).map((id) => (
            <div key={id} className="h-9 rounded-xs bg-surface-2" />
          ))}
        </div>
      ) : null}
      {variant === "card" ? <div className="h-40 rounded-card bg-surface-2" /> : null}
      {variant === "list" ? (
        <div className="flex flex-col">
          {items(count, (id, index) => (
            <div
              key={id}
              className="grid min-h-[calc(2.75rem+0.75rem*var(--touch))] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b-divider py-2.5"
            >
              <span className="flex flex-col gap-1.5">
                <Bar className={index % 2 === 0 ? "w-2/5" : "w-1/2"} />
                <Bar className="h-2.5 w-1/4" />
              </span>
              <Bar className="w-14" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === "kpis" ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(168px,100%),1fr))]">
          {items(count, (id) => (
            <div
              key={id}
              className="flex flex-col gap-2.5 rounded-card border-card bg-surface px-4 py-3.5"
            >
              <Bar className="w-1/2" />
              <Bar className="h-6.5 w-2/3" />
              <Bar className="w-1/3" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === "key-value" ? (
        <div className="grid gap-x-4 gap-y-2.5 py-3 [grid-template-columns:minmax(min(6.5rem,40%),10rem)_minmax(0,1fr)]">
          {items(count, (id, index) => (
            <div key={id} className="contents">
              <Bar className="w-3/4" />
              <Bar className={KEY_VALUE_WIDTHS[index % KEY_VALUE_WIDTHS.length]} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Decorative width rhythm so stacked values do not read as one block.
const KEY_VALUE_WIDTHS = ["w-11/12", "w-3/4", "w-5/6", "w-2/3"] as const;
