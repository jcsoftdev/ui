import type { CellValue } from "./model.js";

// Spreadsheet formulas for DataGrid: tokenizer, parser and evaluator. Pure; no DOM, no React.
//
// A formula is a cell text starting with `=`. References are A1 style (`B3`, `$B$3`, `B3:D9`) or
// R1C1 style (`R3C2`): the letter is the position of the column in the grid's column list and the
// number is the 1-based position of the row in the data the grid was given.

export type ErrorCode =
  | "#REF!"
  | "#DIV/0!"
  | "#NAME?"
  | "#VALUE!"
  | "#NUM!"
  | "#CYCLE!"
  | "#ERROR!";

export class FormulaError {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    this.code = code;
  }
}

export function isFormulaError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}

/** What a formula or a cell evaluates to; `null` is an empty cell. */
export type FormulaValue = number | string | boolean | null | FormulaError;

export interface CellRef {
  r: number;
  c: number;
  /** `$` before the row / column: it does not move when the formula is filled elsewhere. */
  absR: boolean;
  absC: boolean;
}

export type FormulaNode =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "name"; v: string }
  | { t: "err"; code: ErrorCode }
  | { t: "ref"; ref: CellRef }
  | { t: "range"; a: CellRef; b: CellRef }
  | { t: "un"; op: "-" | "+"; x: FormulaNode }
  | { t: "bin"; op: string; l: FormulaNode; r: FormulaNode }
  | { t: "call"; name: string; args: FormulaNode[] };

export type ParseResult = { ok: true; ast: FormulaNode } | { ok: false; error: string };

// ---- addresses ------------------------------------------------------------------------------

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLabel(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    label = String.fromCharCode(65 + rest) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** A -> 0, AA -> 26; -1 when the text is not a column label. */
export function columnIndex(label: string): number {
  if (!/^[A-Za-z]{1,3}$/.test(label)) return -1;
  let n = 0;
  for (const char of label.toUpperCase()) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}

/** `B3` for row 2, column 1 (0-based). */
export function cellAddress(r: number, c: number): string {
  return `${columnLabel(c)}${r + 1}`;
}

/** Reads `B3`, `$B$3` or `R3C2`; null for anything else. */
export function parseAddress(text: string): CellRef | null {
  const a1 = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(text);
  if (a1) {
    const row = Number(a1[4]);
    const col = columnIndex(a1[2] as string);
    if (row < 1 || col < 0) return null;
    return { r: row - 1, c: col, absR: a1[3] === "$", absC: a1[1] === "$" };
  }
  const rc = /^R(\d+)C(\d+)$/i.exec(text);
  if (rc && Number(rc[1]) >= 1 && Number(rc[2]) >= 1) {
    return { r: Number(rc[1]) - 1, c: Number(rc[2]) - 1, absR: true, absC: true };
  }
  return null;
}

export function isFormulaText(value: unknown): value is string {
  return typeof value === "string" && value.trimStart().startsWith("=");
}

// ---- tokenizer ------------------------------------------------------------------------------

type Token =
  | { k: "num"; v: number; s: number; e: number }
  | { k: "str"; v: string; s: number; e: number }
  | { k: "id"; v: string; s: number; e: number }
  | { k: "err"; v: ErrorCode; s: number; e: number }
  | { k: "op"; v: string; s: number; e: number };

const TWO_CHAR_OPS = new Set(["<>", "<=", ">="]);
const ONE_CHAR_OPS = new Set([
  "+",
  "-",
  "*",
  "/",
  "^",
  "&",
  "=",
  "<",
  ">",
  "(",
  ")",
  ",",
  ";",
  ":",
]);

const ERROR_LITERAL = /^#(REF!|DIV\/0!|NAME\?|VALUE!|NUM!|CYCLE!|ERROR!)/i;
/** Longest formula text and most tokens a formula may have; longer ones are `#ERROR!`. */
const MAX_TEXT = 8192;
const MAX_TOKENS = 2048;

function tokenize(text: string, from: number): Token[] | null {
  if (text.length > MAX_TEXT) return null;
  const tokens: Token[] = [];
  let i = from;
  while (i < text.length) {
    if (tokens.length > MAX_TOKENS) return null;
    const char = text[i] as string;
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    const start = i;
    if (char === '"') {
      let value = "";
      i += 1;
      let closed = false;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        value += text[i];
        i += 1;
      }
      if (!closed) return null;
      tokens.push({ k: "str", v: value, s: start, e: i });
      continue;
    }
    if (char === "#") {
      const code = ERROR_LITERAL.exec(text.slice(i, i + 8));
      if (!code) return null;
      i += code[0].length;
      tokens.push({ k: "err", v: code[0].toUpperCase() as ErrorCode, s: start, e: i });
      continue;
    }
    const number = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(i));
    if (number) {
      i += number[0].length;
      if (/[A-Za-z_$]/.test(text[i] ?? "")) return null;
      tokens.push({ k: "num", v: Number(number[0]), s: start, e: i });
      continue;
    }
    const id = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(text.slice(i));
    if (id) {
      i += id[0].length;
      tokens.push({ k: "id", v: id[0], s: start, e: i });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      i += 2;
      tokens.push({ k: "op", v: two, s: start, e: i });
      continue;
    }
    if (ONE_CHAR_OPS.has(char)) {
      i += 1;
      tokens.push({ k: "op", v: char, s: start, e: i });
      continue;
    }
    return null;
  }
  return tokens;
}

// ---- parser ---------------------------------------------------------------------------------

class SyntaxProblem extends Error {}

const COMPARISONS = new Set(["=", "<>", "<", ">", "<=", ">="]);
const MAX_DEPTH = 64;
/** Most nodes a formula may have, which also bounds how deep its tree can be. */
const MAX_NODES = 1000;

class Parser {
  private pos = 0;
  private depth = 0;
  private nodes = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): FormulaNode {
    if (this.tokens.length === 0) throw new SyntaxProblem("empty");
    const node = this.comparison();
    if (this.pos < this.tokens.length) throw new SyntaxProblem("unexpected token");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.k === "op" && token.v === value;
  }

  private expect(value: string): void {
    if (!this.isOp(value)) throw new SyntaxProblem(`expected ${value}`);
    this.pos += 1;
  }

  /** Counts a node; a formula past `MAX_NODES` is refused instead of nesting without bound. */
  private node<T extends FormulaNode>(node: T): T {
    this.nodes += 1;
    if (this.nodes > MAX_NODES) throw new SyntaxProblem("too big");
    return node;
  }

  private binary(next: () => FormulaNode, ops: (op: string) => boolean): FormulaNode {
    let left = next();
    for (;;) {
      const token = this.peek();
      if (token?.k !== "op" || !ops(token.v)) return left;
      this.pos += 1;
      left = this.node({ t: "bin", op: token.v, l: left, r: next() });
    }
  }

  private comparison(): FormulaNode {
    return this.binary(
      () => this.concat(),
      (op) => COMPARISONS.has(op),
    );
  }

  private concat(): FormulaNode {
    return this.binary(
      () => this.additive(),
      (op) => op === "&",
    );
  }

  private additive(): FormulaNode {
    return this.binary(
      () => this.multiplicative(),
      (op) => op === "+" || op === "-",
    );
  }

  private multiplicative(): FormulaNode {
    return this.binary(
      () => this.power(),
      (op) => op === "*" || op === "/",
    );
  }

  private power(): FormulaNode {
    return this.binary(
      () => this.unary(),
      (op) => op === "^",
    );
  }

  private unary(): FormulaNode {
    const token = this.peek();
    if (token?.k === "op" && (token.v === "-" || token.v === "+")) {
      this.pos += 1;
      this.depth += 1;
      if (this.depth > MAX_DEPTH) throw new SyntaxProblem("too deep");
      const x = this.unary();
      this.depth -= 1;
      return this.node({ t: "un", op: token.v, x });
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    const token = this.peek();
    if (!token) throw new SyntaxProblem("unexpected end");
    this.pos += 1;
    if (token.k === "num") return this.node({ t: "num", v: token.v });
    if (token.k === "str") return this.node({ t: "str", v: token.v });
    if (token.k === "err") return this.node({ t: "err", code: token.v });
    if (token.k === "op") {
      if (token.v !== "(") throw new SyntaxProblem(`unexpected ${token.v}`);
      this.depth += 1;
      if (this.depth > MAX_DEPTH) throw new SyntaxProblem("too deep");
      const inner = this.comparison();
      this.depth -= 1;
      this.expect(")");
      return inner;
    }
    if (this.isOp("(")) {
      this.pos += 1;
      this.depth += 1;
      if (this.depth > MAX_DEPTH) throw new SyntaxProblem("too deep");
      const args: FormulaNode[] = [];
      if (!this.isOp(")")) {
        for (;;) {
          args.push(this.comparison());
          if (this.isOp(",") || this.isOp(";")) this.pos += 1;
          else break;
        }
      }
      this.depth -= 1;
      this.expect(")");
      return this.node({ t: "call", name: token.v.toUpperCase(), args });
    }
    const upper = token.v.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") return this.node({ t: "bool", v: upper === "TRUE" });
    const ref = parseAddress(token.v);
    if (!ref) return this.node({ t: "name", v: token.v });
    if (this.isOp(":")) {
      this.pos += 1;
      const endToken = this.peek();
      const end = endToken?.k === "id" ? parseAddress(endToken.v) : null;
      if (!end) throw new SyntaxProblem("bad range");
      this.pos += 1;
      return this.node({ t: "range", a: ref, b: end });
    }
    return this.node({ t: "ref", ref });
  }
}

/** Parses a formula; the leading `=` is optional. Syntax problems are reported, not thrown. */
export function parseFormula(text: string): ParseResult {
  const trimmed = text.trimStart();
  const tokens = tokenize(trimmed, trimmed.startsWith("=") ? 1 : 0);
  if (!tokens) return { ok: false, error: "#ERROR!" };
  try {
    return { ok: true, ast: new Parser(tokens).parse() };
  } catch {
    // A syntax problem, or a tree too deep for the stack: either way the cell shows #ERROR!.
    return { ok: false, error: "#ERROR!" };
  }
}

// ---- rewriting references (fill, paste, inserting and removing rows) ------------------------

function formatRef(ref: CellRef): string {
  return `${ref.absC ? "$" : ""}${columnLabel(ref.c)}${ref.absR ? "$" : ""}${ref.r + 1}`;
}

type RefSite = { range: false; ref: CellRef } | { range: true; a: CellRef; b: CellRef };

/**
 * Rewrites the references of a formula. `rewrite` gets each cell reference or range and returns
 * its new text, or `null` to keep it. Text outside references is kept as typed.
 */
function rewriteRefs(text: string, rewrite: (site: RefSite) => string | null): string {
  const lead = text.length - text.trimStart().length;
  const trimmed = text.slice(lead);
  const tokens = tokenize(trimmed, trimmed.startsWith("=") ? 1 : 0);
  if (!tokens) return text;
  const address = (token: Token | undefined): CellRef | null =>
    token?.k === "id" && !/^R\d+C\d+$/i.test(token.v) ? parseAddress(token.v) : null;
  let out = "";
  let last = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as Token;
    const next = tokens[i + 1];
    if (next?.k === "op" && next.v === "(") continue;
    const ref = address(token);
    if (!ref) continue;
    const colon = next?.k === "op" && next.v === ":";
    const end = colon ? address(tokens[i + 2]) : null;
    const site: RefSite = end ? { range: true, a: ref, b: end } : { range: false, ref };
    const to = (end ? tokens[i + 2] : token) as Token;
    const text2 = rewrite(site);
    if (end) i += 2;
    if (text2 === null) continue;
    out += trimmed.slice(last, token.s) + text2;
    last = to.e;
  }
  return text.slice(0, lead) + out + trimmed.slice(last);
}

/**
 * Moves the relative references of a formula by `dr` rows and `dc` columns, the way a spreadsheet
 * does when a formula is filled down or right; `$` references stay. A reference pushed off the
 * sheet becomes `#REF!`, which reads back as that error.
 */
export function shiftFormula(text: string, dr: number, dc: number): string {
  const move = (ref: CellRef): CellRef => ({
    ...ref,
    r: ref.absR ? ref.r : ref.r + dr,
    c: ref.absC ? ref.c : ref.c + dc,
  });
  return rewriteRefs(text, (site) => {
    const refs = site.range ? [move(site.a), move(site.b)] : [move(site.ref)];
    if (refs.some((ref) => ref.r < 0 || ref.c < 0)) return "#REF!";
    return refs.map(formatRef).join(":");
  });
}

/** Rows inserted at `at` (0-based, before the row now there) or removed from it. */
export interface RowEdit {
  kind: "insert" | "remove";
  at: number;
  count: number;
}

/**
 * Rewrites the references of a formula for rows inserted or removed in the data, so it keeps
 * pointing at the same cells. A reference to a removed row becomes `#REF!`; a range shrinks and
 * becomes `#REF!` only when every row of it is gone. `$` references move too.
 */
export function adjustRows(text: string, edit: RowEdit): string {
  const { kind, at, count } = edit;
  const end = at + count;
  const one = (r: number): number | null =>
    kind === "insert" ? (r >= at ? r + count : r) : r < at ? r : r >= end ? r - count : null;
  return rewriteRefs(text, (site) => {
    if (!site.range) {
      const r = one(site.ref.r);
      return r === null ? "#REF!" : r === site.ref.r ? null : formatRef({ ...site.ref, r });
    }
    const { a, b } = site;
    const [lo, hi] = a.r <= b.r ? [a.r, b.r] : [b.r, a.r];
    let nlo: number;
    let nhi: number;
    if (kind === "insert") {
      nlo = lo >= at ? lo + count : lo;
      nhi = hi >= at ? hi + count : hi;
    } else {
      nlo = lo < at ? lo : lo >= end ? lo - count : at;
      nhi = hi < at ? hi : hi >= end ? hi - count : at - 1;
      if (nlo > nhi) return "#REF!";
    }
    if (nlo === lo && nhi === hi) return null;
    const [ra, rb] = a.r <= b.r ? [nlo, nhi] : [nhi, nlo];
    return `${formatRef({ ...a, r: ra })}:${formatRef({ ...b, r: rb })}`;
  });
}

// ---- evaluator ------------------------------------------------------------------------------

const ERRORS: Record<ErrorCode, FormulaError> = {
  "#REF!": new FormulaError("#REF!"),
  "#DIV/0!": new FormulaError("#DIV/0!"),
  "#NAME?": new FormulaError("#NAME?"),
  "#VALUE!": new FormulaError("#VALUE!"),
  "#NUM!": new FormulaError("#NUM!"),
  "#CYCLE!": new FormulaError("#CYCLE!"),
  "#ERROR!": new FormulaError("#ERROR!"),
};

export function formulaError(code: ErrorCode): FormulaError {
  return ERRORS[code];
}

/** A rectangle of cells, read on demand: a range of a hundred thousand rows costs nothing to hold. */
interface RangeValue {
  range: true;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}
type Value = FormulaValue | RangeValue;

function isRange(value: Value): value is RangeValue {
  return typeof value === "object" && value !== null && "range" in value;
}

/** What the number functions need of a range, computed in one pass and shared by every reader. */
interface Summary {
  error: FormulaError | null;
  numbers: number;
  sum: number;
  min: number;
  max: number;
}

export interface EvalContext {
  rows: number;
  cols: number;
  /** Value of a cell inside the sheet (formulas already evaluated). */
  cell: (r: number, c: number) => FormulaValue;
  /** Summaries of ranges already read in this pass; the sheet clears it between passes. */
  memo?: Map<string, Summary>;
}

/** Keeps arithmetic free of binary noise (`0.1 + 0.2` is `0.3`), like spreadsheets do. */
function tidy(n: number): number {
  return Number.isFinite(n) ? Number(n.toPrecision(15)) : n;
}

/** A finite result, or `#NUM!` (overflow, `0 ^ -1`, a root of a negative number). */
function finite(n: number): FormulaValue {
  return Number.isFinite(n) ? tidy(n) : ERRORS["#NUM!"];
}

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

function toNumber(value: FormulaValue): number | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return 0;
  // Only decimal text: `Number` would also read "0x10" and "0b1".
  const text = value.trim();
  if (!DECIMAL.test(text)) return ERRORS["#VALUE!"];
  const n = Number(text);
  return Number.isFinite(n) ? n : ERRORS["#VALUE!"];
}

export function formulaText(value: FormulaValue): string {
  if (isFormulaError(value)) return value.code;
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return typeof value === "number" ? String(tidy(value)) : value;
}

function toBool(value: FormulaValue): boolean | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value === null) return false;
  const upper = value.trim().toUpperCase();
  if (upper === "TRUE") return true;
  if (upper === "FALSE") return false;
  return ERRORS["#VALUE!"];
}

function typeRank(value: FormulaValue): number {
  if (value === null) return 0;
  if (typeof value === "number") return 1;
  if (typeof value === "string") return 2;
  return 3;
}

/** Spreadsheet ordering: numbers < text < booleans; text ignores case; empty equals 0 and "". */
function compare(a: FormulaValue, b: FormulaValue): number {
  let x = a;
  let y = b;
  if (x === null) x = typeof y === "string" ? "" : typeof y === "boolean" ? false : 0;
  if (y === null) y = typeof x === "string" ? "" : typeof x === "boolean" ? false : 0;
  const rankX = typeRank(x);
  const rankY = typeRank(y);
  if (rankX !== rankY) return rankX - rankY;
  if (typeof x === "string" && typeof y === "string") {
    const left = x.toLowerCase();
    const right = y.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }
  const left = Number(x);
  const right = Number(y);
  return left < right ? -1 : left > right ? 1 : 0;
}

function scalarOf(value: Value): FormulaValue {
  return isRange(value) ? ERRORS["#VALUE!"] : value;
}

function roundHalfAway(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor * (1 + Number.EPSILON);
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

function rangeOf(a: CellRef, b: CellRef, ctx: EvalContext): Value {
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  if (r0 < 0 || c0 < 0 || r1 >= ctx.rows || c1 >= ctx.cols) return ERRORS["#REF!"];
  return { range: true, r0, c0, r1, c1 };
}

/** The cells of a range in row order; stops when `visit` returns `false`. */
function eachCell(
  range: RangeValue,
  ctx: EvalContext,
  visit: (value: FormulaValue) => boolean | void,
): void {
  for (let r = range.r0; r <= range.r1; r += 1)
    for (let c = range.c0; c <= range.c1; c += 1) if (visit(ctx.cell(r, c)) === false) return;
}

function summarize(range: RangeValue, ctx: EvalContext): Summary {
  const key = `${range.r0},${range.c0},${range.r1},${range.c1}`;
  const known = ctx.memo?.get(key);
  if (known) return known;
  const summary: Summary = {
    error: null,
    numbers: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };
  eachCell(range, ctx, (cell) => {
    if (isFormulaError(cell)) summary.error ??= cell;
    else if (typeof cell === "number") {
      summary.numbers += 1;
      summary.sum += cell;
      if (cell < summary.min) summary.min = cell;
      if (cell > summary.max) summary.max = cell;
    }
  });
  ctx.memo?.set(key, summary);
  return summary;
}

/** The numbers of the arguments for SUM, AVERAGE, MIN and MAX; the first error wins. */
function tally(args: readonly FormulaNode[], ctx: EvalContext): Summary | FormulaError {
  const total: Summary = {
    error: null,
    numbers: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };
  const add = (n: number) => {
    total.numbers += 1;
    total.sum += n;
    if (n < total.min) total.min = n;
    if (n > total.max) total.max = n;
  };
  for (const arg of args) {
    const value = evaluate(arg, ctx);
    if (isRange(value)) {
      const part = summarize(value, ctx);
      if (part.error) return part.error;
      total.numbers += part.numbers;
      total.sum += part.sum;
      if (part.min < total.min) total.min = part.min;
      if (part.max > total.max) total.max = part.max;
      continue;
    }
    if (isFormulaError(value)) return value;
    if (value === null) continue;
    const n = toNumber(value);
    if (isFormulaError(n)) return n;
    add(n);
  }
  return total;
}

type FormulaFunction = (args: readonly FormulaNode[], ctx: EvalContext) => Value;

// No prototype: a formula calling `constructor()` or `__proto__()` is an unknown name.
const FUNCTIONS: Record<string, FormulaFunction> = Object.assign(Object.create(null), {
  SUM: (args: readonly FormulaNode[], ctx: EvalContext) => {
    const t = tally(args, ctx);
    return isFormulaError(t) ? t : finite(t.sum);
  },
  AVERAGE: (args: readonly FormulaNode[], ctx: EvalContext) => {
    const t = tally(args, ctx);
    if (isFormulaError(t)) return t;
    return t.numbers === 0 ? ERRORS["#DIV/0!"] : finite(t.sum / t.numbers);
  },
  AVG: (args: readonly FormulaNode[], ctx: EvalContext) =>
    (FUNCTIONS.AVERAGE as FormulaFunction)(args, ctx),
  MIN: (args: readonly FormulaNode[], ctx: EvalContext) => {
    const t = tally(args, ctx);
    return isFormulaError(t) ? t : t.numbers ? t.min : 0;
  },
  MAX: (args: readonly FormulaNode[], ctx: EvalContext) => {
    const t = tally(args, ctx);
    return isFormulaError(t) ? t : t.numbers ? t.max : 0;
  },
  COUNT: (args: readonly FormulaNode[], ctx: EvalContext) => {
    let count = 0;
    for (const arg of args) {
      const value = evaluate(arg, ctx);
      if (isRange(value)) count += summarize(value, ctx).numbers;
      else if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        (typeof value === "string" && !isFormulaError(toNumber(value)))
      ) {
        count += 1;
      }
    }
    return count;
  },
  IF: (args: readonly FormulaNode[], ctx: EvalContext) => {
    if (args.length < 2 || args.length > 3) return ERRORS["#VALUE!"];
    const condition = toBool(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    if (isFormulaError(condition)) return condition;
    if (condition) return evaluate(args[1] as FormulaNode, ctx);
    return args[2] ? evaluate(args[2], ctx) : false;
  },
  ROUND: (args: readonly FormulaNode[], ctx: EvalContext) => {
    if (args.length < 1 || args.length > 2) return ERRORS["#VALUE!"];
    const value = toNumber(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    if (isFormulaError(value)) return value;
    const digits = args[1] ? toNumber(scalarOf(evaluate(args[1], ctx))) : 0;
    if (isFormulaError(digits)) return digits;
    return finite(roundHalfAway(value, Math.trunc(digits)));
  },
  ABS: (args: readonly FormulaNode[], ctx: EvalContext) => {
    if (args.length !== 1) return ERRORS["#VALUE!"];
    const value = toNumber(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    return isFormulaError(value) ? value : Math.abs(value);
  },
  CONCAT: (args: readonly FormulaNode[], ctx: EvalContext) => {
    let text = "";
    let failed: FormulaError | null = null;
    const append = (part: FormulaValue): boolean => {
      if (isFormulaError(part)) {
        failed = part;
        return false;
      }
      text += formulaText(part);
      return true;
    };
    for (const arg of args) {
      const value = evaluate(arg, ctx);
      if (isRange(value)) eachCell(value, ctx, append);
      else append(value);
      if (failed) return failed;
    }
    return text;
  },
});

/** Names of the functions a formula may call. */
export const FORMULA_FUNCTIONS: readonly string[] = Object.keys(FUNCTIONS);

function arithmetic(op: string, left: FormulaValue, right: FormulaValue): FormulaValue {
  const x = toNumber(left);
  if (isFormulaError(x)) return x;
  const y = toNumber(right);
  if (isFormulaError(y)) return y;
  switch (op) {
    case "+":
      return finite(x + y);
    case "-":
      return finite(x - y);
    case "*":
      return finite(x * y);
    case "/":
      return y === 0 ? ERRORS["#DIV/0!"] : finite(x / y);
    default:
      return finite(x ** y);
  }
}

/** Deepest tree `evaluate` follows; the parser's node limit keeps real formulas far below it. */
const MAX_EVAL_DEPTH = 800;
let evalDepth = 0;

function evaluate(node: FormulaNode, ctx: EvalContext): Value {
  if (evalDepth >= MAX_EVAL_DEPTH) return ERRORS["#ERROR!"];
  evalDepth += 1;
  try {
    return evaluateNode(node, ctx);
  } finally {
    evalDepth -= 1;
  }
}

function evaluateNode(node: FormulaNode, ctx: EvalContext): Value {
  switch (node.t) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "name":
      return ERRORS["#NAME?"];
    case "err":
      return ERRORS[node.code];
    case "ref": {
      const { r, c } = node.ref;
      return r < 0 || c < 0 || r >= ctx.rows || c >= ctx.cols ? ERRORS["#REF!"] : ctx.cell(r, c);
    }
    case "range":
      return rangeOf(node.a, node.b, ctx);
    case "un": {
      const value = scalarOf(evaluate(node.x, ctx));
      if (node.op === "+") return value;
      const n = toNumber(value);
      return isFormulaError(n) ? n : -n;
    }
    case "bin": {
      const left = scalarOf(evaluate(node.l, ctx));
      const right = scalarOf(evaluate(node.r, ctx));
      if (isFormulaError(left)) return left;
      if (isFormulaError(right)) return right;
      if (node.op === "&") return formulaText(left) + formulaText(right);
      if (COMPARISONS.has(node.op)) {
        const order = compare(left, right);
        switch (node.op) {
          case "=":
            return order === 0;
          case "<>":
            return order !== 0;
          case "<":
            return order < 0;
          case ">":
            return order > 0;
          case "<=":
            return order <= 0;
          default:
            return order >= 0;
        }
      }
      return arithmetic(node.op, left, right);
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      return fn ? fn(node.args, ctx) : ERRORS["#NAME?"];
    }
  }
}

/** Evaluates a parsed formula to a single value (a bare range is an error, like in a cell). */
export function evaluateFormula(ast: FormulaNode, ctx: EvalContext): FormulaValue {
  const value = scalarOf(evaluate(ast, ctx));
  return value === null ? 0 : value;
}

/** A rectangle of cells a formula reads, inside the sheet. */
export interface RangeDep {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/**
 * What a formula reads: single cells as keys (`row * cols + col`) and ranges as rectangles, never
 * expanded. References and ranges outside the sheet are left out (they evaluate to `#REF!`).
 */
export function referencesOf(
  ast: FormulaNode,
  rows: number,
  cols: number,
): { refs: number[]; ranges: RangeDep[] } {
  const refs = new Set<number>();
  const ranges: RangeDep[] = [];
  const stack: FormulaNode[] = [ast];
  while (stack.length > 0) {
    const node = stack.pop() as FormulaNode;
    switch (node.t) {
      case "ref":
        if (node.ref.r >= 0 && node.ref.c >= 0 && node.ref.r < rows && node.ref.c < cols)
          refs.add(node.ref.r * cols + node.ref.c);
        break;
      case "range": {
        const r0 = Math.min(node.a.r, node.b.r);
        const r1 = Math.max(node.a.r, node.b.r);
        const c0 = Math.min(node.a.c, node.b.c);
        const c1 = Math.max(node.a.c, node.b.c);
        if (r0 >= 0 && c0 >= 0 && r1 < rows && c1 < cols) ranges.push({ r0, c0, r1, c1 });
        break;
      }
      case "un":
        stack.push(node.x);
        break;
      case "bin":
        stack.push(node.l, node.r);
        break;
      case "call":
        stack.push(...node.args);
        break;
      default:
    }
  }
  return { refs: [...refs], ranges };
}

// ---- sheet: dependency graph and recalculation ----------------------------------------------

/** A range a formula reads, as filed under one column of the range index. */
interface RangeEntry {
  r0: number;
  r1: number;
  key: number;
}

export interface SheetFormula {
  text: string;
  /** Null when the text does not parse; `error` says what to show then. */
  ast: FormulaNode | null;
  error: ErrorCode | null;
  /** Keys (`row * cols + col`) of the single cells the formula reads. */
  refs: readonly number[];
  /** Rectangles the formula reads; never expanded cell by cell. */
  ranges: readonly RangeDep[];
  /** Where the ranges are filed in the sheet's index. */
  filed?: Array<{ col: number; entry: RangeEntry }>;
}

export type ParseCache = Map<string, Pick<SheetFormula, "ast" | "error">>;

/** Parsed formulas kept between rebuilds: the least recently used go first. */
const PARSE_CACHE_SIZE = 512;

export interface FormulaSheet {
  readonly rows: number;
  readonly cols: number;
  /** Raw content of a cell: what the data holds, formulas as `=...` text. */
  readonly read: (r: number, c: number) => CellValue;
  readonly formulas: Map<number, SheetFormula>;
  /** For each cell, the formula cells that read it as a single reference. */
  readonly dependents: Map<number, Set<number>>;
  /** Per column, the ranges that cover it: the formulas to recalculate when a cell of it changes. */
  readonly ranges: Map<number, Set<RangeEntry>>;
  /** Per column, the rows that hold a formula, ascending: to find formulas inside a range. */
  readonly formulaRows: Map<number, number[]>;
  /** Results of the formula cells. */
  readonly values: Map<number, FormulaValue>;
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
  if (parsed) {
    cache?.delete(text);
    cache?.set(text, parsed);
  } else {
    const result = parseFormula(text);
    parsed = result.ok
      ? { ast: result.ast, error: null }
      : { ast: null, error: result.error as ErrorCode };
    if (cache) {
      cache.set(text, parsed);
      if (cache.size > PARSE_CACHE_SIZE) cache.delete(cache.keys().next().value as string);
    }
  }
  const found = parsed.ast ? referencesOf(parsed.ast, rows, cols) : { refs: [], ranges: [] };
  return { ...parsed, ...found };
}

/** First index in `list` (ascending) holding a value >= `value`. */
function lowerBound(list: readonly number[], value: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Files a formula in the graph: who it reads, and where it sits. */
function register(sheet: FormulaSheet, key: number, formula: SheetFormula): void {
  const { cols } = sheet;
  sheet.formulas.set(key, formula);
  for (const dep of formula.refs) {
    let set = sheet.dependents.get(dep);
    if (!set) sheet.dependents.set(dep, (set = new Set()));
    set.add(key);
  }
  if (formula.ranges.length > 0) formula.filed = [];
  for (const range of formula.ranges) {
    for (let col = range.c0; col <= range.c1; col += 1) {
      const entry: RangeEntry = { r0: range.r0, r1: range.r1, key };
      let set = sheet.ranges.get(col);
      if (!set) sheet.ranges.set(col, (set = new Set()));
      set.add(entry);
      formula.filed?.push({ col, entry });
    }
  }
  const col = key % cols;
  const row = Math.floor(key / cols);
  let rows = sheet.formulaRows.get(col);
  if (!rows) sheet.formulaRows.set(col, (rows = []));
  const at = lowerBound(rows, row);
  if (rows[at] !== row) rows.splice(at, 0, row);
}

/** Takes a formula out of the graph. */
function unregister(sheet: FormulaSheet, key: number): void {
  const formula = sheet.formulas.get(key);
  if (!formula) return;
  for (const dep of formula.refs) sheet.dependents.get(dep)?.delete(key);
  for (const { col, entry } of formula.filed ?? []) sheet.ranges.get(col)?.delete(entry);
  const col = key % sheet.cols;
  const rows = sheet.formulaRows.get(col);
  if (rows) {
    const at = lowerBound(rows, Math.floor(key / sheet.cols));
    if (rows[at] === Math.floor(key / sheet.cols)) rows.splice(at, 1);
  }
  sheet.formulas.delete(key);
  sheet.values.delete(key);
}

/** Formula cells inside a range that have no value yet, in `into`. */
function pendingIn(sheet: FormulaSheet, range: RangeDep, into: number[]): void {
  for (let col = range.c0; col <= range.c1; col += 1) {
    const rows = sheet.formulaRows.get(col);
    if (!rows) continue;
    for (let i = lowerBound(rows, range.r0); i < rows.length; i += 1) {
      const row = rows[i] as number;
      if (row > range.r1) break;
      const key = row * sheet.cols + col;
      if (!sheet.values.has(key)) into.push(key);
    }
  }
}

/** The formula cells that must be evaluated before `key`'s formula, and have not been yet. */
function pendingDeps(sheet: FormulaSheet, formula: SheetFormula): number[] {
  const deps: number[] = [];
  for (const dep of formula.refs)
    if (sheet.formulas.has(dep) && !sheet.values.has(dep)) deps.push(dep);
  for (const range of formula.ranges) pendingIn(sheet, range, deps);
  return deps;
}

/**
 * Evaluates `targets` (formula cells) in dependency order with an explicit stack, so long chains
 * do not overflow the call stack. Cells on a cycle get `#CYCLE!`, and a formula that fails any
 * other way gets `#ERROR!` without stopping the others.
 */
function evaluateTargets(sheet: FormulaSheet, targets: Iterable<number>): void {
  const { rows, cols, read, formulas, values } = sheet;
  const ctx: EvalContext = {
    rows,
    cols,
    memo: new Map(),
    cell: (r, c) => {
      const key = r * cols + c;
      if (!formulas.has(key)) return rawToFormulaValue(read(r, c));
      return values.get(key) ?? ERRORS["#CYCLE!"];
    },
  };
  const settle = (key: number): FormulaValue => {
    const formula = formulas.get(key) as SheetFormula;
    try {
      return formula.ast ? evaluateFormula(formula.ast, ctx) : ERRORS[formula.error ?? "#ERROR!"];
    } catch {
      return ERRORS["#ERROR!"];
    }
  };

  interface Frame {
    key: number;
    deps: number[];
    next: number;
  }
  const open = (key: number): Frame => ({
    key,
    deps: pendingDeps(sheet, formulas.get(key) as SheetFormula),
    next: 0,
  });
  for (const start of targets) {
    if (values.has(start) || !formulas.has(start)) continue;
    const stack: Frame[] = [open(start)];
    const onStack = new Map<number, number>([[start, 0]]);
    const cyclic = new Set<number>();
    while (stack.length > 0) {
      const top = stack[stack.length - 1] as Frame;
      if (top.next < top.deps.length) {
        const dep = top.deps[top.next] as number;
        top.next += 1;
        if (values.has(dep)) continue;
        const at = onStack.get(dep);
        if (at !== undefined) {
          for (let i = at; i < stack.length; i += 1) cyclic.add((stack[i] as Frame).key);
          continue;
        }
        onStack.set(dep, stack.length);
        stack.push(open(dep));
        continue;
      }
      stack.pop();
      onStack.delete(top.key);
      values.set(top.key, cyclic.has(top.key) ? ERRORS["#CYCLE!"] : settle(top.key));
    }
  }
}

/** Finds every formula cell, links the dependency graph and evaluates the sheet. */
export function buildSheet(input: SheetInput): FormulaSheet {
  const { rows, cols, read, cache } = input;
  const sheet: FormulaSheet = {
    rows,
    cols,
    read,
    formulas: new Map(),
    dependents: new Map(),
    ranges: new Map(),
    formulaRows: new Map(),
    values: new Map(),
  };
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const raw = read(r, c);
      if (isFormulaText(raw))
        register(sheet, r * cols + c, { text: raw, ...parseCell(raw, rows, cols, cache) });
    }
  }
  evaluateTargets(sheet, sheet.formulas.keys());
  return sheet;
}

/**
 * The formula cells that must be recalculated after the cells `keys` changed: those formulas
 * themselves (if they are) and everything that reads them, directly or through a range.
 */
export function dirtyCells(sheet: FormulaSheet, keys: Iterable<number>): Set<number> {
  const dirty = new Set<number>();
  const queue: number[] = [];
  const mark = (key: number) => {
    if (!dirty.has(key)) {
      dirty.add(key);
      queue.push(key);
    }
  };
  const visit = (key: number) => {
    for (const dependent of sheet.dependents.get(key) ?? []) mark(dependent);
    const row = Math.floor(key / sheet.cols);
    for (const entry of sheet.ranges.get(key % sheet.cols) ?? [])
      if (row >= entry.r0 && row <= entry.r1) mark(entry.key);
  };
  for (const key of keys) {
    if (sheet.formulas.has(key)) mark(key);
    visit(key);
  }
  while (queue.length > 0) visit(queue.pop() as number);
  return dirty;
}

/**
 * Recalculates after the cells `changed` (`[row, col]` pairs) were written to the data that
 * `sheet.read` reads from, which must be a live view of it: the changed formulas are parsed again
 * and only what depends on them is evaluated. Updates the sheet in place and returns it.
 */
export function updateCells(
  sheet: FormulaSheet,
  changed: Iterable<readonly [number, number]>,
  cache?: ParseCache,
): FormulaSheet {
  const { rows, cols, read } = sheet;
  const keys = new Set<number>();
  for (const [r, c] of changed) keys.add(r * cols + c);
  for (const key of keys) {
    unregister(sheet, key);
    const raw = read(Math.floor(key / cols), key % cols);
    if (isFormulaText(raw))
      register(sheet, key, { text: raw, ...parseCell(raw, rows, cols, cache) });
  }
  const dirty = dirtyCells(sheet, keys);
  for (const key of dirty) sheet.values.delete(key);
  evaluateTargets(sheet, dirty);
  return sheet;
}

/** Result of a cell, formulas evaluated. */
export function sheetValue(sheet: FormulaSheet, r: number, c: number): FormulaValue {
  const key = r * sheet.cols + c;
  if (!sheet.formulas.has(key)) return rawToFormulaValue(sheet.read(r, c));
  return sheet.values.get(key) ?? ERRORS["#CYCLE!"];
}

/** The value a grid cell shows: formula results as plain values, errors as their code. */
export function displayValue(sheet: FormulaSheet, r: number, c: number): CellValue | undefined {
  const key = r * sheet.cols + c;
  if (!sheet.formulas.has(key)) return undefined;
  const value = sheet.values.get(key) ?? ERRORS["#CYCLE!"];
  return isFormulaError(value) ? value.code : value;
}

/** Cells the formula at (r, c) reads, as `[row, col]` pairs (ranges expanded, for inspection). */
export function precedentsOf(sheet: FormulaSheet, r: number, c: number): Array<[number, number]> {
  const formula = sheet.formulas.get(r * sheet.cols + c);
  if (!formula) return [];
  const out: Array<[number, number]> = formula.refs.map((key) => [
    Math.floor(key / sheet.cols),
    key % sheet.cols,
  ]);
  for (const range of formula.ranges)
    for (let rr = range.r0; rr <= range.r1; rr += 1)
      for (let cc = range.c0; cc <= range.c1; cc += 1) out.push([rr, cc]);
  return out;
}

const ERROR_TEXTS: ReadonlySet<string> = new Set(Object.keys(ERRORS));

/** Whether a displayed value is the text of a formula error. */
export function isErrorText(value: CellValue): value is ErrorCode {
  return typeof value === "string" && ERROR_TEXTS.has(value);
}
