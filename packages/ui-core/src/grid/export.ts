import type { XlsxCellValue, XlsxColumn, XlsxFormat, XlsxSheet } from "../xlsx.js";
import {
  type CellValue,
  columnAlign,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
  getCellValue,
} from "./model.js";
import type { GridView } from "./view.js";

/**
 * Which value each cell carries. `auto` (the React kit's CSV): numbers raw, dates as ISO, the rest
 * as the column formats it. `formatted`: everything as shown. `raw`: the stored value as text.
 */
export type ExportValues = "auto" | "formatted" | "raw";

export interface ExportOptions<T> extends FormatOptions {
  /** The rows being shown, in view order. */
  view: GridView;
  /** Source rows the view indexes. */
  rows: readonly T[];
  /** Visible columns, in display order. */
  columns: readonly GridColumn<T>[];
  values?: ExportValues;
  /**
   * `rows` keeps group rows (label in the first column, aggregates in their columns) and, in
   * xlsx, gives them outline levels; `omit` (default) exports data rows only.
   */
  groups?: "omit" | "rows";
}

export interface ExportRow {
  kind: "data" | "group";
  /** Outline level: the group depth of a group row, the number of groups above a data row. */
  level: number;
  cells: CellValue[];
}

export interface ExportTable<T> {
  columns: readonly GridColumn<T>[];
  headers: string[];
  rows: ExportRow[];
}

/** The "what you see" table: view rows in order and visible columns, values still raw. */
export function buildExportTable<T>(options: ExportOptions<T>): ExportTable<T> {
  const { view, rows, columns, groups = "omit" } = options;
  const out: ExportRow[] = [];
  for (let v = 0; v < view.count; v += 1) {
    const entry = view.row(v);
    if (entry.kind === "group") {
      if (groups !== "rows") continue;
      const info = entry.group;
      const cells: CellValue[] = [];
      for (let c = 0; c < columns.length; c += 1) {
        const id = (columns[c] as GridColumn<T>).id;
        cells.push(c === 0 ? (info?.label ?? "") : (info?.aggregates[id] ?? null));
      }
      out.push({ kind: "group", level: entry.depth, cells });
      continue;
    }
    const source = rows[entry.source] as T;
    const cells: CellValue[] = [];
    for (let c = 0; c < columns.length; c += 1)
      cells.push(getCellValue(source, columns[c] as GridColumn<T>));
    out.push({ kind: "data", level: groups === "rows" ? entry.depth : 0, cells });
  }
  return { columns, headers: columns.map((column) => column.header), rows: out };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local `yyyy-mm-dd`, with ` hh:mm:ss` when the date has a time of day. */
export function isoDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!date.getHours() && !date.getMinutes() && !date.getSeconds()) return day;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function cellText<T>(
  value: CellValue,
  column: GridColumn<T>,
  mode: ExportValues,
  format: FormatOptions,
): { text: string; numeric: boolean } {
  const formatted = () => formatCellValue(value, column, format);
  if (mode !== "formatted") {
    if (typeof value === "number")
      return { text: Number.isFinite(value) ? String(value) : "", numeric: true };
    if (value instanceof Date) return { text: isoDate(value), numeric: true };
    if (mode === "raw") {
      if (typeof value === "boolean") return { text: String(value), numeric: true };
      return { text: value === null || value === undefined ? "" : value, numeric: false };
    }
  }
  return { text: formatted(), numeric: typeof value === "number" };
}

const FORMULA = /^[=+\-@\t\r]/;
const NUMERIC = /^[-+]?\d[\d.,\s  ']*$/;

/** Prefixes `'` to text a spreadsheet would run as a formula (`= + - @`, tab, CR). */
export function neutralizeFormula(text: string, numeric = false): string {
  if (!FORMULA.test(text)) return text;
  return numeric && NUMERIC.test(text) ? text : `'${text}`;
}

export interface DelimitedOptions {
  /** Field separator: `,` for CSV (default), a tab for TSV. */
  separator?: string;
  /** Prefix a UTF-8 BOM so spreadsheet apps read accents correctly. */
  bom?: boolean;
  /** Neutralize formula injection (default `true`). */
  neutralize?: boolean;
  eol?: string;
}

function field(text: string, separator: string): string {
  return /["\r\n]/.test(text) || text.includes(separator) || /^\s|\s$/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/** Joins the table as delimited text with a header row. Quotes fields that need it. */
export function toDelimited<T>(
  table: ExportTable<T>,
  options: DelimitedOptions & FormatOptions & { values?: ExportValues } = {},
): string {
  const {
    separator = ",",
    bom = false,
    neutralize = true,
    eol = "\r\n",
    values = "auto",
  } = options;
  const format: FormatOptions = { locale: options.locale, labels: options.labels };
  const safe = (text: string, numeric: boolean) =>
    field(neutralize ? neutralizeFormula(text, numeric) : text, separator);
  const lines = [table.headers.map((header) => safe(header, false)).join(separator)];
  for (const row of table.rows) {
    const parts = new Array<string>(table.columns.length);
    for (let c = 0; c < parts.length; c += 1) {
      const value = row.cells[c];
      if (row.kind === "group" && c === 0) {
        parts[c] = safe(String(value ?? ""), false);
        continue;
      }
      const { text, numeric } = cellText(value, table.columns[c] as GridColumn<T>, values, format);
      parts[c] = safe(text, numeric);
    }
    lines.push(parts.join(separator));
  }
  return `${bom ? "﻿" : ""}${lines.join(eol)}`;
}

export function exportCsv<T>(
  options: ExportOptions<T> & Omit<DelimitedOptions, "separator">,
): string {
  return toDelimited(buildExportTable(options), { ...options, separator: "," });
}

export function exportTsv<T>(
  options: ExportOptions<T> & Omit<DelimitedOptions, "separator">,
): string {
  return toDelimited(buildExportTable(options), { ...options, separator: "\t" });
}

const ALIGN = { start: "left", center: "center", end: "right" } as const;

function hasTime(value: Date): boolean {
  return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
}

function xlsxFormatOf<T>(column: GridColumn<T>, values: readonly XlsxCellValue[]): XlsxFormat {
  if (column.type === "currency") return "currency";
  if (column.type === "date")
    return values.some((value) => value instanceof Date && hasTime(value)) ? "datetime" : "date";
  if (column.type === "number") {
    const numbers = values.filter((value): value is number => typeof value === "number");
    return numbers.length > 0 && numbers.every(Number.isInteger) ? "integer" : "decimal";
  }
  return "general";
}

export interface XlsxExportOptions<T> extends ExportOptions<T> {
  /** Sheet tab name. Default `Sheet1`. */
  sheetName?: string;
  creator?: string;
  date?: Date;
}

/** The typed sheet of the xlsx writer: numbers stay numbers, dates stay dates. */
export function toXlsxSheet<T>(table: ExportTable<T>, options: XlsxExportOptions<T>): XlsxSheet {
  const mode = options.values ?? "auto";
  const format: FormatOptions = { locale: options.locale, labels: options.labels };
  const body = table.rows.map((row) =>
    row.cells.map((value, c): XlsxCellValue => {
      if (row.kind === "group" && c === 0) return String(value ?? "");
      if (mode === "formatted")
        return formatCellValue(value, table.columns[c] as GridColumn<T>, format);
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      return value;
    }),
  );
  const columns: XlsxColumn[] = table.columns.map((column, c) => ({
    header: column.header,
    format:
      mode === "formatted"
        ? "general"
        : xlsxFormatOf(
            column,
            body.map((line) => line[c]),
          ),
    align: ALIGN[columnAlign(column)],
  }));
  const sheet: XlsxSheet = { name: options.sheetName ?? "Sheet1", columns, rows: body };
  if (table.rows.some((row) => row.level > 0)) sheet.outline = table.rows.map((row) => row.level);
  return sheet;
}

/** The .xlsx bytes. The writer is imported on demand, so CSV-only users never load it. */
export async function exportXlsx<T>(options: XlsxExportOptions<T>): Promise<Uint8Array> {
  const { buildXlsx } = await import("../xlsx.js");
  return buildXlsx({
    sheets: [toXlsxSheet(buildExportTable(options), options)],
    creator: options.creator,
    date: options.date,
  });
}

/** File name with the given extension (`xlsx`, `csv`, `tsv`). */
export function exportFilename(name: string, extension: "xlsx" | "csv" | "tsv"): string {
  const pattern = new RegExp(`\\.${extension}$`, "i");
  return pattern.test(name) ? name : `${name.replace(/\.[a-z0-9]+$/i, "")}.${extension}`;
}
