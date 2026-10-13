import { type CellValue, type GridColumn, getCellValue } from "./model.js";

export type SortDirection = "asc" | "desc";

export interface SortRule {
  id: string;
  direction: SortDirection;
}

function toTime(value: CellValue): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

const collator =
  typeof Intl === "undefined"
    ? undefined
    : new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Ascending order; empty values always go last (callers keep them last in descending too). */
export function compareValues(a: CellValue, b: CellValue): number {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (a instanceof Date || b instanceof Date) return (toTime(a) ?? 0) - (toTime(b) ?? 0);
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator?.compare(String(a), String(b)) ?? String(a).localeCompare(String(b));
}

/**
 * Header click: asc, then desc, then off. Without `additive` the column becomes the only rule;
 * with it (Shift) the column is added, flipped or removed keeping the other rules.
 */
export function toggleSort(sort: readonly SortRule[], id: string, additive: boolean): SortRule[] {
  const current = sort.find((rule) => rule.id === id);
  const next: SortDirection | null = !current ? "asc" : current.direction === "asc" ? "desc" : null;
  if (!additive) {
    const fresh = current && sort.length > 1 ? "asc" : next;
    return fresh ? [{ id, direction: fresh }] : [];
  }
  if (!current) return [...sort, { id, direction: "asc" }];
  return next
    ? sort.map((rule) => (rule.id === id ? { id, direction: next } : rule))
    : sort.filter((rule) => rule.id !== id);
}

/** Stable multi-column sort. Rules whose column is unknown are skipped. */
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly GridColumn<T>[],
  sort: readonly SortRule[],
): T[] {
  const rules = sort
    .map((rule) => ({ rule, column: columns.find((column) => column.id === rule.id) }))
    .filter((entry): entry is { rule: SortRule; column: GridColumn<T> } => !!entry.column);
  if (rules.length === 0) return [...rows];
  const decorated = rows.map((row, index) => ({
    row,
    index,
    keys: rules.map(({ column }) => getCellValue(row, column)),
  }));
  decorated.sort((a, b) => {
    for (let i = 0; i < rules.length; i += 1) {
      const x = a.keys[i];
      const y = b.keys[i];
      const emptyX = x === null || x === undefined || x === "";
      const emptyY = y === null || y === undefined || y === "";
      if (emptyX || emptyY) {
        if (emptyX !== emptyY) return emptyX ? 1 : -1;
        continue;
      }
      const order = compareValues(x, y);
      if (order !== 0) return rules[i]?.rule.direction === "desc" ? -order : order;
    }
    return a.index - b.index;
  });
  return decorated.map((entry) => entry.row);
}

/** The `aria-sort` value of a column header, `undefined` when the column is not sorted. */
export function ariaSort(
  sort: readonly SortRule[],
  id: string,
): "ascending" | "descending" | undefined {
  const rule = sort.find((r) => r.id === id);
  return rule ? (rule.direction === "asc" ? "ascending" : "descending") : undefined;
}

/** Parses `"name:asc,price:desc"` (the `sort` attribute); anything malformed is dropped. */
export function parseSort(text: string | null | undefined): SortRule[] {
  const rules: SortRule[] = [];
  for (const part of (text ?? "").split(",")) {
    const [id, direction = "asc"] = part.trim().split(":");
    if (id && (direction === "asc" || direction === "desc") && !rules.some((r) => r.id === id))
      rules.push({ id, direction });
  }
  return rules;
}

export function formatSort(sort: readonly SortRule[]): string {
  return sort.map((rule) => `${rule.id}:${rule.direction}`).join(",");
}
