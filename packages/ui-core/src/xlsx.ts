// Minimal OOXML spreadsheet (.xlsx) writer: values, a bold header, number and date formats.
// Pure and dependency free; the package is built with `createZip` (STORE) from `./zip.js`.
import { createZip, type ZipEntry } from "./internal/xlsx-zip.js";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type XlsxCellValue = string | number | boolean | Date | null | undefined;

/**
 * How a column is displayed. The names cover the common cases; any other string is used as an
 * Excel number format code (for example `0.0%` or `"US$" #,##0.00`).
 */
export type XlsxFormat =
  | "general"
  | "text"
  | "integer"
  | "decimal"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | (string & {});

export interface XlsxColumn {
  header: string;
  /** Width in characters; measured from the content when omitted. */
  width?: number;
  format?: XlsxFormat;
  align?: "left" | "center" | "right";
}

export interface XlsxSheet {
  /** Sheet tab name; invalid characters are replaced and it is cut at 31 characters. */
  name: string;
  columns: readonly XlsxColumn[];
  /** One array per row, one value per column. Dates become real dates, numbers stay numbers. */
  rows: readonly (readonly XlsxCellValue[])[];
  /** Keeps the header row in view while scrolling (true by default). */
  freezeHeader?: boolean;
}

export interface XlsxWorkbook {
  sheets: readonly XlsxSheet[];
  creator?: string;
  /** Creation time stored in the file (now by default). */
  date?: Date;
}

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL_BASE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ---- helpers --------------------------------------------------------------------------------

// biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these control characters.
const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Escapes text for an XML element or attribute and drops characters XML cannot hold. */
export function escapeXml(text: string): string {
  return text
    .replace(ILLEGAL_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A, B, … Z, AA … for a 0-based column index. */
export function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel serial number of a local date and time (1900 date system). */
export function excelSerial(date: Date): number {
  const utc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  return utc / 86_400_000 + 25_569;
}

/** Tab name Excel accepts: no `[]:*?/\`, 1 to 31 characters, unique among `taken` (case-insensitive). */
export function sheetName(name: string, taken: ReadonlySet<string> = new Set()): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, " ")
      .replace(/^'+|'+$/g, "")
      .trim()
      .slice(0, 31) || "Hoja";
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  return candidate;
}

// ---- styles ---------------------------------------------------------------------------------

const BUILTIN_FORMATS: Record<string, number> = {
  general: 0,
  integer: 3,
  decimal: 4,
  percent: 9,
  text: 49,
};
const CUSTOM_FORMATS: Record<string, string> = {
  currency: '"S/" #,##0.00',
  date: "yyyy-mm-dd",
  datetime: "yyyy-mm-dd hh:mm",
};

class Styles {
  private readonly formats = new Map<string, number>();
  private readonly xfs: string[] = [];
  private readonly index = new Map<string, number>();

  constructor() {
    this.xf(0, false, undefined);
  }

  private formatId(format: XlsxFormat): number {
    const builtin = BUILTIN_FORMATS[format];
    if (builtin !== undefined) return builtin;
    const code = CUSTOM_FORMATS[format] ?? format;
    let id = this.formats.get(code);
    if (id === undefined) {
      id = 164 + this.formats.size;
      this.formats.set(code, id);
    }
    return id;
  }

  /** Index of the cell style for a format, header or body, and alignment. */
  xf(formatId: number, header: boolean, align: XlsxColumn["align"]): number {
    const key = `${formatId}|${header}|${align ?? ""}`;
    const known = this.index.get(key);
    if (known !== undefined) return known;
    const attrs = [
      `numFmtId="${formatId}"`,
      `fontId="${header ? 1 : 0}"`,
      `fillId="${header ? 2 : 0}"`,
      `borderId="${header ? 1 : 0}"`,
      'xfId="0"',
      formatId ? 'applyNumberFormat="1"' : "",
      header ? 'applyFont="1" applyFill="1" applyBorder="1"' : "",
      align ? 'applyAlignment="1"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    this.xfs.push(
      align ? `<xf ${attrs}><alignment horizontal="${align}"/></xf>` : `<xf ${attrs}/>`,
    );
    this.index.set(key, this.xfs.length - 1);
    return this.xfs.length - 1;
  }

  style(format: XlsxFormat, header: boolean, align: XlsxColumn["align"]): number {
    return this.xf(this.formatId(format), header, align);
  }

  toXml(): string {
    const custom = [...this.formats]
      .map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`)
      .join("");
    return (
      `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
      (custom ? `<numFmts count="${this.formats.size}">${custom}</numFmts>` : "") +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F1F1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }
}

class SharedStrings {
  private readonly index = new Map<string, number>();
  private count = 0;

  add(text: string): number {
    this.count += 1;
    const known = this.index.get(text);
    if (known !== undefined) return known;
    this.index.set(text, this.index.size);
    return this.index.size - 1;
  }

  toXml(): string {
    const items = [...this.index.keys()]
      .map((text) => {
        const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
        return `<si><t${preserve}>${escapeXml(text)}</t></si>`;
      })
      .join("");
    return `${XML_HEAD}<sst xmlns="${NS_MAIN}" count="${this.count}" uniqueCount="${this.index.size}">${items}</sst>`;
  }
}

// ---- worksheet ------------------------------------------------------------------------------

function textWidth(value: XlsxCellValue): number {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return 16;
  return String(value).length;
}

function columnWidths(sheet: XlsxSheet): number[] {
  return sheet.columns.map((column, c) => {
    if (column.width !== undefined) return column.width;
    let longest = textWidth(column.header) + 2;
    for (const row of sheet.rows) longest = Math.max(longest, textWidth(row[c]) + 1);
    return Math.min(60, Math.max(8, longest + 1));
  });
}

function sheetXml(sheet: XlsxSheet, styles: Styles, strings: SharedStrings): string {
  const cols = sheet.columns.length;
  const lastRow = sheet.rows.length + 1;
  const freeze = sheet.freezeHeader !== false;
  const widths = columnWidths(sheet);
  const header = sheet.columns
    .map((column, c) => {
      const style = styles.style("general", true, column.align);
      return `<c r="${columnName(c)}1" s="${style}" t="s"><v>${strings.add(column.header)}</v></c>`;
    })
    .join("");
  const rows = sheet.rows.map((values, index) => {
    const r = index + 2;
    const cells: string[] = [];
    for (let c = 0; c < cols; c += 1) {
      const value = values[c];
      if (value === null || value === undefined || value === "") continue;
      const column = sheet.columns[c] as XlsxColumn;
      const ref = `${columnName(c)}${r}`;
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) continue;
        const format = dateFormatOf(column.format);
        cells.push(
          `<c r="${ref}" s="${styles.style(format, false, column.align)}"><v>${excelSerial(value)}</v></c>`,
        );
      } else if (typeof value === "number") {
        if (!Number.isFinite(value)) continue;
        cells.push(
          `<c r="${ref}" s="${styles.style(column.format ?? "general", false, column.align)}"><v>${value}</v></c>`,
        );
      } else if (typeof value === "boolean") {
        cells.push(
          `<c r="${ref}" s="${styles.style("general", false, column.align)}" t="b"><v>${value ? 1 : 0}</v></c>`,
        );
      } else {
        cells.push(
          `<c r="${ref}" s="${styles.style("general", false, column.align)}" t="s"><v>${strings.add(value)}</v></c>`,
        );
      }
    }
    return cells.length ? `<row r="${r}">${cells.join("")}</row>` : `<row r="${r}"/>`;
  });

  const pane = freeze
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>'
    : "";
  const cellsRef = `A1:${columnName(Math.max(0, cols - 1))}${lastRow}`;
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${cellsRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols
      ? `<cols>${widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
      : "") +
    `<sheetData><row r="1">${header}</row>${rows.join("")}</sheetData>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    "</worksheet>"
  );
}

const NON_DATE_FORMATS = new Set(["general", "text", "integer", "decimal", "currency", "percent"]);

/** Dates keep their own format code; a number-like format on a date column falls back to `date`. */
function dateFormatOf(format: XlsxFormat | undefined): XlsxFormat {
  return !format || NON_DATE_FORMATS.has(format) ? "date" : format;
}

// ---- package --------------------------------------------------------------------------------

const rels = (items: readonly { id: string; type: string; target: string }[]) =>
  `${XML_HEAD}<Relationships xmlns="${NS_PACKAGE_REL}">${items
    .map(
      (item) =>
        `<Relationship Id="${item.id}" Type="${REL_BASE}/${item.type}" Target="${item.target}"/>`,
    )
    .join("")}</Relationships>`;

/**
 * Builds the bytes of an .xlsx file: workbook, one worksheet per sheet, shared strings, styles
 * (bold header, number and date formats) and document properties.
 */
export function buildXlsx(workbook: XlsxWorkbook): Uint8Array {
  const sheets =
    workbook.sheets.length > 0 ? workbook.sheets : [{ name: "Hoja", columns: [], rows: [] }];
  const styles = new Styles();
  const strings = new SharedStrings();
  const taken = new Set<string>();
  const names = sheets.map((sheet) => {
    const name = sheetName(sheet.name, taken);
    taken.add(name.toLowerCase());
    return name;
  });
  const worksheets = sheets.map((sheet) => sheetXml(sheet, styles, strings));
  const created = (workbook.date ?? new Date()).toISOString().replace(/\.\d+Z$/, "Z");

  const files: ZipEntry[] = [];
  const add = (name: string, xml: string) =>
    files.push({ name, data: new TextEncoder().encode(xml) });

  add(
    "[Content_Types].xml",
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      "</Types>",
  );
  add(
    "_rels/.rels",
    rels([{ id: "rId1", type: "officeDocument", target: "xl/workbook.xml" }]).replace(
      "</Relationships>",
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    ),
  );
  add(
    "docProps/core.xml",
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      (workbook.creator ? `<dc:creator>${escapeXml(workbook.creator)}</dc:creator>` : "") +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`,
  );
  add(
    "xl/workbook.xml",
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView/></bookViews><sheets>${names
      .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    rels([
      ...sheets.map((_, i) => ({
        id: `rId${i + 1}`,
        type: "worksheet",
        target: `worksheets/sheet${i + 1}.xml`,
      })),
      { id: `rId${sheets.length + 1}`, type: "styles", target: "styles.xml" },
      { id: `rId${sheets.length + 2}`, type: "sharedStrings", target: "sharedStrings.xml" },
    ]),
  );
  for (const [i, xml] of worksheets.entries()) add(`xl/worksheets/sheet${i + 1}.xml`, xml);
  add("xl/styles.xml", styles.toXml());
  add("xl/sharedStrings.xml", strings.toXml());
  return createZip(files, { date: workbook.date });
}

export {
  crc32,
  createZip,
  dosDateTime,
  type ZipEntry,
  type ZipOptions,
} from "./internal/xlsx-zip.js";
