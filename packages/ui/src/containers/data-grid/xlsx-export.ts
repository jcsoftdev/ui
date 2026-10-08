// Maps grid rows and columns to the sheet model of the XLSX writer. Pure; the writer itself is
// loaded on demand (`@jcsoftdev/ui/xlsx`), so only types are imported from it here.
import type { XlsxCellValue, XlsxColumn, XlsxFormat, XlsxSheet } from "../../xlsx/xlsx.js";
import { columnAlign, getCellValue } from "./model.js";
import type { CellValue, DataGridColumn } from "./types.js";

const ALIGN = { start: "left", center: "center", end: "right" } as const;

function hasTime(value: Date): boolean {
  return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
}

function cellOf(value: CellValue): XlsxCellValue {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  return value;
}

function formatOf(column: DataGridColumn<never>, values: readonly XlsxCellValue[]): XlsxFormat {
  if (column.type === "currency") return "currency";
  if (column.type === "date") {
    return values.some((value) => value instanceof Date && hasTime(value)) ? "datetime" : "date";
  }
  if (column.type === "number") {
    const numbers = values.filter((value): value is number => typeof value === "number");
    return numbers.length > 0 && numbers.every(Number.isInteger) ? "integer" : "decimal";
  }
  return "general";
}

/**
 * Sheet with one column per grid column (header text, typed values) and one row per grid row.
 * Numbers stay numbers, dates stay dates; pass the rows and columns as the CSV export does.
 */
export function gridToSheet<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  name: string,
): XlsxSheet {
  const table = rows.map((row) => columns.map((column) => cellOf(getCellValue(row, column))));
  const sheetColumns: XlsxColumn[] = columns.map((column, c) => ({
    header: column.header,
    format: formatOf(
      column as DataGridColumn<never>,
      table.map((line) => line[c]),
    ),
    align: ALIGN[columnAlign(column)],
  }));
  return { name, columns: sheetColumns, rows: table };
}

/** File name with the `.xlsx` extension. */
export function xlsxFilename(name: string): string {
  return /\.xlsx$/i.test(name) ? name : `${name.replace(/\.[a-z0-9]+$/i, "")}.xlsx`;
}
