// A sheet of cells with formulas: dependency graph, recalculation and cycle detection. Pure.
import {
  type ErrorCode,
  evaluateFormula,
  type FormulaNode,
  type FormulaValue,
  formulaError,
  isFormulaError,
  isFormulaText,
  parseFormula,
  referencesOf,
} from "./formula.js";
import type { CellValue } from "./types.js";

export interface SheetFormula {
  text: string;
  /** Null when the text does not parse; `error` says what to show then. */
  ast: FormulaNode | null;
  error: ErrorCode | null;
  /** Keys (`row * cols + col`) of the cells the formula reads, ranges expanded. */
  deps: readonly number[];
}

export type ParseCache = Map<string, Pick<SheetFormula, "ast" | "error">>;

export interface FormulaSheet {
  readonly rows: number;
  readonly cols: number;
  /** Raw content of a cell: what the data holds, formulas as `=...` text. */
  readonly read: (r: number, c: number) => CellValue;
  readonly formulas: ReadonlyMap<number, SheetFormula>;
  /** For each cell, the formula cells that read it. */
  readonly dependents: ReadonlyMap<number, ReadonlySet<number>>;
  /** Results of the formula cells. */
  readonly values: ReadonlyMap<number, FormulaValue>;
}

export interface SheetInput {
  rows: number;
  cols: number;
  read: (r: number, c: number) => CellValue;
  /** Reuses parsed formulas across rebuilds. */
  cache?: ParseCache;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A raw cell as a formula operand: dates are ISO text, anything unreadable is empty. */
export function rawToFormulaValue(value: CellValue): FormulaValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
}

function parseCell(
  text: string,
  rows: number,
  cols: number,
  cache?: ParseCache,
): Omit<SheetFormula, "text"> {
  let parsed = cache?.get(text);
  if (!parsed) {
    const result = parseFormula(text);
    parsed = result.ok
      ? { ast: result.ast, error: null }
      : { ast: null, error: result.error as ErrorCode };
    cache?.set(text, parsed);
  }
  return { ...parsed, deps: parsed.ast ? referencesOf(parsed.ast, rows, cols) : [] };
}

function linkDependents(formulas: ReadonlyMap<number, SheetFormula>): Map<number, Set<number>> {
  const dependents = new Map<number, Set<number>>();
  for (const [key, formula] of formulas) {
    for (const dep of formula.deps) {
      let set = dependents.get(dep);
      if (!set) {
        set = new Set();
        dependents.set(dep, set);
      }
      set.add(key);
    }
  }
  return dependents;
}

/**
 * Evaluates `targets` (formula cells) in dependency order with an explicit stack, so long chains
 * do not overflow the call stack. Cells on a cycle get `#CYCLE!`.
 */
function evaluateTargets(
  sheet: Pick<FormulaSheet, "rows" | "cols" | "read" | "formulas">,
  targets: Iterable<number>,
  values: Map<number, FormulaValue>,
): void {
  const { rows, cols, read, formulas } = sheet;
  const ctx = {
    rows,
    cols,
    cell: (r: number, c: number): FormulaValue => {
      const key = r * cols + c;
      if (!formulas.has(key)) return rawToFormulaValue(read(r, c));
      return values.get(key) ?? formulaError("#CYCLE!");
    },
  };
  const settle = (key: number): FormulaValue => {
    const formula = formulas.get(key) as SheetFormula;
    return formula.ast
      ? evaluateFormula(formula.ast, ctx)
      : formulaError(formula.error ?? "#ERROR!");
  };

  for (const start of targets) {
    if (values.has(start) || !formulas.has(start)) continue;
    const stack: { key: number; next: number }[] = [{ key: start, next: 0 }];
    const onStack = new Map<number, number>([[start, 0]]);
    const cyclic = new Set<number>();
    while (stack.length > 0) {
      const top = stack[stack.length - 1] as { key: number; next: number };
      const deps = (formulas.get(top.key) as SheetFormula).deps;
      if (top.next < deps.length) {
        const dep = deps[top.next] as number;
        top.next += 1;
        if (!formulas.has(dep) || values.has(dep)) continue;
        const at = onStack.get(dep);
        if (at !== undefined) {
          for (let i = at; i < stack.length; i += 1) cyclic.add((stack[i] as { key: number }).key);
          continue;
        }
        onStack.set(dep, stack.length);
        stack.push({ key: dep, next: 0 });
        continue;
      }
      stack.pop();
      onStack.delete(top.key);
      values.set(top.key, cyclic.has(top.key) ? formulaError("#CYCLE!") : settle(top.key));
    }
  }
}

/** Finds every formula cell, links the dependency graph and evaluates the sheet. */
export function buildSheet(input: SheetInput): FormulaSheet {
  const { rows, cols, read, cache } = input;
  const formulas = new Map<number, SheetFormula>();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const raw = read(r, c);
      if (isFormulaText(raw))
        formulas.set(r * cols + c, { text: raw, ...parseCell(raw, rows, cols, cache) });
    }
  }
  const values = new Map<number, FormulaValue>();
  evaluateTargets({ rows, cols, read, formulas }, formulas.keys(), values);
  return { rows, cols, read, formulas, dependents: linkDependents(formulas), values };
}

/** Cells that must be recalculated after `key` changes: itself and everything that reads it. */
export function dirtyCells(sheet: Pick<FormulaSheet, "dependents">, key: number): Set<number> {
  const dirty = new Set<number>([key]);
  const queue = [key];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    for (const dependent of sheet.dependents.get(current) ?? []) {
      if (!dirty.has(dependent)) {
        dirty.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return dirty;
}

/**
 * Sets one cell and recalculates only what depends on it. Returns a new sheet; the previous one
 * is left untouched.
 */
export function updateCell(
  sheet: FormulaSheet,
  r: number,
  c: number,
  raw: CellValue,
  cache?: ParseCache,
): FormulaSheet {
  const { rows, cols } = sheet;
  const key = r * cols + c;
  const read = (rr: number, cc: number): CellValue =>
    rr === r && cc === c ? raw : sheet.read(rr, cc);

  const formulas = new Map(sheet.formulas);
  const dependents = new Map(sheet.dependents);
  const touch = (dep: number): Set<number> => {
    const copy = new Set(dependents.get(dep) ?? []);
    dependents.set(dep, copy);
    return copy;
  };
  for (const dep of sheet.formulas.get(key)?.deps ?? []) touch(dep).delete(key);
  if (isFormulaText(raw)) {
    const formula: SheetFormula = { text: raw, ...parseCell(raw, rows, cols, cache) };
    formulas.set(key, formula);
    for (const dep of formula.deps) touch(dep).add(key);
  } else {
    formulas.delete(key);
  }

  const dirty = dirtyCells({ dependents }, key);
  const values = new Map(sheet.values);
  for (const cell of dirty) values.delete(cell);
  evaluateTargets({ rows, cols, read, formulas }, dirty, values);
  return { rows, cols, read, formulas, dependents, values };
}

/** Result of a cell, formulas evaluated. */
export function sheetValue(sheet: FormulaSheet, r: number, c: number): FormulaValue {
  const key = r * sheet.cols + c;
  if (!sheet.formulas.has(key)) return rawToFormulaValue(sheet.read(r, c));
  return sheet.values.get(key) ?? formulaError("#CYCLE!");
}

/** The value a grid cell shows: formula results as plain values, errors as their code. */
export function displayValue(sheet: FormulaSheet, r: number, c: number): CellValue | undefined {
  const key = r * sheet.cols + c;
  if (!sheet.formulas.has(key)) return undefined;
  const value = sheet.values.get(key) ?? formulaError("#CYCLE!");
  return isFormulaError(value) ? value.code : value;
}

/** Cells the formula at (r, c) reads, as `[row, col]` pairs. */
export function precedentsOf(sheet: FormulaSheet, r: number, c: number): Array<[number, number]> {
  return (sheet.formulas.get(r * sheet.cols + c)?.deps ?? []).map((key) => [
    Math.floor(key / sheet.cols),
    key % sheet.cols,
  ]);
}

const ERROR_TEXTS: ReadonlySet<string> = new Set([
  "#REF!",
  "#DIV/0!",
  "#NAME?",
  "#VALUE!",
  "#CYCLE!",
  "#ERROR!",
]);

/** Whether a displayed value is the text of a formula error. */
export function isErrorText(value: CellValue): value is ErrorCode {
  return typeof value === "string" && ERROR_TEXTS.has(value);
}
