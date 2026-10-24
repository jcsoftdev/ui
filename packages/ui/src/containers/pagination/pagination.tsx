"use client";

import { type ComponentPropsWithoutRef, useId, useMemo } from "react";
import { Button } from "../../atoms/button/button.js";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import {
  clampPage,
  formatPageRange,
  formatRange,
  pageCount,
  pageItems,
  pageRange,
} from "./range.js";

export {
  clampPage,
  formatPageRange,
  formatRange,
  type PageItem,
  pageCount,
  pageItems,
  pageRange,
} from "./range.js";

export interface PaginationLabels {
  nav: string;
  rowsPerPage: string;
  /** `{first}`, `{last}` and `{total}` are replaced. */
  range: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  /** Range text of the `pages` variant; `{first}`, `{last}` and `{total}` are replaced. */
  showing: string;
  /** Visible label of the previous button of the `pages` variant. */
  previousLabel: string;
  /** Visible label of the next button of the `pages` variant. */
  nextLabel: string;
  /** Name of a page number button; `{page}` is replaced. */
  pageNumber: string;
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
  /**
   * `default`: rows per page, the range and first/previous/next/last icon buttons. `pages`: the
   * range ("Showing 1–25 of 134") and Previous, page number and Next buttons; it shows the page size
   * picker only when `pageSizeOptions` is passed with more than one option.
   */
  variant?: "default" | "pages";
  /** Renders nothing while every row fits on one page. Default `true` for `pages`, `false` otherwise. */
  hideOnSinglePage?: boolean;
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
  pageSizeOptions: pageSizeOptionsProp,
  labels,
  variant = "default",
  hideOnSinglePage = variant === "pages",
  className,
  ...props
}: PaginationProps) {
  const pageSizeOptions = pageSizeOptionsProp ?? DEFAULT_OPTIONS;
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
    showing: labels?.showing ?? strings.showingRange,
    previousLabel: labels?.previousLabel ?? strings.previous,
    nextLabel: labels?.nextLabel ?? strings.next,
    pageNumber: labels?.pageNumber ?? strings.pageNumber,
  };
  const pages = pageCount(total, size);
  const at = clampPage(current, pages);
  const { first, last } = pageRange(at, size, total);
  const format = useMemo(() => new Intl.NumberFormat(strings.locale), [strings.locale]);
  const sizes = [...new Set([...pageSizeOptions, size])].sort((a, b) => a - b);
  const atStart = at <= 1;
  const atEnd = at >= pages;
  if (hideOnSinglePage && pages <= 1) return null;
  const picker =
    sizes.length > 1 && (variant === "default" || pageSizeOptionsProp !== undefined) ? (
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
    ) : null;
  if (variant === "pages") {
    return (
      <nav
        aria-label={text.nav}
        className={cn(
          "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-fs-125 text-ink-2",
          className,
        )}
        {...props}
      >
        <span aria-live="polite" className="tabular-nums">
          {formatRange(text.showing, {
            first: format.format(first),
            last: format.format(last),
            total: format.format(Math.max(0, total)),
          })}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {picker}
          <span className="flex items-center gap-1">
            <Button size="sm" disabled={atStart} onClick={() => setPage(at - 1)}>
              {text.previousLabel}
            </Button>
            {pageItems(at, pages).map((item, index) =>
              item === "gap" ? (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity besides its slot
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="w-6 text-center text-ink-3"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  size="sm"
                  variant={item === at ? "secondary" : "ghost"}
                  aria-current={item === at ? "page" : undefined}
                  aria-label={text.pageNumber.replace("{page}", String(item))}
                  onClick={() => setPage(item)}
                  className="min-w-control-sm px-2 tabular-nums"
                >
                  {format.format(item)}
                </Button>
              ),
            )}
            <Button size="sm" disabled={atEnd} onClick={() => setPage(at + 1)}>
              {text.nextLabel}
            </Button>
          </span>
        </span>
      </nav>
    );
  }
  return (
    <nav
      aria-label={text.nav}
      className={cn(
        "@container/pagination flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 px-2 py-1.5 text-fs-125 text-ink-2",
        className,
      )}
      {...props}
    >
      {picker}
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
