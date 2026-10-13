import type { CellValue, GridColumn } from "./model.js";

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

interface Separators {
  group: string;
  decimal: string;
}

const separators = new Map<string, Separators>();

function separatorsOf(locale: string): Separators {
  let found = separators.get(locale);
  if (!found) {
    const parts = new Intl.NumberFormat(locale).formatToParts(-12345.6);
    const pick = (type: string, fallback: string) =>
      parts.find((part) => part.type === type)?.value ?? fallback;
    found = { group: pick("group", ","), decimal: pick("decimal", ".") };
    separators.set(locale, found);
  }
  return found;
}

/**
 * A number from text typed in `locale`: its group separator (any kind of space included) is
 * dropped and its decimal mark is read as the point. A lone group mark followed by fewer or more
 * than three digits is read as the decimal mark (`12,5` in English), the way people type it.
 * `null` when the text is not a number (empty text included: callers check it first).
 */
export function parseNumber(text: string, locale: string): number | null {
  const { group, decimal } = separatorsOf(locale);
  let clean = text.replace(/[\s  ]/g, "");
  const marks = (mark: string) => clean.split(mark).length - 1;
  if (
    !clean.includes(decimal) &&
    marks(group) === 1 &&
    !new RegExp(`\\${group}\\d{3}$`).test(clean)
  )
    clean = clean.replace(group, decimal);
  clean = clean.split(group).join("").replace(decimal, ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
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

const pad = (value: number, size: number) => String(value).padStart(size, "0");

/**
 * A date from text typed in `locale` (day, month and year in that locale's order) or as ISO
 * `yyyy-mm-dd`. A two-digit year is read as 20xx. `null` for an impossible date such as 31/02.
 */
export function parseDate(text: string, locale: string): Date | null {
  const parts = text.trim().split(/\D+/).filter(Boolean);
  if (parts.length !== 3 || !/^\d/.test(text.trim())) return null;
  const iso = (parts[0] as string).length === 4;
  const order = iso ? (["year", "month", "day"] as const) : patternOf(locale).order;
  const get = (name: string) => Number(parts[order.indexOf(name as "day")]);
  let year = get("year");
  if (!iso && (parts[order.indexOf("year")] as string).length <= 2) year += 2000;
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
    const date = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(date.getTime()) ? String(value) : formatDateDraft(date, locale);
  }
  if (kind === "number" && typeof value === "number")
    return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 }).format(
      value,
    );
  return String(value);
}

export type DraftResult =
  | { value: CellValue }
  | { error: "number" | "date" | "parse"; message?: string };

/**
 * The value a text editor stores: the column's `parse`, else the built-in for its kind. Empty text
 * stores `null` for numbers and dates and `""` for text.
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
 * Runs the column's `validate`, which may be asynchronous. Resolves to the error message, or
 * `null` when the value is accepted. A validator that throws refuses the value with its message.
 */
export async function validateValue<T>(
  column: GridColumn<T>,
  value: CellValue,
  row: T,
): Promise<string | null> {
  if (!column.validate) return null;
  try {
    return (await column.validate(value, row)) || null;
  } catch (error) {
    return error instanceof Error && error.message ? error.message : "Invalid value";
  }
}
