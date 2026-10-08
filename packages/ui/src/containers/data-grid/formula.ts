// Spreadsheet formulas for DataGrid: tokenizer, parser and evaluator. Pure; no DOM, no React.
//
// A formula is a cell text starting with `=`. References are A1 style (`B3`, `$B$3`, `B3:D9`) or
// R1C1 style (`R3C2`): the letter is the position of the column in the grid's column list and the
// number is the 1-based position of the row in the data the grid was given.

export type ErrorCode = "#REF!" | "#DIV/0!" | "#NAME?" | "#VALUE!" | "#CYCLE!" | "#ERROR!";

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

function tokenize(text: string, from: number): Token[] | null {
  const tokens: Token[] = [];
  let i = from;
  while (i < text.length) {
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

class Parser {
  private pos = 0;
  private depth = 0;
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

  private binary(next: () => FormulaNode, ops: (op: string) => boolean): FormulaNode {
    let left = next();
    for (;;) {
      const token = this.peek();
      if (token?.k !== "op" || !ops(token.v)) return left;
      this.pos += 1;
      left = { t: "bin", op: token.v, l: left, r: next() };
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
      return { t: "un", op: token.v, x };
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    const token = this.peek();
    if (!token) throw new SyntaxProblem("unexpected end");
    this.pos += 1;
    if (token.k === "num") return { t: "num", v: token.v };
    if (token.k === "str") return { t: "str", v: token.v };
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
      const args: FormulaNode[] = [];
      if (!this.isOp(")")) {
        for (;;) {
          args.push(this.comparison());
          if (this.isOp(",") || this.isOp(";")) this.pos += 1;
          else break;
        }
      }
      this.expect(")");
      return { t: "call", name: token.v.toUpperCase(), args };
    }
    const upper = token.v.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") return { t: "bool", v: upper === "TRUE" };
    const ref = parseAddress(token.v);
    if (!ref) return { t: "name", v: token.v };
    if (this.isOp(":")) {
      this.pos += 1;
      const endToken = this.peek();
      const end = endToken?.k === "id" ? parseAddress(endToken.v) : null;
      if (!end) throw new SyntaxProblem("bad range");
      this.pos += 1;
      return { t: "range", a: ref, b: end };
    }
    return { t: "ref", ref };
  }
}

/** Parses a formula; the leading `=` is optional. Syntax problems are reported, not thrown. */
export function parseFormula(text: string): ParseResult {
  const trimmed = text.trimStart();
  const tokens = tokenize(trimmed, trimmed.startsWith("=") ? 1 : 0);
  if (!tokens) return { ok: false, error: "#ERROR!" };
  try {
    return { ok: true, ast: new Parser(tokens).parse() };
  } catch (error) {
    if (error instanceof SyntaxProblem) return { ok: false, error: "#ERROR!" };
    throw error;
  }
}

// ---- reference shifting (fill, paste) -------------------------------------------------------

function formatRef(ref: CellRef): string {
  return `${ref.absC ? "$" : ""}${columnLabel(ref.c)}${ref.absR ? "$" : ""}${ref.r + 1}`;
}

/**
 * Moves the relative references of a formula by `dr` rows and `dc` columns, the way a spreadsheet
 * does when a formula is filled down or right; `$` references stay. Text outside references is
 * kept as typed. A reference pushed off the sheet becomes `#REF!`.
 */
export function shiftFormula(text: string, dr: number, dc: number): string {
  const lead = text.length - text.trimStart().length;
  const trimmed = text.slice(lead);
  const tokens = tokenize(trimmed, trimmed.startsWith("=") ? 1 : 0);
  if (!tokens) return text;
  let out = "";
  let last = 0;
  tokens.forEach((token, index) => {
    if (token.k !== "id" || /^R\d+C\d+$/i.test(token.v)) return;
    const next = tokens[index + 1];
    if (next?.k === "op" && next.v === "(") return;
    const ref = parseAddress(token.v);
    if (!ref) return;
    const r = ref.absR ? ref.r : ref.r + dr;
    const c = ref.absC ? ref.c : ref.c + dc;
    out += trimmed.slice(last, token.s);
    out += r < 0 || c < 0 ? "#REF!" : formatRef({ ...ref, r, c });
    last = token.e;
  });
  return text.slice(0, lead) + out + trimmed.slice(last);
}

// ---- evaluator ------------------------------------------------------------------------------

const ERRORS: Record<ErrorCode, FormulaError> = {
  "#REF!": new FormulaError("#REF!"),
  "#DIV/0!": new FormulaError("#DIV/0!"),
  "#NAME?": new FormulaError("#NAME?"),
  "#VALUE!": new FormulaError("#VALUE!"),
  "#CYCLE!": new FormulaError("#CYCLE!"),
  "#ERROR!": new FormulaError("#ERROR!"),
};

export function formulaError(code: ErrorCode): FormulaError {
  return ERRORS[code];
}

interface RangeValue {
  range: FormulaValue[][];
}
type Value = FormulaValue | RangeValue;

function isRange(value: Value): value is RangeValue {
  return typeof value === "object" && value !== null && "range" in value;
}

export interface EvalContext {
  rows: number;
  cols: number;
  /** Value of a cell inside the sheet (formulas already evaluated). */
  cell: (r: number, c: number) => FormulaValue;
}

/** Keeps arithmetic free of binary noise (`0.1 + 0.2` is `0.3`), like spreadsheets do. */
function tidy(n: number): number {
  return Number.isFinite(n) ? Number(n.toPrecision(15)) : n;
}

function toNumber(value: FormulaValue): number | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return 0;
  const text = value.trim();
  if (text === "") return ERRORS["#VALUE!"];
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
  const range: FormulaValue[][] = [];
  for (let r = r0; r <= r1; r += 1) {
    const line: FormulaValue[] = [];
    for (let c = c0; c <= c1; c += 1) line.push(ctx.cell(r, c));
    range.push(line);
  }
  return { range };
}

/** Numbers of the arguments for SUM, AVERAGE, MIN and MAX; the first error wins. */
function numbersOf(args: readonly FormulaNode[], ctx: EvalContext): number[] | FormulaError {
  const numbers: number[] = [];
  for (const arg of args) {
    const value = evaluate(arg, ctx);
    if (isRange(value)) {
      for (const line of value.range) {
        for (const cell of line) {
          if (isFormulaError(cell)) return cell;
          if (typeof cell === "number") numbers.push(cell);
        }
      }
      continue;
    }
    if (isFormulaError(value)) return value;
    if (value === null) continue;
    const n = toNumber(value);
    if (isFormulaError(n)) return n;
    numbers.push(n);
  }
  return numbers;
}

type FormulaFunction = (args: readonly FormulaNode[], ctx: EvalContext) => Value;

const FUNCTIONS: Record<string, FormulaFunction> = {
  SUM: (args, ctx) => {
    const numbers = numbersOf(args, ctx);
    return isFormulaError(numbers) ? numbers : tidy(numbers.reduce((sum, n) => sum + n, 0));
  },
  AVERAGE: (args, ctx) => {
    const numbers = numbersOf(args, ctx);
    if (isFormulaError(numbers)) return numbers;
    if (numbers.length === 0) return ERRORS["#DIV/0!"];
    return tidy(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
  },
  MIN: (args, ctx) => {
    const numbers = numbersOf(args, ctx);
    return isFormulaError(numbers) ? numbers : numbers.length ? Math.min(...numbers) : 0;
  },
  MAX: (args, ctx) => {
    const numbers = numbersOf(args, ctx);
    return isFormulaError(numbers) ? numbers : numbers.length ? Math.max(...numbers) : 0;
  },
  COUNT: (args, ctx) => {
    let count = 0;
    for (const arg of args) {
      const value = evaluate(arg, ctx);
      if (isRange(value)) {
        for (const line of value.range) {
          for (const cell of line) if (typeof cell === "number") count += 1;
        }
      } else if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        (typeof value === "string" && !isFormulaError(toNumber(value)))
      ) {
        count += 1;
      }
    }
    return count;
  },
  IF: (args, ctx) => {
    if (args.length < 2 || args.length > 3) return ERRORS["#VALUE!"];
    const condition = toBool(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    if (isFormulaError(condition)) return condition;
    if (condition) return evaluate(args[1] as FormulaNode, ctx);
    return args[2] ? evaluate(args[2], ctx) : false;
  },
  ROUND: (args, ctx) => {
    if (args.length < 1 || args.length > 2) return ERRORS["#VALUE!"];
    const value = toNumber(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    if (isFormulaError(value)) return value;
    const digits = args[1] ? toNumber(scalarOf(evaluate(args[1], ctx))) : 0;
    if (isFormulaError(digits)) return digits;
    return roundHalfAway(value, Math.trunc(digits));
  },
  ABS: (args, ctx) => {
    if (args.length !== 1) return ERRORS["#VALUE!"];
    const value = toNumber(scalarOf(evaluate(args[0] as FormulaNode, ctx)));
    return isFormulaError(value) ? value : Math.abs(value);
  },
  CONCAT: (args, ctx) => {
    let text = "";
    for (const arg of args) {
      const value = evaluate(arg, ctx);
      const parts = isRange(value) ? value.range.flat() : [value];
      for (const part of parts) {
        if (isFormulaError(part)) return part;
        text += formulaText(part);
      }
    }
    return text;
  },
};

/** Names of the functions a formula may call. */
export const FORMULA_FUNCTIONS: readonly string[] = Object.keys(FUNCTIONS);

function arithmetic(op: string, left: FormulaValue, right: FormulaValue): FormulaValue {
  const x = toNumber(left);
  if (isFormulaError(x)) return x;
  const y = toNumber(right);
  if (isFormulaError(y)) return y;
  switch (op) {
    case "+":
      return tidy(x + y);
    case "-":
      return tidy(x - y);
    case "*":
      return tidy(x * y);
    case "/":
      return y === 0 ? ERRORS["#DIV/0!"] : tidy(x / y);
    default: {
      const result = x ** y;
      return Number.isFinite(result) ? tidy(result) : ERRORS["#VALUE!"];
    }
  }
}

function evaluate(node: FormulaNode, ctx: EvalContext): Value {
  switch (node.t) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "name":
      return ERRORS["#NAME?"];
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

/** Every cell a formula reads, ranges expanded; references and ranges outside the sheet are left out (they evaluate to #REF!). */
export function referencesOf(ast: FormulaNode, rows: number, cols: number): number[] {
  const keys = new Set<number>();
  const visit = (node: FormulaNode): void => {
    switch (node.t) {
      case "ref":
        if (node.ref.r >= 0 && node.ref.c >= 0 && node.ref.r < rows && node.ref.c < cols) {
          keys.add(node.ref.r * cols + node.ref.c);
        }
        return;
      case "range": {
        const r0 = Math.min(node.a.r, node.b.r);
        const r1 = Math.max(node.a.r, node.b.r);
        const c0 = Math.min(node.a.c, node.b.c);
        const c1 = Math.max(node.a.c, node.b.c);
        if (r0 < 0 || c0 < 0 || r1 >= rows || c1 >= cols) return;
        for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) keys.add(r * cols + c);
        return;
      }
      case "un":
        visit(node.x);
        return;
      case "bin":
        visit(node.l);
        visit(node.r);
        return;
      case "call":
        for (const arg of node.args) visit(arg);
        return;
      default:
    }
  };
  visit(ast);
  return [...keys];
}
