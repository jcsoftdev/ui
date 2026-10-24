"use client";

import { type ComponentPropsWithoutRef, useMemo } from "react";
import { Button } from "../../atoms/button/button.js";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";
import { formatRange } from "./range.js";

export interface CursorPaginationLabels {
  nav: string;
  /** `{first}` and `{last}` are replaced. */
  range: string;
  previous: string;
  next: string;
}

export interface CursorPaginationProps
  extends Omit<ComponentPropsWithoutRef<"nav">, "children" | "onChange"> {
  /** 1-based page the cursor trail is on. */
  page: number;
  /** Rows on this page. */
  count: number;
  /** Rows per page, to number the range. Default 25. */
  pageSize?: number;
  /** Whether the server reported a next cursor. */
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Texts (localized by default through `UiStrings`). */
  labels?: Partial<CursorPaginationLabels>;
}

/**
 * Footer for server-side cursor paging, where the total is unknown: the range on screen ("Showing
 * 26–50") and Previous / Next. Keep the cursor trail yourself; this only reports the clicks. It
 * renders nothing while the whole list fits on the first page.
 */
export function CursorPagination({
  page,
  count,
  pageSize = 25,
  hasNext,
  onPrevious,
  onNext,
  labels,
  className,
  ...props
}: CursorPaginationProps) {
  const strings = useUiStrings();
  const format = useMemo(() => new Intl.NumberFormat(strings.locale), [strings.locale]);
  if (page <= 1 && !hasNext) return null;
  const first = (Math.max(1, page) - 1) * pageSize + 1;
  const last = first + Math.max(count, 1) - 1;
  return (
    <nav
      aria-label={labels?.nav ?? strings.pagination}
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-fs-125 text-ink-2",
        className,
      )}
      {...props}
    >
      <span aria-live="polite" className="tabular-nums">
        {formatRange(labels?.range ?? strings.showingRangeOpen, {
          first: format.format(first),
          last: format.format(last),
        })}
      </span>
      <span className="flex items-center gap-1">
        <Button size="sm" disabled={page <= 1} onClick={onPrevious}>
          {labels?.previous ?? strings.previous}
        </Button>
        <Button size="sm" disabled={!hasNext} onClick={onNext}>
          {labels?.next ?? strings.next}
        </Button>
      </span>
    </nav>
  );
}
