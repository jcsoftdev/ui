import { formatCurrency, formatNumber } from "../chart/format.js";

/** A value a cell can show. Mirrors the React kit's `CellValue`. */
export type CellValue = string | number | boolean | Date | null | undefined;

export type ColumnType = "text" | "number" | "currency" | "date" | "status" | "boolean";
export type ColumnAlign = "start" | "center" | "end";

/** What a custom cell renderer receives. */
export interface CellContext<T> {
  row: T;
  rowId: string;
  value: CellValue;
  /** The value as text, with the column's formatter applied. */
  formatted: string;
}

/**
 * What a custom renderer returns: a `Node` is inserted as is, a string becomes text (never HTML),
 * `null` / `undefined` falls back to the formatted value.
 */
export type CellContent = Node | string | null | undefined;

/** Column definition. Same names as the React kit's `DataGridColumn` for the pieces D1 covers. */
export interface GridColumn<T> {
  id: string;
  header: string;
  /** Property name or function that reads the cell value from a row. Defaults to `id`. */
  accessor?: keyof T | ((row: T) => CellValue);
  /** Custom cell content (see `CellContent`). */
  cell?: (context: CellContext<T>) => CellContent;
  /**
   * Tag of a custom element created inside the cell (must contain a hyphen). It gets `value`,
   * `row`, `rowId`, `column` and `formatted` properties and is reused while the row is pooled.
   */
  cellTag?: string;
  type?: ColumnType;
  /** ISO 4217 code of a `currency` column, e.g. `PEN`. There is no default: without one the value shows as a plain number. */
  currency?: string;
  /** Text shown for a value. */
  format?: (value: CellValue) => string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Weight of the leftover width this column takes; text columns default to 1, the rest to 0. */
  grow?: number;
  align?: ColumnAlign;
  sortable?: boolean;
  pinnable?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
}

export function getCellValue<T>(row: T, column: GridColumn<T>): CellValue {
  const accessor = column.accessor ?? (column.id as keyof T);
  if (typeof accessor === "function") return accessor(row);
  return (row as Record<PropertyKey, unknown>)?.[accessor] as CellValue;
}

/** Locale and wording used to turn a value into text. */
export interface FormatOptions {
  /** BCP 47 tag; defaults to `en`. Dates, numbers and currencies follow it. */
  locale?: string;
  /** Currency of `currency` columns that do not name their own. */
  currency?: string;
  /** Text for booleans; defaults to English. */
  labels?: { yes?: string; no?: string };
}

export const DEFAULT_LOCALE = "en";

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A usable BCP 47 tag: an invalid or empty one falls back to the default locale. */
function usableLocale(locale: string | undefined): string {
  if (!locale) return DEFAULT_LOCALE;
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function dateFormat(locale: string): Intl.DateTimeFormat {
  let format = dateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
    dateFormats.set(locale, format);
  }
  return format;
}

/**
 * Cell text: the column formatter, or the defaults for `options.locale` (default `en`). Numbers and
 * currencies keep the Peruvian no-break thousands space only when the locale is `es-PE`.
 */
export function formatCellValue<T>(
  value: CellValue,
  column: GridColumn<T>,
  options: FormatOptions = {},
): string {
  if (column.format) return column.format(value);
  if (value === null || value === undefined || value === "") return "";
  const locale = usableLocale(options.locale);
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "" : dateFormat(locale).format(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (column.type === "currency")
      return formatCurrency(value, { locale, currency: column.currency ?? options.currency });
    if (column.type === "number") return formatNumber(value, { locale });
    return String(value);
  }
  if (typeof value === "boolean")
    return value ? (options.labels?.yes ?? "Yes") : (options.labels?.no ?? "No");
  return value;
}

export function columnAlign<T>(column: GridColumn<T>): ColumnAlign {
  if (column.align) return column.align;
  return column.type === "number" || column.type === "currency" ? "end" : "start";
}
