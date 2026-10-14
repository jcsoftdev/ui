import {
  type CellValue,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
} from "../grid/model.js";

/** `null`, `undefined`, `""` and `NaN` are empty. */
export function isEmptyValue(value: CellValue): boolean {
  return value === null || value === undefined || value === "" || Number.isNaN(value);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A stored date value as a Date: a date-only ISO string is the LOCAL day, not UTC midnight. */
export function toDate(value: CellValue): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const day = DATE_ONLY.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A usable canonical BCP 47 tag, `en` when absent or invalid. Call once, not per cell. */
export function canonicalLocale(locale: string | undefined): string {
  if (!locale) return "en";
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "en";
  } catch {
    return "en";
  }
}

/** Locale-independent text key of a value: dates by local day, the rest as `String`. */
export function rawKey(value: CellValue): string {
  if (isEmptyValue(value)) return "";
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return "";
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value);
}

/** Epoch milliseconds of a date-like value, `null` when it is not one. */
export function toTime(value: CellValue): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string") return toDate(value)?.getTime() ?? null;
  if (typeof value === "number") {
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
