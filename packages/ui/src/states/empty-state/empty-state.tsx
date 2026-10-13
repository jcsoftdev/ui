import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface EmptyStateProps {
  /** Decorative icon; hidden from screen readers. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action. */
  action?: ReactNode;
  /** `outlined` draws a dashed border around the state. */
  variant?: "plain" | "outlined";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "plain",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "@container/empty flex min-w-0 flex-col items-center gap-2 px-4 py-8 text-center @min-[360px]/empty:px-6 @min-[360px]/empty:py-12",
        variant === "outlined" && "rounded-card border border-line-control border-dashed",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="text-ink-3">
          {icon}
        </span>
      ) : null}
      <p className="max-w-full font-semibold text-fs-140 text-ink [overflow-wrap:anywhere]">
        {title}
      </p>
      {description ? (
        <p className="max-w-[42ch] text-fs-130 text-ink-3 [overflow-wrap:anywhere]">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-2 flex max-w-full flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
