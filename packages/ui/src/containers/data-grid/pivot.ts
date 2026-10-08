// Pivot mode: row fields x one pivot column x an aggregated value, as a plain grid.
import {
  aggregateValues,
  compareValues,
  formatCellValue,
  getCellValue,
  selectKey,
} from "./model.js";
import type { AggregateKind, CellValue, DataGridColumn } from "./types.js";

export interface PivotConfig {
  /** Pivot mode on; `true` when absent. Lets a tool panel keep a draft while it is off. */
  enabled?: boolean;
  /** Column ids that identify a row (the row groups), outermost first. */
  rows: readonly string[];
  /** Column whose distinct values become columns. */
  column: string;
  /** Column that is aggregated in every cell. */
  value: string;
  aggregate: AggregateKind;
}

export interface PivotRow {
  id: string;
  /** Text of every row field, by column id. */
  labels: Record<string, string>;
  /** Aggregate per pivot key. */
  values: Record<string, number | null>;
  /** Aggregate across all pivot keys. */
  total: number | null;
}

export interface PivotResult {
  /** Distinct values of the pivot column, in order. */
  keys: string[];
  rows: PivotRow[];
  /** Per pivot key, aggregated over all rows (correct for avg, unlike a sum of cells). */
  totals: Record<string, number | null>;
  grandTotal: number | null;
}

export const PIVOT_TOTAL_ID = "pivot:total";

export function isPivotValid<T>(
  config: PivotConfig | undefined,
  columns: readonly DataGridColumn<T>[],
): config is PivotConfig {
  if (!config || config.enabled === false || config.rows.length === 0) return false;
  const ids = new Set(columns.map((column) => column.id));
  return (
    ids.has(config.column) &&
    ids.has(config.value) &&
    config.rows.every((id) => ids.has(id) && id !== config.column)
  );
}

export function buildPivot<T>(
  data: readonly T[],
  columns: readonly DataGridColumn<T>[],
  config: PivotConfig,
): PivotResult {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const rowColumns = config.rows
    .map((id) => byId.get(id))
    .filter((column): column is DataGridColumn<T> => !!column);
  const pivotColumn = byId.get(config.column);
  const valueColumn = byId.get(config.value);
  if (!pivotColumn || !valueColumn) return { keys: [], rows: [], totals: {}, grandTotal: null };

  const keyValues = new Map<string, CellValue>();
  const groups = new Map<
    string,
    { labels: Record<string, string>; sortKeys: CellValue[]; byKey: Map<string, CellValue[]> }
  >();
  const byPivotKey = new Map<string, CellValue[]>();
  const all: CellValue[] = [];

  for (const row of data) {
    const pivotValue = getCellValue(row, pivotColumn);
    const key = selectKey(pivotValue, pivotColumn);
    if (!keyValues.has(key)) keyValues.set(key, pivotValue);
    const cell = getCellValue(row, valueColumn);
    const parts = rowColumns.map((column) => getCellValue(row, column));
    const id = JSON.stringify(rowColumns.map((column, i) => selectKey(parts[i], column)));
    let group = groups.get(id);
    if (!group) {
      group = {
        labels: Object.fromEntries(
          rowColumns.map((column, i) => [column.id, formatCellValue(parts[i], column) || "—"]),
        ),
        sortKeys: parts,
        byKey: new Map(),
      };
      groups.set(id, group);
    }
    const cellsOfKey = group.byKey.get(key);
    if (cellsOfKey) cellsOfKey.push(cell);
    else group.byKey.set(key, [cell]);
    const forKey = byPivotKey.get(key);
    if (forKey) forKey.push(cell);
    else byPivotKey.set(key, [cell]);
    all.push(cell);
  }

  const keys = [...keyValues.entries()].sort((a, b) => compareValues(a[1], b[1])).map(([k]) => k);
  const ordered = [...groups.entries()].sort((a, b) => {
    for (let i = 0; i < rowColumns.length; i += 1) {
      const order = compareValues(a[1].sortKeys[i], b[1].sortKeys[i]);
      if (order !== 0) return order;
    }
    return 0;
  });
  const rows: PivotRow[] = ordered.map(([id, group]) => ({
    id,
    labels: group.labels,
    values: Object.fromEntries(
      keys.map((key) => [key, aggregateValues(group.byKey.get(key) ?? [], config.aggregate)]),
    ),
    total: aggregateValues([...group.byKey.values()].flat(), config.aggregate),
  }));
  return {
    keys,
    rows,
    totals: Object.fromEntries(
      keys.map((key) => [key, aggregateValues(byPivotKey.get(key) ?? [], config.aggregate)]),
    ),
    grandTotal: aggregateValues(all, config.aggregate),
  };
}

function pivotValueType<T>(
  source: DataGridColumn<T>,
  aggregate: AggregateKind,
): "number" | "currency" {
  if (aggregate === "count") return "number";
  return source.type === "currency" ? "currency" : "number";
}

/** Grid columns of a pivot: one per row field, one per pivot key and a trailing total. */
export function pivotColumns<T>(
  columns: readonly DataGridColumn<T>[],
  config: PivotConfig,
  result: PivotResult,
  totalHeader: string,
): DataGridColumn<PivotRow>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const valueColumn = byId.get(config.value);
  if (!valueColumn) return [];
  const type = pivotValueType(valueColumn, config.aggregate);
  const format =
    type === "currency" || config.aggregate === "count" ? undefined : valueColumn.format;
  const fields: DataGridColumn<PivotRow>[] = config.rows.map((id) => ({
    id: `pivot-row:${id}`,
    header: byId.get(id)?.header ?? id,
    accessor: (row) => row.labels[id] ?? "",
    width: 160,
    filterable: false,
    editable: false,
  }));
  const values: DataGridColumn<PivotRow>[] = result.keys.map((key) => ({
    id: `pivot:${key}`,
    header: key || "—",
    accessor: (row) => row.values[key] ?? null,
    type,
    format,
    width: 120,
    aggregate: config.aggregate,
    filterable: false,
  }));
  const total: DataGridColumn<PivotRow> = {
    id: PIVOT_TOTAL_ID,
    header: totalHeader,
    accessor: (row) => row.total,
    type,
    format,
    width: 128,
    aggregate: config.aggregate,
    filterable: false,
  };
  return [...fields, ...values, total];
}

/** Footer values for the pivot columns (exact for every aggregate kind). */
export function pivotFooter(result: PivotResult): Record<string, number | null> {
  const out: Record<string, number | null> = { [PIVOT_TOTAL_ID]: result.grandTotal };
  for (const key of result.keys) out[`pivot:${key}`] = result.totals[key] ?? null;
  return out;
}
