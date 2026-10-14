import { toDate } from "../internal/grid-values.js";
import type { CellValue, GridColumn } from "./model.js";

export { toDate };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type EditorKind = "text" | "number" | "select" | "boolean" | "date";

const KINDS: readonly string[] = ["text", "number", "select", "boolean", "date"];

/** What starts an edit; `beforecelledit` carries it. */
export type EditTrigger = "enter" | "f2" | "dblclick" | "type" | "tab" | "api";

/**
 * The editor of a column: its own built-in (`editor`), else `select` when it has `options`, else
 * from its `type`. `custom` for a tag or a factory.
 */
export function editorKind<T>(column: GridColumn<T>): EditorKind | "custom" {
  const editor = column.editor;
  if (editor !== undefined)
    return KINDS.includes(editor as string) ? (editor as EditorKind) : "custom";
  if (column.options?.length) return "select";
  if (column.type === "number" || column.type === "currency") return "number";
  if (column.type === "date") return "date";
  if (column.type === "boolean") return "boolean";
  return "text";
}

/** Whether the edited value is the one already stored (dates by time, the rest by identity). */
export function sameValue(a: CellValue, b: CellValue): boolean {
  if (a === b || (a == null && b == null)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

export interface NormalizedOption {
  value: string | number;
  label: string;
}

export function normalizeOptions(
  options: readonly (string | number | NormalizedOption)[],
): NormalizedOption[] {
  return options.map((option) =>
    typeof option === "object" ? option : { value: option, label: String(option) },
  );
}

interface NumberFormat {
  group: string;
  decimal: string;
  /** Native digit -> ASCII digit, and native separators -> the Latin ones (e.g. Arabic-Indic). */
  native: Map<string, string>;
  /** Groups of 2 digits above the first three (hi-IN, en-IN). */
  indian: boolean;
}

const formats = new Map<string, NumberFormat>();

function numberFormat(locale: string): NumberFormat {
  let found = formats.get(locale);
  if (!found) {
    const pick = (parts: Intl.NumberFormatPart[], type: string, fallback: string) =>
      parts.find((part) => part.type === type)?.value ?? fallback;
    const latin = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).formatToParts(
      -12345.6,
    );
    const local = new Intl.NumberFormat(locale);
    const group = pick(latin, "group", ",");
    const decimal = pick(latin, "decimal", ".");
    const native = new Map<string, string>();
    const parts = local.formatToParts(-12345.6);
    native.set(pick(parts, "group", group), group);
    native.set(pick(parts, "decimal", decimal), decimal);
    const digits = new Intl.NumberFormat(locale, { useGrouping: false });
    for (let digit = 0; digit < 10; digit += 1) native.set(digits.format(digit), String(digit));
    found = { group, decimal, native, indian: /\D\d{2}\D\d{3}$/.test(local.format(1234567)) };
    formats.set(locale, found);
  }
  return found;
}

/** Bidi marks, and the true minus sign (sv-SE, nb-NO) read as a hyphen. */
const normalizeSigns = (text: string) =>
  text
    .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\u2212\u2012-\u2014]/g, "-");

/**
 * A number from text typed in `locale`: native digits and separators are read as Latin ones, any
 * kind of space is dropped, and the decimal mark is the locale's. Group marks are only valid in the
 * integer part and every three digits (`1,234,567`); `1,2,3` or `1.234.5` are not numbers. A lone
 * group mark followed by other than three digits is read as the decimal mark (`12,5` in English),
 * the way people type it. `null` when the text is not a number (empty text included).
 */
export function parseNumber(text: string, locale: string): number | null {
  const { group, decimal, native, indian } = numberFormat(locale);
  let clean = "";
  for (const char of normalizeSigns(text).replace(/[\s\u00a0\u202f]/g, ""))
    clean += native.get(char) ?? char;
  const sign = /^[+-]/.test(clean) ? (clean.startsWith("-") ? -1 : 1) : 0;
  if (sign) clean = clean.slice(1);
  const marks = (mark: string) => clean.split(mark).length - 1;
  if (
    !clean.includes(decimal) &&
    marks(group) === 1 &&
    !new RegExp(`\\${group}\\d{3}$`).test(clean)
  )
    clean = clean.replace(group, decimal);
  if (marks(decimal) > 1) return null;
  const [whole = "", fraction = ""] = clean.split(decimal);
  const g = `\\${group}`;
  const pattern = indian ? `\\d{1,2}(${g}\\d{2})*${g}\\d{3}` : `\\d{1,3}(${g}\\d{3})+`;
  const grouped = new RegExp(`^(${pattern}|\\d+)$`);
  if (!grouped.test(whole) && whole !== "") return null;
  if (!/^\d*$/.test(fraction) || (whole === "" && fraction === "")) return null;
  const value = Number(`${whole.split(group).join("") || "0"}.${fraction || "0"}`);
  return Number.isFinite(value) ? (sign < 0 ? -value : value) : null;
}

interface DatePattern {
  order: ("day" | "month" | "year")[];
  separator: string;
}

const patterns = new Map<string, DatePattern>();

function patternOf(locale: string): DatePattern {
  let found = patterns.get(locale);
  if (!found) {
    const parts = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      numberingSystem: "latn",
    }).formatToParts(new Date(2000, 10, 22));
    const order = parts
      .map((part) => part.type)
      .filter(
        (type): type is "day" | "month" | "year" =>
          type === "day" || type === "month" || type === "year",
      );
    found = {
      order: order.length === 3 ? order : ["year", "month", "day"],
      separator: parts.find((part) => part.type === "literal")?.value.trim() || "/",
    };
    patterns.set(locale, found);
  }
  return found;
}

const pad = (value: number, size: number) => String(value).padStart(size, "0");

/** The date as it is typed in `locale`: two-digit day and month, four-digit year (`22/11/2000`). */
export function formatDateDraft(date: Date, locale: string): string {
  const { order, separator } = patternOf(locale);
  const field = {
    day: pad(date.getDate(), 2),
    month: pad(date.getMonth() + 1, 2),
    year: pad(date.getFullYear(), 4),
  };
  return order.map((name) => field[name]).join(separator);
}

/** A hint for the date editor, such as `dd/mm/yyyy`. */
export function datePlaceholder(locale: string): string {
  const { order, separator } = patternOf(locale);
  return order
    .map((name) => (name === "year" ? "yyyy" : name === "month" ? "mm" : "dd"))
    .join(separator);
}

/** A two-digit year in the century that puts it within 50 years of `now`. */
function expandYear(year: number, now = new Date().getFullYear()): number {
  let full = Math.floor(now / 100) * 100 + year;
  if (full - now > 50) full -= 100;
  else if (now - full >= 50) full += 100;
  return full;
}

/**
 * A date from text typed in `locale` (day, month and year in that locale's order) or as ISO
 * `yyyy-mm-dd`, as a LOCAL date at midnight. A two-digit year is read within 50 years of today.
 * `null` for an impossible date such as 31/02.
 */
export function parseDate(text: string, locale: string): Date | null {
  const parts = text.trim().split(/\D+/).filter(Boolean);
  if (parts.length !== 3 || !/^\d/.test(text.trim())) return null;
  const iso = (parts[0] as string).length === 4;
  const order = iso ? (["year", "month", "day"] as const) : patternOf(locale).order;
  const get = (name: string) => Number(parts[order.indexOf(name as "day")]);
  let year = get("year");
  if (!iso && (parts[order.indexOf("year")] as string).length <= 2) year = expandYear(year);
  const month = get("month");
  const day = get("day");
  const date = new Date(year, month - 1, day);
  date.setFullYear(year);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** The text an editor starts with for a stored value. */
export function draftText(kind: EditorKind | "custom", value: CellValue, locale: string): string {
  if (value === null || value === undefined) return "";
  if (kind === "date") {
    const date = toDate(value);
    return date ? formatDateDraft(date, locale) : String(value);
  }
  if (kind === "number" && typeof value === "number")
    return normalizeSigns(
      new Intl.NumberFormat(locale, {
        useGrouping: false,
        maximumFractionDigits: 20,
        numberingSystem: "latn",
      }).format(value),
    );
  return String(value);
}

/**
 * The value to store for an edited `value`, in the type of the `original`: a date-only ISO string
 * stays a date-only string, an ISO timestamp keeps its time of day and format, a date keeps its
 * time of day, and a numeric string stays a string. Anything else is returned as is.
 */
export function likeOriginal(value: CellValue, original: CellValue): CellValue {
  if (value === null || value === undefined) return value;
  if (value instanceof Date && original !== null && original !== undefined) {
    const at = toDate(original);
    if (!at) return value;
    const next = new Date(value.getTime());
    next.setHours(at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds());
    if (typeof original !== "string") return next;
    return DATE_ONLY.test(original)
      ? `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1, 2)}-${pad(value.getDate(), 2)}`
      : next.toISOString();
  }
  if (typeof value === "number" && typeof original === "string") return String(value);
  return value;
}

export type DraftResult =
  | { value: CellValue }
  | { error: "number" | "date" | "parse"; message?: string };

/**
 * The value a text editor stores: the column's `parse`, else the built-in for its kind. Empty text
 * stores `null` for numbers and dates and `""` for text. A `parse` that returns `NaN` is an error.
 */
export function parseDraft<T>(
  column: GridColumn<T>,
  kind: EditorKind | "custom",
  text: string,
  row: T,
  locale: string,
): DraftResult {
  if (column.parse) {
    const result = column.parse(text, { row, locale });
    if (typeof result === "number" && Number.isNaN(result)) return { error: "parse" };
    if (typeof result === "object" && result !== null && !(result instanceof Date))
      return { error: "parse", message: result.error };
    return { value: result };
  }
  if (kind === "number" || kind === "date") {
    if (text.trim() === "") return { value: null };
    const value = kind === "number" ? parseNumber(text, locale) : parseDate(text, locale);
    return value === null ? { error: kind } : { value };
  }
  return { value: text };
}

/**
 * Runs the column's `validate`, which may be asynchronous and gets an `AbortSignal` that fires
 * when the edit is cancelled, changed or superseded. Resolves to the error message, or `null`
 * when the value is accepted. A validator that throws refuses the value with its message.
 */
export async function validateValue<T>(
  column: GridColumn<T>,
  value: CellValue,
  row: T,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!column.validate) return null;
  try {
    return (await column.validate(value, row, signal)) || null;
  } catch (error) {
    return error instanceof Error && error.message ? error.message : "Invalid value";
  }
}
