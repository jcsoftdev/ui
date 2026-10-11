"use client";

import { isValidElement, type ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";

export interface ErrorStateProps {
  /** Short headline. Wins over `message` as the headline when both are given. */
  title?: ReactNode;
  /** Explanation under the headline, in plain language. */
  description?: ReactNode;
  /** Headline when `title` is absent (kept for source compatibility). */
  message?: ReactNode;
  /** Correlation code for support; never a raw exception. */
  correlationId?: ReactNode;
  /** Prefix shown before the correlation id. */
  correlationLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title,
  description,
  message,
  correlationId,
  correlationLabel,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  const strings = useUiStrings();
  const headline = displayable(title) ?? displayable(message) ?? strings.somethingWrong;
  const detail =
    displayable(description) ?? (title === undefined ? undefined : displayable(message));
  return (
    <div
      role="alert"
      className={cn(
        "@container/state flex min-w-0 flex-col items-center gap-2 px-4 py-8 text-center @min-[360px]/state:px-6 @min-[360px]/state:py-10",
        className,
      )}
    >
      <p className="max-w-full font-semibold text-fs-140 text-ink [overflow-wrap:anywhere]">
        {headline}
      </p>
      {detail ? (
        <p className="max-w-[42ch] text-fs-130 text-ink-3 [overflow-wrap:anywhere]">{detail}</p>
      ) : null}
      {correlationId ? (
        <p className="max-w-full text-fs-115 text-ink-3 tabular-nums [overflow-wrap:anywhere]">
          {correlationLabel ?? strings.correlationPrefix} {correlationId}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex h-control-sm cursor-pointer items-center rounded-input border-control bg-surface-control px-3 font-semibold text-fs-130 text-ink hover:bg-surface-2"
        >
          {retryLabel ?? strings.retry}
        </button>
      ) : null}
    </div>
  );
}

/** Strings, numbers and elements render; an Error or any other object is never shown raw. */
function displayable(value: ReactNode): ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") return undefined;
  if (typeof value === "string" || typeof value === "number") return value;
  if (isValidElement(value) || Array.isArray(value)) return value;
  return undefined;
}
