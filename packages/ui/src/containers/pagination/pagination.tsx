"use client";

import { type ComponentPropsWithoutRef, useId, useMemo } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { clampPage, formatPageRange, pageCount, pageRange } from "./range.js";

export { clampPage, formatPageRange, pageCount, pageRange } from "./range.js";

export interface PaginationLabels {
  nav: string;
  rowsPerPage: string;
  /** `{first}`, `{last}` and `{total}` are replaced. */
  range: string;
  first: string;
  previous: string;
  next: string;
  last: string;
}

export interface PaginationProps extends Omit<ComponentPropsWithoutRef<"nav">, "onChange"> {
  /** Total rows across every page. */
  total: number;
  /** Controlled 1-based page. Pair it with `onPageChange`. */
  page?: number;
  /** Initial page when uncontrolled. Default 1. */
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Controlled rows per page. Pair it with `onPageSizeChange`. */
  pageSize?: number;
  /** Initial rows per page when uncontrolled. Default: the first of `pageSizeOptions`. */
  defaultPageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  /** Choices of the page size picker. Default `[10, 25, 50, 100]`; a single option hides the picker. */
  pageSizeOptions?: readonly number[];
  /** Texts (localized by default through `UiStrings`). */
  labels?: Partial<PaginationLabels>;
}

const DEFAULT_OPTIONS = [10, 25, 50, 100] as const;

const stepButton =
  "grid size-8 place-items-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4";

/**
 * Footer of a list or table: rows per page, the range shown ("11–20 of 134") and first, previous,
 * next and last buttons. Pages are 1-based. It does not slice your rows: use `page` and `pageSize`
 * to do that, or to request the page from your API. Changing the page size returns to page 1.
 */
export function Pagination({
  total,
  page,
  defaultPage = 1,
  onPageChange,
  pageSize,
  defaultPageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_OPTIONS,
  labels,
  className,
  ...props
}: PaginationProps) {
  const strings = useUiStrings();
  const selectId = useId();
  const [size, setSize] = useControllableState<number>({
    prop: pageSize,
    defaultProp: defaultPageSize ?? pageSizeOptions[0] ?? DEFAULT_OPTIONS[0],
    onChange: onPageSizeChange,
  });
  const [current, setPage] = useControllableState<number>({
    prop: page,
    defaultProp: defaultPage,
    onChange: onPageChange,
  });
  const text: PaginationLabels = {
    nav: labels?.nav ?? strings.pagination,
    rowsPerPage: labels?.rowsPerPage ?? strings.rowsPerPage,
    range: labels?.range ?? strings.pageRange,
    first: labels?.first ?? strings.firstPage,
    previous: labels?.previous ?? strings.previousPage,
    next: labels?.next ?? strings.nextPage,
    last: labels?.last ?? strings.lastPage,
  };
  const pages = pageCount(total, size);
  const at = clampPage(current, pages);
  const { first, last } = pageRange(at, size, total);
  const format = useMemo(() => new Intl.NumberFormat(strings.locale), [strings.locale]);
  const sizes = [...new Set([...pageSizeOptions, size])].sort((a, b) => a - b);
  const atStart = at <= 1;
  const atEnd = at >= pages;
  return (
    <nav
      aria-label={text.nav}
      className={cn(
        "@container/pagination flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 px-2 py-1.5 text-fs-125 text-ink-2",
        className,
      )}
      {...props}
    >
      {sizes.length > 1 ? (
        <span className="flex items-center gap-2">
          <label htmlFor={selectId}>{text.rowsPerPage}</label>
          <select
            id={selectId}
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-control-sm rounded-input border-control bg-surface-control px-1.5 text-fs-125 text-ink"
          >
            {sizes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </span>
      ) : null}
      <span aria-live="polite" className="tabular-nums">
        {formatPageRange(text.range, {
          first: format.format(first),
          last: format.format(last),
          total: format.format(Math.max(0, total)),
        })}
      </span>
      <span className="flex items-center">
        <button
          type="button"
          className={stepButton}
          aria-label={text.first}
          disabled={atStart}
          onClick={() => setPage(1)}
        >
          <ChevronsLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={stepButton}
          aria-label={text.previous}
          disabled={atStart}
          onClick={() => setPage(at - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={stepButton}
          aria-label={text.next}
          disabled={atEnd}
          onClick={() => setPage(at + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={stepButton}
          aria-label={text.last}
          disabled={atEnd}
          onClick={() => setPage(pages)}
        >
          <ChevronsRight aria-hidden="true" />
        </button>
      </span>
    </nav>
  );
}
