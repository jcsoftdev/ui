"use client";

import { useMemo, useState } from "react";
import { clampPage, pageCount } from "./range.js";

export interface PaginationState<T> {
  /** Current 1-based page, always inside `1..pageCount`. */
  page: number;
  pageCount: number;
  /** Rows across every page. */
  total: number;
  pageSize: number;
  /** The rows of the current page. */
  items: readonly T[];
  setPage: (page: number) => void;
}

/**
 * Client-side paging over an already filtered and sorted list. The page is clamped, so a search
 * that shrinks the list lands on the last page that still exists instead of an empty one, and it
 * returns to the first page whenever `resetKey` changes (the search text, a filter, the sort).
 * Pair it with `<Pagination variant="pages">`.
 */
export function usePagination<T>(
  rows: readonly T[],
  resetKey: unknown = "",
  pageSize = 25,
): PaginationState<T> {
  const [requested, setPage] = useState(1);
  const [key, setKey] = useState(resetKey);
  // Reset during render rather than in an effect, so the first page shows without a stale frame.
  if (!Object.is(key, resetKey)) {
    setKey(resetKey);
    setPage(1);
  }
  const total = rows.length;
  const pages = pageCount(total, pageSize);
  const page = Object.is(key, resetKey) ? clampPage(requested, pages) : 1;
  const items = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );
  return { page, pageCount: pages, total, pageSize, items, setPage };
}
