import { Accumulator, type Aggregator } from "../internal/grid-aggregate.js";
import { canonicalLocale, isEmptyValue, rawKey } from "../internal/grid-values.js";
import {
  type CellValue,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
  getCellValue,
} from "./model.js";
import { compareValues, type SortRule } from "./sort.js";
import type { ViewRow } from "./view.js";

export {
  Accumulator,
  type AggregateFn,
  type AggregateKind,
  type Aggregator,
  aggregate,
} from "../internal/grid-aggregate.js";

export interface GroupOptions<T> {
  /** Source rows; view rows read `rows[source]`. */
  rows: readonly T[];
  columns: readonly GridColumn<T>[];
  /** Column ids, outermost level first. Unknown ids are skipped. */
  groupBy: readonly string[];
  /** Aggregate per column id, shown on every group row. */
  aggregates?: Readonly<Record<string, Aggregator>>;
  /** Group keys that are collapsed (all others are open). */
  collapsed?: ReadonlySet<string>;
  /** When given, only these group keys are open (everything else is collapsed). */
  expanded?: ReadonlySet<string>;
  /** Groups follow the sort rule of their column, ascending otherwise. */
  sort?: readonly SortRule[];
  locale?: string;
  labels?: FormatOptions["labels"];
  /** Header text of an empty group value. Default `—`. */
  emptyLabel?: string;
}

/**
 * The key of a group: its path as JSON behind a control-character prefix, so it can never equal
 * the key of a data row. Path entries are `columnId:value` with the raw value (locale independent).
 */
export function groupKey(path: readonly string[]): string {
  return `\u0000group:${JSON.stringify(path)}`;
}

/** Returns a copy of `keys` with `key` flipped. */
export function toggleGroup(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Aggregates over the given source rows (or all rows), by column id: footers and grand totals. */
export function aggregateColumns<T>(
  rows: readonly T[],
  columns: readonly GridColumn<T>[],
  aggregates: Readonly<Record<string, Aggregator>>,
  sources?: readonly number[],
): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  const count = sources ? sources.length : rows.length;
  for (const column of columns) {
    const aggregator = aggregates[column.id];
    if (!aggregator) continue;
    const acc = new Accumulator(aggregator);
    for (let i = 0; i < count; i += 1)
      acc.add(getCellValue(rows[sources ? (sources[i] as number) : i] as T, column));
    out[column.id] = acc.result();
  }
  return out;
}

interface Bucket {
  value: CellValue;
  items: ViewRow[];
  accs: Accumulator[];
}

/**
 * The view's group stage: nests the (already filtered and sorted) data rows by `groupBy` and
 * inserts a group row (`kind: "group"`, `source: -1`, `group` info with count and aggregates)
 * before the rows of each group. Data rows keep their order inside a group, so sorting before
 * grouping is sorting within groups. The stage owns the rows it receives (as `buildView` passes
 * them): their `depth` is updated in place instead of allocating a row per data row. Collapsed groups emit only their header; their aggregates
 * still cover every row.
 */
export function createGroupStage<T>(options: GroupOptions<T>): (rows: ViewRow[]) => ViewRow[] {
  const { rows, collapsed, expanded, sort = [], emptyLabel = "—" } = options;
  const locale = canonicalLocale(options.locale);
  const format: FormatOptions = { locale, labels: options.labels };
  const byId = new Map<string, GridColumn<T>>();
  for (const column of options.columns) byId.set(column.id, column);
  const levels: GridColumn<T>[] = [];
  for (const id of options.groupBy) {
    const column = byId.get(id);
    if (column) levels.push(column);
  }
  const specs: { id: string; column: GridColumn<T>; aggregator: Aggregator }[] = [];
  for (const [id, aggregator] of Object.entries(options.aggregates ?? {})) {
    const column = byId.get(id);
    if (column) specs.push({ id, column, aggregator });
  }
  const isOpen = (key: string) => (expanded ? expanded.has(key) : !collapsed?.has(key));

  return (input) => {
    if (levels.length === 0) return input;
    const out: ViewRow[] = [];
    const path: string[] = [];
    const walk = (items: ViewRow[], depth: number) => {
      const column = levels[depth];
      if (!column) {
        for (let i = 0; i < items.length; i += 1) {
          const row = items[i] as ViewRow;
          row.depth = depth;
          out.push(row);
        }
        return;
      }
      const buckets = new Map<string, Bucket>();
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] as ViewRow;
        const source = rows[item.source] as T;
        const value = getCellValue(source, column);
        const k = rawKey(value);
        let bucket = buckets.get(k);
        if (!bucket) {
          bucket = { value, items: [], accs: specs.map((s) => new Accumulator(s.aggregator)) };
          buckets.set(k, bucket);
        }
        bucket.items.push(item);
        for (let s = 0; s < specs.length; s += 1)
          (bucket.accs[s] as Accumulator).add(
            getCellValue(source, (specs[s] as (typeof specs)[number]).column),
          );
      }
      const descending = sort.find((rule) => rule.id === column.id)?.direction === "desc";
      const ordered = [...buckets.entries()].sort((a, b) => {
        const x = a[1].value;
        const y = b[1].value;
        const emptyX = isEmptyValue(x);
        const emptyY = isEmptyValue(y);
        if (emptyX || emptyY) return emptyX === emptyY ? 0 : emptyX ? 1 : -1;
        const order = compareValues(x, y, locale);
        return descending ? -order : order;
      });
      for (const [valueKey, bucket] of ordered) {
        path.push(`${column.id}:${valueKey}`);
        const key = groupKey(path);
        const open = isOpen(key);
        const aggregates: Record<string, CellValue> = {};
        for (let s = 0; s < specs.length; s += 1)
          aggregates[(specs[s] as (typeof specs)[number]).id] = (
            bucket.accs[s] as Accumulator
          ).result();
        out.push({
          kind: "group",
          key,
          source: -1,
          depth,
          group: {
            columnId: column.id,
            value: bucket.value,
            label: formatCellValue(bucket.value, column, format) || emptyLabel,
            count: bucket.items.length,
            expanded: open,
            path: path.slice(),
            aggregates,
          },
        });
        if (open) walk(bucket.items, depth + 1);
        path.pop();
      }
    };
    walk(input, 0);
    return out;
  };
}
