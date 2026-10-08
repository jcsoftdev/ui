"use client";

import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface ErrorStateProps {
  message: ReactNode;
  /** Correlation code for support; never a raw exception. */
  correlationId?: ReactNode;
  /** Prefix shown before the correlation id. */
  correlationLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  message,
  correlationId,
  correlationLabel = "ID:",
  onRetry,
  retryLabel = "Retry",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}
    >
      <p className="font-semibold text-[14px] text-ink">{message}</p>
      {correlationId ? (
        <p className="text-[11.5px] text-ink-3 tabular-nums">
          {correlationLabel} {correlationId}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex h-control-height-sm cursor-pointer items-center rounded-control border border-line-control bg-surface px-3 font-semibold text-[13px] text-ink hover:bg-surface-2"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
