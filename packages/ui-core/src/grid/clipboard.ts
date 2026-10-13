import {
  draftText,
  type EditorKind,
  editorKind,
  formatDateDraft,
  likeOriginal,
  normalizeOptions,
  parseDraft,
} from "./edit.js";
import type { CellValue, GridColumn } from "./model.js";

/** Whether a quote that opened before `from` is closed later (`""` is an escaped quote). */
function closes(text: string, from: number): boolean {
  for (let i = text.indexOf('"', from); i >= 0; i = text.indexOf('"', i + 2))
    if (text[i + 1] !== '"') return true;
  return false;
}

/**
 * Parses tab separated text, the clipboard format of spreadsheets. A field that starts with a quote
 * runs to the closing quote and may hold tabs, line breaks and `""` for a quote. Rows end at
 * `\n`, `\r\n` or `\r`; one trailing line break does not add an empty row. A quote that is never
 * closed is an ordinary character.
 */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let atStart = true;
  /** Something belongs to the row being read: a tab, a character or a quote. */
  let open = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"' && atStart && closes(text, i + 1)) {
      quoted = true;
      atStart = false;
      open = true;
    } else if (char === "\t") {
      row.push(field);
      field = "";
      atStart = true;
      open = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atStart = true;
      open = false;
    } else {
      field += char;
      atStart = false;
      open = true;
    }
  }
  if (open) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * The text a cell is copied as: what the editor would show for it, so that pasting it back in the
 * same locale gives the same value (numbers without grouping, dates as typed, a select's label,
 * `true` / `false`).
 */
export function copyText<T>(column: GridColumn<T>, value: CellValue, locale: string): string {
  if (value === null || value === undefined) return "";
  const kind = editorKind(column);
  if (kind === "select") {
    const option = normalizeOptions(column.options ?? []).find(
      (choice) => String(choice.value) === String(value),
    );
    return option ? option.label : String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return formatDateDraft(value, locale);
  return draftText(kind, value, locale);
}

const quoteField = (text: string) =>
  /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

/**
 * Tab separated text of a range. `textAt` returns `null` for a cell that is not data (a group row,
 * the checkbox column); rows and columns made only of those are left out.
 */
export function formatTSV(
  bounds: { r0: number; r1: number; c0: number; c1: number },
  textAt: (r: number, c: number) => string | null,
): string {
  const cols: number[] = [];
  for (let c = bounds.c0; c <= bounds.c1; c += 1) {
    for (let r = bounds.r0; r <= bounds.r1; r += 1) {
      if (textAt(r, c) !== null) {
        cols.push(c);
        break;
      }
    }
  }
  const lines: string[] = [];
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    const cells = cols.map((c) => textAt(r, c));
    if (cells.every((text) => text === null)) continue;
    lines.push(cells.map((text) => quoteField(text ?? "")).join("\t"));
  }
  return lines.join("\n");
}

export interface PasteTarget {
  r: number;
  c: number;
  text: string;
  /** Line and field of the pasted table this text came from (0, 0 for a single value filling). */
  i?: number;
  j?: number;
}

export interface PastePlan {
  targets: PasteTarget[];
  /** Cells of the pasted block that fell outside the grid and were dropped. */
  clipped: number;
}

/**
 * Where a pasted block lands. A single value over a larger selection fills the selection;
 * otherwise the block starts at `origin` and is cut at the grid limits (`clipped` counts what was
 * cut).
 */
export function planPaste(
  table: readonly (readonly string[])[],
  origin: { r: number; c: number },
  limits: { maxR: number; maxC: number },
  selection?: { r0: number; r1: number; c0: number; c1: number } | null,
): PastePlan {
  const targets: PasteTarget[] = [];
  const single = table.length === 1 && table[0]?.length === 1;
  if (single && selection && (selection.r1 > selection.r0 || selection.c1 > selection.c0)) {
    const text = table[0]?.[0] ?? "";
    for (let r = selection.r0; r <= Math.min(selection.r1, limits.maxR); r += 1)
      for (let c = selection.c0; c <= Math.min(selection.c1, limits.maxC); c += 1)
        targets.push({ r, c, text, i: 0, j: 0 });
    return { targets, clipped: 0 };
  }
  let clipped = 0;
  table.forEach((line, dr) => {
    line.forEach((text, dc) => {
      const r = origin.r + dr;
      const c = origin.c + dc;
      if (r <= limits.maxR && c <= limits.maxC) targets.push({ r, c, text, i: dr, j: dc });
      else clipped += 1;
    });
  });
  return { targets, clipped };
}

/** Wording of the messages a pasted value can be refused with. */
export interface PasteMessages {
  yes: string;
  no: string;
  invalidNumber: string;
  invalidDate: string;
  invalidValue: string;
}

export type ParsedPaste = { ok: true; value: CellValue } | { ok: false; message: string };

const TRUE = new Set(["true", "1", "yes", "y", "si", "sí", "x"]);
const FALSE = new Set(["false", "0", "no", "n"]);

/**
 * The value a pasted text stands for in `column`, read the way its editor reads typed text: the
 * column's `parse`, else numbers and dates in `locale`, a `select`'s label or value, and a
 * boolean's `true` / `false` / yes / no. Numbers and dates keep the type of the `current` value.
 */
export function parsePasted<T>(
  column: GridColumn<T>,
  text: string,
  row: T,
  current: CellValue,
  locale: string,
  messages: PasteMessages,
): ParsedPaste {
  const kind: EditorKind | "custom" = editorKind(column);
  if (kind === "select" && !column.parse) {
    if (text.trim() === "") return { ok: true, value: null };
    const wanted = text.trim().toLowerCase();
    const option = normalizeOptions(column.options ?? []).find(
      (choice) =>
        choice.label.toLowerCase() === wanted || String(choice.value).toLowerCase() === wanted,
    );
    return option
      ? { ok: true, value: option.value }
      : { ok: false, message: messages.invalidValue };
  }
  if (kind === "boolean" && !column.parse) {
    const wanted = text.trim().toLowerCase();
    if (TRUE.has(wanted) || wanted === messages.yes.toLowerCase()) return { ok: true, value: true };
    if (FALSE.has(wanted) || wanted === messages.no.toLowerCase() || wanted === "")
      return { ok: true, value: false };
    return { ok: false, message: messages.invalidValue };
  }
  const result = parseDraft(column, kind, text, row, locale);
  if (!("value" in result)) {
    const message =
      result.message ??
      (result.error === "number"
        ? messages.invalidNumber
        : result.error === "date"
          ? messages.invalidDate
          : messages.invalidValue);
    return { ok: false, message };
  }
  const typed = (kind === "number" || kind === "date") && !column.parse;
  return { ok: true, value: typed ? likeOriginal(result.value, current) : result.value };
}

let aborted: AbortSignal | undefined;

/**
 * Runs `column.validate` for a bulk write (paste, fill), where nothing can wait for a promise.
 * The validator gets an already aborted signal; one that returns a promise is not awaited, its
 * outcome is ignored and the value counts as `unvalidated`. A synchronous message refuses it.
 */
export function validateSync<T>(
  column: GridColumn<T>,
  value: CellValue,
  row: T,
): { message: string | null; unvalidated: boolean } {
  if (!column.validate) return { message: null, unvalidated: false };
  try {
    aborted ??= AbortSignal.abort();
    const result = column.validate(value, row, aborted);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      (result as Promise<unknown>).then(undefined, () => {});
      return { message: null, unvalidated: true };
    }
    return { message: (result as string | null | undefined) || null, unvalidated: false };
  } catch (error) {
    return {
      message: error instanceof Error && error.message ? error.message : "Invalid value",
      unvalidated: false,
    };
  }
}

/** A cell a bulk write may reach, as the grid describes it. */
export interface WriteCell<T> {
  rowKey: string;
  columnId: string;
  column: GridColumn<T>;
  row: T;
  current: CellValue;
}

export type SkipReason = "readonly" | "invalid" | "unavailable";

export interface SkippedCell {
  rowKey: string | null;
  columnId: string | null;
  reason: SkipReason;
  message?: string;
}

export interface WritePlan {
  changes: { rowKey: string; columnId: string; value: CellValue }[];
  skipped: SkippedCell[];
  /** Cells whose value was not checked because their validator is asynchronous. */
  unvalidated: { rowKey: string; columnId: string }[];
  /** Cells that already held the pasted value. */
  unchanged: number;
}

const sameCell = (a: CellValue, b: CellValue) =>
  a === b ||
  (a == null && b == null) ||
  (a instanceof Date && b instanceof Date && a.getTime() === b.getTime());

/**
 * Turns pasted cells into writes. `cellAt` describes the cell under `(r, c)`: `null` when there is
 * none (a group row, the checkbox column) and `editable: false` when it may not be written. Cells
 * that cannot be written or whose text does not parse are skipped and reported, never half-applied.
 */
export function planWrites<T>(
  targets: readonly PasteTarget[],
  cellAt: (r: number, c: number) => (WriteCell<T> & { editable: boolean }) | null,
  env: { locale: string; messages: PasteMessages; formulas?: boolean },
): WritePlan {
  const plan: WritePlan = { changes: [], skipped: [], unvalidated: [], unchanged: 0 };
  for (const target of targets) {
    const cell = cellAt(target.r, target.c);
    if (!cell) {
      plan.skipped.push({ rowKey: null, columnId: null, reason: "unavailable" });
      continue;
    }
    const { rowKey, columnId, column, row, current } = cell;
    if (!cell.editable) {
      plan.skipped.push({ rowKey, columnId, reason: "readonly" });
      continue;
    }
    // With formulas on, text that starts with `=` is stored as typed, as the editor does.
    const parsed: ParsedPaste =
      env.formulas && target.text.trimStart().startsWith("=")
        ? { ok: true, value: target.text }
        : parsePasted(column, target.text, row, current, env.locale, env.messages);
    if (!parsed.ok) {
      plan.skipped.push({ rowKey, columnId, reason: "invalid", message: parsed.message });
      continue;
    }
    const raw =
      env.formulas && parsed.value === target.text && target.text.trimStart().startsWith("=");
    const checked = raw
      ? { message: null, unvalidated: false }
      : validateSync(column, parsed.value, row);
    if (checked.message) {
      plan.skipped.push({ rowKey, columnId, reason: "invalid", message: checked.message });
      continue;
    }
    if (checked.unvalidated) plan.unvalidated.push({ rowKey, columnId });
    if (sameCell(parsed.value, current)) plan.unchanged += 1;
    else plan.changes.push({ rowKey, columnId, value: parsed.value });
  }
  return plan;
}
