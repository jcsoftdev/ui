import { cn } from "../../utils/cn.js";

export type SkeletonVariant = "lines" | "table" | "card";

const PLACEHOLDER_IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] as const;

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Number of lines for the `lines` variant. */
  lines?: number;
  /** Number of rows for the `table` variant. */
  rows?: number;
  /** Text announced to screen readers while loading. */
  label?: string;
  className?: string;
}

export function Skeleton({
  variant = "lines",
  lines = 3,
  rows = 4,
  label = "Loading",
  className,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("animate-pulse", className)}
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
    </div>
  );
}
