// Pure data pipeline of DataGrid: read, format, filter, sort, group, aggregate, export.
import { formatCurrency, formatNumber } from "../../charts/core/format.js";
import type {
  AggregateKind,
  CellValue,
  ColumnAlign,
  DataGridColumn,
  DisplayRow,
  FilterKind,
  Filters,
  FilterValue,
  GridLayout,
  SortDirection,
  SortRule,
} from "./types.js";

export function getCellValue<T>(row: T, column: DataGridColumn<T>): CellValue {
  const { accessor } = column;
  if (typeof accessor === "function") return accessor(row);
  return row[accessor] as CellValue;
}

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatCellValue<T>(value: CellValue, column: DataGridColumn<T>): string {
  if (column.format) return column.format(value);
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : dateFormat.format(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (column.type === "currency") return formatCurrency(value);
    if (column.type === "number") return formatNumber(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value;
}

/** Formats an aggregate with the column formatter; counts are plain integers. */
export function formatAggregate<T>(
  value: number | null,
  kind: AggregateKind,
  column: DataGridColumn<T>,
): string {
  if (value === null) return "";
  if (kind === "count") return formatNumber(value);
  if (column.type === "currency" || column.type === "number" || column.format) {
    return formatCellValue(value, column);
  }
  return formatNumber(value);
}

export function columnAlign<T>(column: DataGridColumn<T>): ColumnAlign {
  if (column.align) return column.align;
  return column.type === "number" || column.type === "currency" ? "end" : "start";
}

export function filterKindOf<T>(column: DataGridColumn<T>): FilterKind {
  if (column.filter) return column.filter;
  switch (column.type) {
    case "number":
    case "currency":
      return "range";
    case "date":
      return "dateRange";
    case "status":
    case "boolean":
      return "select";
    default:
      return "text";
  }
}

/** Lower case, without accents, so "peluqueria" finds "Peluquería". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Epoch milliseconds of a date-like cell value, null when it is not one. */
export function cellToTime(value: CellValue): number | null {
  return toTime(value);
}

/** Finite number of a numeric-like cell value (dates become their time), null otherwise. */
export function cellToNumber(value: CellValue): number | null {
  return toNumber(value);
}

/** Epoch milliseconds of an ISO `yyyy-mm-dd` day, local midnight or the end of that day. */
export function isoDayBounds(iso: string, endOfDay: boolean): number | null {
  return isoDayTime(iso, endOfDay);
}

function toTime(value: CellValue): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return toTime(value);
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

/** Local midnight of an ISO `yyyy-mm-dd` (end of that day with `endOfDay`). */
function isoDayTime(iso: string, endOfDay: boolean): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = endOfDay
    ? new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
    : new Date(Number(y), Number(m) - 1, Number(d));
  return date.getTime();
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Ascending order; empty values always go last (callers keep them last in descending too). */
export function compareValues(a: CellValue, b: CellValue): number {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (a instanceof Date || b instanceof Date) return (toTime(a) ?? 0) - (toTime(b) ?? 0);
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
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
  columns: readonly DataGridColumn<T>[],
  sort: readonly SortRule[],
): T[] {
  const rules = sort
    .map((rule) => ({ rule, column: columns.find((column) => column.id === rule.id) }))
    .filter((entry): entry is { rule: SortRule; column: DataGridColumn<T> } => !!entry.column);
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

export function isFilterActive(filter: FilterValue | undefined): boolean {
  if (!filter) return false;
  switch (filter.kind) {
    case "text":
      return filter.query.trim() !== "";
    case "range":
      return typeof filter.min === "number" || typeof filter.max === "number";
    case "dateRange":
      return !!filter.from || !!filter.to;
    case "select":
      return filter.values.length > 0;
  }
}

export function countActiveFilters(filters: Filters): number {
  return Object.values(filters).filter(isFilterActive).length;
}

export function matchesFilter<T>(
  value: CellValue,
  filter: FilterValue,
  column: DataGridColumn<T>,
): boolean {
  if (!isFilterActive(filter)) return true;
  switch (filter.kind) {
    case "text": {
      const text = normalizeText(`${String(value ?? "")} ${formatCellValue(value, column)}`);
      return text.includes(normalizeText(filter.query.trim()));
    }
    case "range": {
      const number = toNumber(value);
      if (number === null) return false;
      if (typeof filter.min === "number" && number < filter.min) return false;
      if (typeof filter.max === "number" && number > filter.max) return false;
      return true;
    }
    case "dateRange": {
      const time = toTime(value);
      if (time === null) return false;
      const from = filter.from ? isoDayTime(filter.from, false) : null;
      const to = filter.to ? isoDayTime(filter.to, true) : null;
      if (from !== null && time < from) return false;
      if (to !== null && time > to) return false;
      return true;
    }
    case "select":
      return filter.values.includes(selectKey(value, column));
  }
}

/** Value used by the select filter and by grouping: dates by day, booleans as Sí / No, the rest as text. */
export function selectKey<T>(value: CellValue, column: DataGridColumn<T>): string {
  if (value instanceof Date || typeof value === "boolean") return formatCellValue(value, column);
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Keeps rows that pass every column filter and, when `search` is given, contain every word of
 * it in some searchable column (raw or formatted text, accents ignored).
 */
export function filterRows<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  filters: Filters,
  search = "",
): T[] {
  const active = columns
    .map((column) => ({ column, filter: filters[column.id] }))
    .filter((entry): entry is { column: DataGridColumn<T>; filter: FilterValue } =>
      isFilterActive(entry.filter),
    );
  const words = normalizeText(search).split(/\s+/).filter(Boolean);
  if (active.length === 0 && words.length === 0) return [...rows];
  return rows.filter((row) => {
    for (const { column, filter } of active) {
      if (!matchesFilter(getCellValue(row, column), filter, column)) return false;
    }
    if (words.length === 0) return true;
    const haystack = normalizeText(
      columns
        .map((column) => {
          const value = getCellValue(row, column);
          return `${value instanceof Date ? "" : String(value ?? "")} ${formatCellValue(value, column)}`;
        })
        .join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

/** Select-filter value that matches no row: "nothing checked" in a set filter. */
export const SET_NONE = "\u0000none";

/** Checked values of a set filter: every option while the filter is inactive. */
export function checkedSetValues(
  options: readonly string[],
  filter: FilterValue | undefined,
): Set<string> {
  if (filter?.kind !== "select" || filter.values.length === 0) return new Set(options);
  return new Set(filter.values.filter((value) => value !== SET_NONE));
}

/**
 * Checks or unchecks `values` in a set filter and returns the new filter: `undefined` when every
 * option ends up checked (no filtering), the `SET_NONE` marker when none is.
 */
export function toggleSetValues(
  options: readonly string[],
  filter: FilterValue | undefined,
  values: readonly string[],
  checked: boolean,
): FilterValue | undefined {
  const next = checkedSetValues(options, filter);
  for (const value of values) {
    if (checked) next.add(value);
    else next.delete(value);
  }
  const kept = options.filter((option) => next.has(option));
  if (kept.length === options.length) return undefined;
  return { kind: "select", values: kept.length === 0 ? [SET_NONE] : kept };
}

/** Options that contain the search text (accents and case ignored). */
export function searchOptions(options: readonly string[], query: string): string[] {
  const needle = normalizeText(query.trim());
  return needle === "" ? [...options] : options.filter((o) => normalizeText(o).includes(needle));
}

/** Distinct select-filter values of a column, sorted. */
export function distinctValues<T>(rows: readonly T[], column: DataGridColumn<T>): string[] {
  const seen = new Map<string, CellValue>();
  for (const row of rows) {
    const value = getCellValue(row, column);
    const key = selectKey(value, column);
    if (key !== "" && !seen.has(key)) seen.set(key, value);
  }
  return [...seen.entries()].sort((a, b) => compareValues(a[1], b[1])).map(([key]) => key);
}

/** Aggregates numeric values; `count` counts non-empty values. Null when nothing to aggregate. */
export function aggregateValues(values: readonly CellValue[], kind: AggregateKind): number | null {
  if (kind === "count") {
    return values.filter((value) => value !== null && value !== undefined && value !== "").length;
  }
  const numbers = values.map(toNumber).filter((value): value is number => value !== null);
  if (numbers.length === 0) return null;
  switch (kind) {
    case "sum":
      return numbers.reduce((total, value) => total + value, 0);
    case "avg":
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
  }
}

export function computeAggregates<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const column of columns) {
    if (!column.aggregate) continue;
    result[column.id] = aggregateValues(
      rows.map((row) => getCellValue(row, column)),
      column.aggregate,
    );
  }
  return result;
}

/**
 * Flattens rows into what the grid renders: with `groupBy`, a group row per distinct value (by
 * level, carrying the count and the column aggregates of all its rows) followed by its children
 * unless its key is in `collapsed`. Groups follow the sort rule of their column, ascending
 * otherwise; rows keep the order they come in.
 */
export function buildDisplayRows<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  groupBy: readonly string[],
  collapsed: ReadonlySet<string>,
  rowKey: (row: T) => string,
  sort: readonly SortRule[] = [],
): DisplayRow<T>[] {
  const levels = groupBy
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is DataGridColumn<T> => !!column);
  const out: DisplayRow<T>[] = [];

  const walk = (subset: readonly T[], depth: number, path: string[]) => {
    const column = levels[depth];
    if (!column) {
      for (const row of subset) out.push({ kind: "data", key: rowKey(row), depth, row });
      return;
    }
    const buckets = new Map<string, { value: CellValue; rows: T[] }>();
    for (const row of subset) {
      const value = getCellValue(row, column);
      const key = selectKey(value, column);
      const bucket = buckets.get(key);
      if (bucket) bucket.rows.push(row);
      else buckets.set(key, { value, rows: [row] });
    }
    const descending = sort.find((rule) => rule.id === column.id)?.direction === "desc";
    const ordered = [...buckets.entries()].sort((a, b) => {
      const order = compareValues(a[1].value, b[1].value);
      return descending ? -order : order;
    });
    for (const [valueKey, bucket] of ordered) {
      const groupPath = [...path, `${column.id}:${valueKey}`];
      const key = JSON.stringify(groupPath);
      const isCollapsed = collapsed.has(key);
      out.push({
        kind: "group",
        key,
        depth,
        columnId: column.id,
        label: formatCellValue(bucket.value, column) || "—",
        count: bucket.rows.length,
        collapsed: isCollapsed,
        aggregates: computeAggregates(bucket.rows, columns),
      });
      if (!isCollapsed) walk(bucket.rows, depth + 1, groupPath);
    }
  };

  walk(rows, 0, []);
  return out;
}

/** Ids between `anchor` and `target` (inclusive) in display order; just `target` without anchor. */
export function rangeBetween(
  ids: readonly string[],
  anchor: string | null,
  target: string,
): string[] {
  const end = ids.indexOf(target);
  const start = anchor === null ? -1 : ids.indexOf(anchor);
  if (end === -1) return [];
  if (start === -1) return [target];
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}

function csvField(text: string, separator: string): string {
  return /["\r\n]/.test(text) || text.includes(separator) || /^\s|\s$/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export interface CsvOptions {
  separator?: string;
  /** Prefix a UTF-8 BOM so spreadsheet apps read accents correctly. */
  bom?: boolean;
}

/**
 * CSV with a header row. Numbers stay raw (`1234.5`), dates become `yyyy-mm-dd`, the rest uses
 * the column formatter. Fields with quotes, separators or line breaks are quoted.
 */
export function toCSV<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  options: CsvOptions = {},
): string {
  const { separator = ",", bom = false } = options;
  const lines = [columns.map((column) => csvField(column.header, separator)).join(separator)];
  for (const row of rows) {
    lines.push(
      columns
        .map((column) => {
          const value = getCellValue(row, column);
          let text: string;
          if (typeof value === "number") text = Number.isFinite(value) ? String(value) : "";
          else if (value instanceof Date) text = isoDate(value);
          else text = formatCellValue(value, column);
          return csvField(text, separator);
        })
        .join(separator),
    );
  }
  return `${bom ? "﻿" : ""}${lines.join("\r\n")}`;
}

function isoDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DEFAULT_WIDTH: Record<string, number> = {
  text: 180,
  number: 110,
  currency: 120,
  date: 130,
  status: 140,
};

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 640;

/** Width the uppercase header label needs next to its sort and menu buttons. */
export function headerFitWidth<T>(column: DataGridColumn<T>): number {
  return Math.ceil(column.header.length * 8.6 + 64);
}

/** Starting width: the column's own or the type default, never narrower than its header. A user can still resize below it. */
export function defaultWidth<T>(column: DataGridColumn<T>): number {
  const base = column.width ?? DEFAULT_WIDTH[column.type ?? "text"] ?? 160;
  return clampWidth(Math.max(base, headerFitWidth(column)), column);
}

export function clampWidth<T>(width: number, column: DataGridColumn<T>): number {
  const min = column.minWidth ?? MIN_COLUMN_WIDTH;
  const max = Math.max(min, column.maxWidth ?? MAX_COLUMN_WIDTH);
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** Share of the leftover width a column takes: `grow`, else 1 for text columns and 0 for the rest. */
export function growWeight<T>(column: DataGridColumn<T>): number {
  if (column.grow !== undefined) return Math.max(0, column.grow);
  return (column.type ?? "text") === "text" ? 1 : 0;
}

/**
 * Widths that fill `available` pixels: when the columns add up to less (`reserved` is the width of
 * fixed extras such as the selection column), the leftover goes to the flexible columns in
 * proportion to `growWeight`. Nothing shrinks below the current width, a column stops at its
 * `maxWidth`, and a column the user resized (width other than `defaultWidth`) keeps its width.
 * Without flexible columns, or when the content is already wider, `widths` comes back unchanged.
 */
export function fillColumnWidths<T>(
  columns: readonly DataGridColumn<T>[],
  widths: Readonly<Record<string, number>>,
  available: number,
  reserved = 0,
): Record<string, number> {
  const result: Record<string, number> = { ...widths };
  const widthOf = (column: DataGridColumn<T>) => widths[column.id] ?? defaultWidth(column);
  let leftover = available - reserved - columns.reduce((sum, column) => sum + widthOf(column), 0);
  let active = columns.filter(
    (column) => growWeight(column) > 0 && widthOf(column) === defaultWidth(column),
  );
  if (leftover < 1 || active.length === 0) return result;

  for (;;) {
    const total = active.reduce((sum, column) => sum + growWeight(column), 0);
    const capped = active.filter(
      (column) =>
        column.maxWidth !== undefined &&
        widthOf(column) + (leftover * growWeight(column)) / total > column.maxWidth,
    );
    if (capped.length === 0) break;
    for (const column of capped) {
      const max = Math.max(widthOf(column), column.maxWidth as number);
      leftover -= max - widthOf(column);
      result[column.id] = max;
    }
    active = active.filter((column) => !capped.includes(column));
    if (active.length === 0 || leftover < 1) return result;
  }

  const total = active.reduce((sum, column) => sum + growWeight(column), 0);
  let given = 0;
  for (const column of active) {
    const share = Math.floor((leftover * growWeight(column)) / total);
    result[column.id] = widthOf(column) + share;
    given += share;
  }
  const last = active[active.length - 1] as DataGridColumn<T>;
  result[last.id] = (result[last.id] ?? 0) + (Math.floor(leftover) - given);
  return result;
}

/** Moves `id` one step (`delta` -1 / +1) in `order`. */
export function moveColumn(order: readonly string[], id: string, delta: number): string[] {
  const index = order.indexOf(id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= order.length) return [...order];
  const next = [...order];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return next;
}

/** Moves `id` before or after `targetId` (drag and drop). */
export function moveColumnTo(
  order: readonly string[],
  id: string,
  targetId: string,
  place: "before" | "after",
): string[] {
  if (id === targetId || !order.includes(id) || !order.includes(targetId)) return [...order];
  const next = order.filter((x) => x !== id);
  const index = next.indexOf(targetId) + (place === "after" ? 1 : 0);
  next.splice(index, 0, id);
  return next;
}

/** Reconciles a stored layout with the current columns: unknown ids drop, new ones append. */
export function reconcileLayout<T>(
  columns: readonly DataGridColumn<T>[],
  stored: Partial<GridLayout> | null,
  fallback: GridLayout,
): GridLayout {
  if (!stored) return fallback;
  const ids = columns.map((column) => column.id);
  const known = (id: unknown): id is string => typeof id === "string" && ids.includes(id);
  const order = [...new Set((stored.order ?? []).filter(known))];
  for (const id of ids) if (!order.includes(id)) order.push(id);
  const widths: Record<string, number> = { ...fallback.widths };
  for (const column of columns) {
    const width = stored.widths?.[column.id];
    if (typeof width === "number" && Number.isFinite(width)) {
      widths[column.id] = clampWidth(width, column);
    }
  }
  const left = [...new Set((stored.pinned?.left ?? []).filter(known))];
  const right = [...new Set((stored.pinned?.right ?? []).filter(known))].filter(
    (id) => !left.includes(id),
  );
  const density =
    stored.density === "compact" || stored.density === "normal" || stored.density === "comfortable"
      ? stored.density
      : fallback.density;
  return {
    order,
    hidden: [...new Set((stored.hidden ?? []).filter(known))],
    widths,
    pinned: { left, right },
    density,
  };
}

export function parseStoredLayout(raw: string | null): Partial<GridLayout> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Partial<GridLayout>;
  } catch {
    return null;
  }
}
