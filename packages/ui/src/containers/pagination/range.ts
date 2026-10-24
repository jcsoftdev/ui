/** Number of pages for `total` rows; at least 1 so an empty list still has a first page. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** Keeps a 1-based page inside `1..pages`. */
export function clampPage(page: number, pages: number): number {
  return Math.min(Math.max(1, Math.trunc(page) || 1), pages);
}

/** 1-based first and last row shown on `page`; `{ first: 0, last: 0 }` when there are no rows. */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { first: number; last: number } {
  if (total <= 0 || pageSize <= 0) return { first: 0, last: 0 };
  const current = clampPage(page, pageCount(total, pageSize));
  return { first: (current - 1) * pageSize + 1, last: Math.min(total, current * pageSize) };
}

/** Fills the `{first}`, `{last}` and `{total}` placeholders of the `pageRange` UI string. */
export function formatPageRange(
  template: string,
  values: { first: string; last: string; total: string },
): string {
  return template
    .replace("{first}", values.first)
    .replace("{last}", values.last)
    .replace("{total}", values.total);
}
