// Turns a range of grid cells into chart series. Pure: the grid passes the cells, a chart draws them.
import type { CellValue } from "./types.js";

export type GridChartKind = "bar" | "line" | "area" | "pie";

export interface RangeCellInput {
  value: CellValue;
  /** The cell as shown (formatted); used for category names. */
  text: string;
}

export interface RangeChartInput {
  /** Header of each column in the range, left to right. */
  headers: readonly string[];
  /** Column ids, same order. */
  columnIds: readonly string[];
  /** One array per row of the range; `null` for a cell that is not data (group rows, selection column). */
  cells: ReadonlyArray<ReadonlyArray<RangeCellInput | null>>;
  /** Name of a category when the range has no text column: "Fila 1", "Fila 2"... */
  rowLabel?: (position: number) => string;
}

export interface RangeSeries {
  id: string;
  name: string;
  data: Array<number | null>;
}

export interface RangeChartData {
  categories: string[];
  /** Header of the column the categories came from, null when they are row numbers. */
  categoryHeader: string | null;
  series: RangeSeries[];
}

function isNumber(value: CellValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A column is numeric when at least half of its filled cells hold numbers. */
function numericColumn(cells: ReadonlyArray<ReadonlyArray<RangeCellInput | null>>, c: number) {
  let filled = 0;
  let numbers = 0;
  for (const line of cells) {
    const cell = line[c];
    if (!cell || cell.value === null || cell.value === undefined || cell.value === "") continue;
    filled += 1;
    if (isNumber(cell.value)) numbers += 1;
  }
  return numbers > 0 && numbers * 2 >= filled;
}

/**
 * Series from a cell range: the first text or date column names the categories and every numeric
 * column becomes a series (named by its header). Without a text column the categories are the row
 * numbers of the range. Rows that are not data rows are left out. Null when nothing is numeric.
 */
export function rangeToChart(input: RangeChartInput): RangeChartData | null {
  const { headers, columnIds, cells } = input;
  const rowLabel = input.rowLabel ?? ((position: number) => `Fila ${position}`);
  const rows = cells.filter((line) => line.some((cell) => cell !== null));
  if (rows.length === 0 || headers.length === 0) return null;

  const numeric = headers.map((_, c) => numericColumn(rows, c));
  const dataColumn = headers.map((_, c) =>
    rows.some((line) => line[c] !== null && line[c] !== undefined),
  );
  const categoryColumn = headers.findIndex((_, c) => dataColumn[c] && !numeric[c]);
  const valueColumns = headers.map((_, c) => c).filter((c) => numeric[c] && dataColumn[c]);
  if (valueColumns.length === 0) return null;

  const categories = rows.map((line, index) => {
    const text = categoryColumn >= 0 ? line[categoryColumn]?.text.trim() : "";
    return text ? text : rowLabel(index + 1);
  });
  const series = valueColumns.map<RangeSeries>((c) => ({
    id: columnIds[c] ?? `col-${c}`,
    name: headers[c] ?? `Serie ${c + 1}`,
    data: rows.map((line) => {
      const value = line[c]?.value;
      return isNumber(value) ? value : null;
    }),
  }));
  return {
    categories,
    categoryHeader: categoryColumn >= 0 ? (headers[categoryColumn] ?? null) : null,
    series,
  };
}

export interface PieSlice {
  id: string;
  name: string;
  value: number;
}

/**
 * Slices of a pie from one series: only positive values, largest first. Beyond `maxSlices` the
 * smallest are summed into one slice called `otherLabel`.
 */
export function pieSlices(
  data: RangeChartData,
  seriesIndex = 0,
  maxSlices = 8,
  otherLabel = "Otros",
): PieSlice[] {
  const values = data.series[seriesIndex]?.data ?? [];
  const slices: PieSlice[] = [];
  values.forEach((value, index) => {
    if (value !== null && value > 0) {
      slices.push({
        id: `${seriesIndex}-${index}`,
        name: data.categories[index] ?? `${index + 1}`,
        value,
      });
    }
  });
  slices.sort((a, b) => b.value - a.value);
  if (slices.length <= maxSlices) return slices;
  const head = slices.slice(0, Math.max(1, maxSlices - 1));
  const rest = slices.slice(head.length).reduce((sum, slice) => sum + slice.value, 0);
  return [...head, { id: "other", name: otherLabel, value: rest }];
}

/** Charts that make sense for the data: a pie needs positive values, a line needs two or more points. */
export function availableKinds(data: RangeChartData): GridChartKind[] {
  const kinds: GridChartKind[] = ["bar"];
  if (data.categories.length >= 2) kinds.push("line", "area");
  if (pieSlices(data).length >= 2) kinds.push("pie");
  return kinds;
}
