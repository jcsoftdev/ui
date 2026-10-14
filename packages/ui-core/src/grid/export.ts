import { toDate } from "../internal/grid-values.js";
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
   * `omit` (default) exports every filtered row in sorted order, as the React kit does, collapsed
   * groups included. `rows` follows what is on screen: group rows (label in the first column,
   * aggregates in their columns; outline levels in xlsx) and only the rows of expanded groups.
   */
  groups?: "omit" | "rows";
  /**
   * Row keys to export (selected rows only). Group rows are left out. Without it, every row of
   * the view is exported.
   */
  selected?: ReadonlySet<string>;
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

/** The table to export: the view's rows (see `ExportOptions.groups`), values still raw. */
export function buildExportTable<T>(options: ExportOptions<T>): ExportTable<T> {
  const { view, rows, columns, groups = "omit", selected } = options;
  const out: ExportRow[] = [];
  const cellsOf = (source: number) => {
    const row = rows[source] as T;
    const cells: CellValue[] = [];
    for (let c = 0; c < columns.length; c += 1)
      cells.push(getCellValue(row, columns[c] as GridColumn<T>));
    return cells;
  };
  if (groups === "omit" || selected) {
    if (groups === "omit") {
      const order = view.sourceOrder();
      for (let i = 0; i < order.length; i += 1) {
        const source = order[i] as number;
        if (selected && !selected.has(view.sourceKey(source))) continue;
        out.push({ kind: "data", level: 0, cells: cellsOf(source) });
      }
    } else {
      for (let v = 0; v < view.count; v += 1) {
        const entry = view.row(v);
        if (entry.kind === "data" && selected?.has(entry.key))
          out.push({ kind: "data", level: entry.depth, cells: cellsOf(entry.source) });
      }
    }
    return { columns, headers: columns.map((column) => column.header), rows: out };
  }
  for (let v = 0; v < view.count; v += 1) {
    const entry = view.row(v);
    if (entry.kind === "group") {
      const info = entry.group;
      const cells: CellValue[] = [];
      for (let c = 0; c < columns.length; c += 1) {
        const id = (columns[c] as GridColumn<T>).id;
        cells.push(c === 0 ? (info?.label ?? "") : (info?.aggregates[id] ?? null));
      }
      out.push({ kind: "group", level: entry.depth, cells });
    } else out.push({ kind: "data", level: entry.depth, cells: cellsOf(entry.source) });
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
): { text: string; numeric: boolean; plain?: boolean } {
  const formatted = () => formatCellValue(value, column, format);
  if (mode !== "formatted") {
    if (typeof value === "number")
      return { text: Number.isFinite(value) ? String(value) : "", numeric: true, plain: true };
    if (value instanceof Date) return { text: isoDate(value), numeric: true, plain: true };
    if (mode === "raw") {
      if (typeof value === "boolean") return { text: String(value), numeric: true, plain: true };
      return { text: value === null || value === undefined ? "" : value, numeric: false };
    }
  }
  return { text: formatted(), numeric: typeof value === "number" };
}

const FORMULA = /^[=+\-@\t\r\uff1d\uff0b\uff0d\uff20\u2212]/;
// A formatted number or currency: optional sign and currency mark, digits with grouping, and a
// trailing mark or percent (`-S/ 1 234.50`, `(1,5) %`-free). Letters only appear as a short mark.
const NUMERIC =
  /^[-+\u2212]?\s*[\p{Sc}A-Za-z]{0,3}[./]?\s*[-+\u2212]?\d[\d.,\s'\u00a0\u202f\u2019]*\s*[\p{Sc}%]?$/u;

/**
 * Prefixes `'` to text a spreadsheet would run as a formula (`= + - @`, their fullwidth forms, tab,
 * CR), after leading spaces. `numeric` marks the text of a number cell: a formatted number or
 * currency (`-S/ 1 234.50`) is left alone, `-abc` or `=1+1` never are.
 */
export function neutralizeFormula(text: string, numeric = false): string {
  const lead = text.replace(/^[ \u00a0]+/, "");
  if (!FORMULA.test(lead)) return text;
  return numeric && NUMERIC.test(lead) ? text : `'${text}`;
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
  const safe = (text: string, numeric: boolean, plain = false) =>
    field(neutralize && !plain ? neutralizeFormula(text, numeric) : text, separator);
  const lines = [table.headers.map((header) => safe(header, false)).join(separator)];
  for (const row of table.rows) {
    const parts = new Array<string>(table.columns.length);
    for (let c = 0; c < parts.length; c += 1) {
      const value = row.cells[c];
      if (row.kind === "group" && c === 0) {
        parts[c] = safe(String(value ?? ""), false);
        continue;
      }
      const { text, numeric, plain } = cellText(
        value,
        table.columns[c] as GridColumn<T>,
        values,
        format,
      );
      parts[c] = safe(text, numeric, plain);
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
      if (typeof value === "string" && (table.columns[c] as GridColumn<T>).type === "date")
        return toDate(value) ?? value;
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
