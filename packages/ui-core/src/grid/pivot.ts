import { Accumulator, type Aggregator } from "../internal/grid-aggregate.js";
import { canonicalLocale, selectKey } from "../internal/grid-values.js";
import {
  type CellValue,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
  getCellValue,
} from "./model.js";
import { compareValues } from "./sort.js";

export interface PivotConfig {
  /** Pivot mode on; `true` when absent. */
  enabled?: boolean;
  /** Column ids that identify a row (the row groups), outermost first. */
  rows: readonly string[];
  /** Column whose distinct values become columns. */
  column: string;
  /** Column that is aggregated in every cell. */
  value: string;
  aggregate: Aggregator;
  /** Most generated value columns (default 500); the rest is reported in `overflow`. */
  maxColumns?: number;
  locale?: string;
  labels?: FormatOptions["labels"];
}

export interface PivotRow {
  id: string;
  /** Text of every row field, by column id. */
  labels: Record<string, string>;
  /** Aggregate per pivot key; a missing combination is `null` (`0` for `count`). */
  values: Record<string, CellValue>;
  /** Aggregate across all pivot keys, capped ones included. */
  total: CellValue;
}

export interface PivotResult {
  /** Distinct values of the pivot column, in order, cut at `maxColumns`. */
  keys: string[];
  rows: PivotRow[];
  /** Per pivot key, aggregated over all rows (correct for avg, unlike a sum of cells). */
  totals: Record<string, CellValue>;
  grandTotal: CellValue;
  /** How many pivot keys `maxColumns` left out. */
  overflow: number;
}

export const PIVOT_TOTAL_ID = "pivot:total";
/** Id prefix of the generated value columns; a data value can never reach `PIVOT_TOTAL_ID`. */
export const PIVOT_VALUE_PREFIX = "pivot:v:";
export const DEFAULT_PIVOT_MAX_COLUMNS = 500;

export function isPivotValid<T>(
  config: PivotConfig | undefined,
  columns: readonly GridColumn<T>[],
): config is PivotConfig {
  if (!config || config.enabled === false || config.rows.length === 0) return false;
  const ids = new Set(columns.map((column) => column.id));
  return (
    ids.has(config.column) &&
    ids.has(config.value) &&
    config.rows.every((id) => ids.has(id) && id !== config.column)
  );
}

interface RowGroup {
  labels: Record<string, string>;
  sortKeys: CellValue[];
  byKey: Map<string, Accumulator>;
  total: Accumulator;
}

/** Aggregates `rows` into rows (row fields) by columns (distinct values of `config.column`). */
export function buildPivot<T>(
  rows: readonly T[],
  columns: readonly GridColumn<T>[],
  config: PivotConfig,
): PivotResult {
  const empty: PivotResult = { keys: [], rows: [], totals: {}, grandTotal: null, overflow: 0 };
  const byId = new Map(columns.map((column) => [column.id, column]));
  const rowColumns: GridColumn<T>[] = [];
  for (const id of config.rows) {
    const column = byId.get(id);
    if (column) rowColumns.push(column);
  }
  const pivotColumn = byId.get(config.column);
  const valueColumn = byId.get(config.value);
  if (!pivotColumn || !valueColumn) return empty;
  const locale = canonicalLocale(config.locale);
  const format: FormatOptions = { locale, labels: config.labels };
  const make = () => new Accumulator(config.aggregate);

  // First pass: the distinct pivot values, to rank and cap the columns before accumulating.
  const keyValues = new Map<string, CellValue>();
  for (let r = 0; r < rows.length; r += 1) {
    const pivotValue = getCellValue(rows[r] as T, pivotColumn);
    const key = selectKey(pivotValue, pivotColumn, format);
    if (!keyValues.has(key)) keyValues.set(key, pivotValue);
  }
  const allKeys = [...keyValues.entries()]
    .sort((a, b) => compareValues(a[1], b[1], locale))
    .map(([k]) => k);
  const requested = config.maxColumns;
  const max = Math.max(
    0,
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.floor(requested)
      : DEFAULT_PIVOT_MAX_COLUMNS,
  );
  const keys = allKeys.length > max ? allKeys.slice(0, max) : allKeys;
  const kept = new Set(keys);
  const groups = new Map<string, RowGroup>();
  const byPivotKey = new Map<string, Accumulator>();
  const grand = make();
  const parts = new Array<CellValue>(rowColumns.length);
  const keyParts = new Array<string>(rowColumns.length);

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] as T;
    const pivotValue = getCellValue(row, pivotColumn);
    const key = selectKey(pivotValue, pivotColumn, format);
    const cell = getCellValue(row, valueColumn);
    for (let i = 0; i < rowColumns.length; i += 1) {
      const column = rowColumns[i] as GridColumn<T>;
      parts[i] = getCellValue(row, column);
      keyParts[i] = selectKey(parts[i], column, format);
    }
    const id = JSON.stringify(keyParts);
    let group = groups.get(id);
    if (!group) {
      const labels: Record<string, string> = Object.create(null);
      for (let i = 0; i < rowColumns.length; i += 1) {
        const column = rowColumns[i] as GridColumn<T>;
        labels[column.id] = formatCellValue(parts[i], column, format) || "—";
      }
      group = { labels, sortKeys: parts.slice(), byKey: new Map(), total: make() };
      groups.set(id, group);
    }
    group.total.add(cell);
    grand.add(cell);
    if (!kept.has(key)) continue;
    let acc = group.byKey.get(key);
    if (!acc) {
      acc = make();
      group.byKey.set(key, acc);
    }
    acc.add(cell);
    let forKey = byPivotKey.get(key);
    if (!forKey) {
      forKey = make();
      byPivotKey.set(key, forKey);
    }
    forKey.add(cell);
  }

  const ordered = [...groups.entries()].sort((a, b) => {
    for (let i = 0; i < rowColumns.length; i += 1) {
      const order = compareValues(a[1].sortKeys[i], b[1].sortKeys[i], locale);
      if (order !== 0) return order;
    }
    return 0;
  });
  const emptyCell = () => make().result();
  const out: PivotRow[] = ordered.map(([id, group]) => {
    const values: Record<string, CellValue> = Object.create(null);
    for (const key of keys) values[key] = (group.byKey.get(key) ?? { result: emptyCell }).result();
    return { id, labels: group.labels, values, total: group.total.result() };
  });
  const totals: Record<string, CellValue> = Object.create(null);
  for (const key of keys) totals[key] = (byPivotKey.get(key) ?? { result: emptyCell }).result();
  return {
    keys,
    rows: out,
    totals,
    grandTotal: grand.result(),
    overflow: allKeys.length - keys.length,
  };
}

function valueType<T>(
  source: GridColumn<T>,
  aggregate: Aggregator,
): "number" | "currency" | undefined {
  if (aggregate === "first" || aggregate === "last") {
    return source.type === "currency"
      ? "currency"
      : source.type === "number"
        ? "number"
        : undefined;
  }
  if (aggregate === "count" || aggregate === "countDistinct") return "number";
  return source.type === "currency" ? "currency" : "number";
}

/** Grid columns of a pivot: one per row field, one per pivot key and a trailing total. */
export function pivotColumns<T>(
  columns: readonly GridColumn<T>[],
  config: PivotConfig,
  result: PivotResult,
  totalHeader: string,
): GridColumn<PivotRow>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const valueColumn = byId.get(config.value);
  if (!valueColumn) return [];
  const type = valueType(valueColumn, config.aggregate);
  const format =
    type === "currency" || config.aggregate === "count" ? undefined : valueColumn.format;
  const fields: GridColumn<PivotRow>[] = config.rows.map((id) => ({
    id: `pivot-row:${id}`,
    header: byId.get(id)?.header ?? id,
    accessor: (row: PivotRow) => row.labels[id] ?? "",
    width: 160,
    editable: false,
  }));
  const values: GridColumn<PivotRow>[] = result.keys.map((key) => ({
    id: `${PIVOT_VALUE_PREFIX}${key}`,
    header: key || "—",
    accessor: (row: PivotRow) => row.values[key] ?? null,
    type,
    format,
    width: 120,
    editable: false,
  }));
  const total: GridColumn<PivotRow> = {
    id: PIVOT_TOTAL_ID,
    header: totalHeader,
    accessor: (row: PivotRow) => row.total,
    type,
    format,
    width: 128,
    editable: false,
  };
  return [...fields, ...values, total];
}

/** Footer values for the pivot columns (exact for every aggregate kind). */
export function pivotFooter(result: PivotResult): Record<string, CellValue> {
  const out: Record<string, CellValue> = Object.create(null);
  out[PIVOT_TOTAL_ID] = result.grandTotal;
  for (const key of result.keys) out[`${PIVOT_VALUE_PREFIX}${key}`] = result.totals[key] ?? null;
  return out;
}
