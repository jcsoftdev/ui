import {
  type CellValue,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
} from "../grid/model.js";

export function isEmptyValue(value: CellValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Epoch milliseconds of a date-like value, `null` when it is not one. */
export function toTime(value: CellValue): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

/** Finite number of a numeric-like value (dates become their time), `null` otherwise. */
export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return toTime(value);
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

/** Value used by set filters, grouping and pivots: dates and booleans as text, the rest as `String`. */
export function selectKey<T>(
  value: CellValue,
  column: GridColumn<T>,
  options?: FormatOptions,
): string {
  if (value instanceof Date || typeof value === "boolean")
    return formatCellValue(value, column, options);
  return value === null || value === undefined ? "" : String(value);
}
