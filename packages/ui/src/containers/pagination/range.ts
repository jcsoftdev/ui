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

/** A page number button, or a gap between two runs of them. */
export type PageItem = number | "gap";

/**
 * The page buttons to show: the first and last page, the current one with `siblings` on each side,
 * and a `"gap"` where pages are left out. A gap never hides a single page (that page shows instead),
 * so the list keeps the same length while the current page moves through the middle.
 */
export function pageItems(page: number, pages: number, siblings = 1): PageItem[] {
  const total = Math.max(1, Math.trunc(pages));
  const current = clampPage(page, total);
  const slots = siblings * 2 + 5;
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(Math.min(current - siblings, total - siblings * 2 - 2), 3);
  const end = Math.min(Math.max(current + siblings, siblings * 2 + 3), total - 2);
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return [
    1,
    start > 3 ? ("gap" as const) : 2,
    ...middle,
    end < total - 2 ? ("gap" as const) : total - 1,
    total,
  ];
}

/** Fills `{first}` and `{last}` (and `{total}` when given) in a range template. */
export function formatRange(
  template: string,
  values: { first: string; last: string; total?: string },
): string {
  return template
    .replace("{first}", values.first)
    .replace("{last}", values.last)
    .replace("{total}", values.total ?? "");
}
