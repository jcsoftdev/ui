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
      className={cn(
        "@container/state flex min-w-0 flex-col items-center gap-2 px-4 py-8 text-center @min-[360px]/state:px-6 @min-[360px]/state:py-10",
        className,
      )}
    >
      <p className="max-w-full font-semibold text-[14px] text-ink [overflow-wrap:anywhere]">
        {message}
      </p>
      {correlationId ? (
        <p className="max-w-full text-[11.5px] text-ink-3 tabular-nums [overflow-wrap:anywhere]">
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
