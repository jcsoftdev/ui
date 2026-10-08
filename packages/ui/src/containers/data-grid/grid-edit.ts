// Pure planning of multi-cell edits: TSV parsing for paste and fill down / right.
import type { CellValue } from "./types.js";

/**
 * Parses tab separated text (the clipboard format of spreadsheets): quoted fields may hold tabs,
 * quotes (`""`) and line breaks. One trailing line break is ignored.
 */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let atStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && atStart) {
      quoted = true;
      atStart = false;
    } else if (char === "\t") {
      row.push(field);
      field = "";
      atStart = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atStart = true;
    } else {
      field += char;
      atStart = false;
    }
  }
  if (field !== "" || row.length > 0 || quoted) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CellTarget {
  r: number;
  c: number;
  text: string;
}

/**
 * Cells a paste writes. A single value pasted over a larger selection fills it; otherwise the
 * block lands from the top-left corner and is cut at the grid limits.
 */
export function planPaste(
  table: readonly (readonly string[])[],
  origin: { r: number; c: number },
  limits: { maxR: number; maxC: number },
  selection?: { r0: number; r1: number; c0: number; c1: number } | null,
): CellTarget[] {
  if (table.length === 0) return [];
  const single = table.length === 1 && table[0]?.length === 1;
  const out: CellTarget[] = [];
  if (single && selection && (selection.r1 > selection.r0 || selection.c1 > selection.c0)) {
    const text = table[0]?.[0] ?? "";
    for (let r = selection.r0; r <= Math.min(selection.r1, limits.maxR); r += 1) {
      for (let c = selection.c0; c <= Math.min(selection.c1, limits.maxC); c += 1) {
        out.push({ r, c, text });
      }
    }
    return out;
  }
  table.forEach((line, dr) => {
    line.forEach((text, dc) => {
      const r = origin.r + dr;
      const c = origin.c + dc;
      if (r <= limits.maxR && c <= limits.maxC) out.push({ r, c, text });
    });
  });
  return out;
}

export type FillDirection = "down" | "right";

export interface FillTarget {
  r: number;
  c: number;
  /** Source cell the value is copied from. */
  from: { r: number; c: number };
}

/** Cells a fill writes and where each value comes from: `down` copies the first row, `right` the first column. */
export function planFill(
  bounds: { r0: number; r1: number; c0: number; c1: number },
  direction: FillDirection,
): FillTarget[] {
  const out: FillTarget[] = [];
  if (direction === "down") {
    for (let r = bounds.r0 + 1; r <= bounds.r1; r += 1) {
      for (let c = bounds.c0; c <= bounds.c1; c += 1) out.push({ r, c, from: { r: bounds.r0, c } });
    }
  } else {
    for (let c = bounds.c0 + 1; c <= bounds.c1; c += 1) {
      for (let r = bounds.r0; r <= bounds.r1; r += 1) out.push({ r, c, from: { r, c: bounds.c0 } });
    }
  }
  return out;
}

/**
 * A number from pasted text such as `S/ 1,234.50`, `12,5` or `-3`: currency marks and spaces are
 * dropped, a lone comma followed by one or two digits is a decimal comma, other commas group
 * thousands. Null when no number can be read.
 */
export function parseLooseNumber(text: string): number | null {
  let clean = text.replace(/[^\d.,+-]/g, "");
  if (clean === "") return null;
  if (clean.includes(".")) clean = clean.replace(/,/g, "");
  else if (/^[+-]?\d+,\d{1,2}$/.test(clean)) clean = clean.replace(",", ".");
  else clean = clean.replace(/,/g, "");
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** Whether an edited value equals the previous one (numbers by identity, the rest by text). */
export function sameCellValue(value: CellValue, previous: CellValue): boolean {
  if (value === previous) return true;
  if (value instanceof Date && previous instanceof Date)
    return value.getTime() === previous.getTime();
  return typeof previous !== "number" && String(value ?? "") === String(previous ?? "");
}
