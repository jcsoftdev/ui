import {
  canonicalLocale,
  isEmptyValue,
  selectKey,
  toNumber,
  toTime,
} from "../internal/grid-values.js";
import { parseNumber as parseLocaleNumber } from "./edit.js";
import {
  type CellValue,
  type FilterKind,
  type FormatOptions,
  formatCellValue,
  type GridColumn,
  getCellValue,
} from "./model.js";

export type FilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "before"
  | "after"
  /** Alias of `equals` for dates: the same local day. */
  | "on"
  | "in"
  | "notIn"
  | "isEmpty"
  | "isNotEmpty";

export type FilterLogic = "and" | "or";
export type FilterInput = string | number | boolean | Date;

export interface FilterCondition {
  type: "condition";
  id: string;
  columnId: string;
  operator: FilterOperator;
  /** Text, number, boolean, `Date` or `yyyy-mm-dd` day, as typed. */
  value?: FilterInput;
  /** Upper end of `between`. */
  value2?: FilterInput;
  /** Members of `in` / `notIn`, compared with the cell's set-filter text. */
  values?: readonly string[];
}

export interface FilterGroup {
  type: "group";
  id: string;
  logic: FilterLogic;
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

/** One filter per column (the header filters). Empty values match everything. */
export type ColumnFilter =
  | { kind: "text"; query: string }
  | { kind: "range"; min?: number | null; max?: number | null }
  /** ISO days (`yyyy-mm-dd`), both ends inclusive, local time. */
  | { kind: "dateRange"; from?: string | null; to?: string | null }
  | { kind: "select"; values: readonly string[] }
  | { kind: "boolean"; value?: boolean | null };

/** Select-filter value that matches no row: "nothing checked" in a set filter. */
export const SET_NONE = "\u0000none";

const TEXT_OPERATORS: FilterOperator[] = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];
const NUMBER_OPERATORS: FilterOperator[] = [
  "equals",
  "notEquals",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "isEmpty",
  "isNotEmpty",
];
const DATE_OPERATORS: FilterOperator[] = [
  "equals",
  "before",
  "after",
  "between",
  "isEmpty",
  "isNotEmpty",
];
const SELECT_OPERATORS: FilterOperator[] = [
  "equals",
  "notEquals",
  "in",
  "notIn",
  "isEmpty",
  "isNotEmpty",
];

/** The filter kind of a column: its own `filter`, else picked from its `type`. */
export function filterKindOf<T>(column: GridColumn<T>): FilterKind {
  if (column.filter) return column.filter;
  switch (column.type) {
    case "number":
    case "currency":
      return "range";
    case "date":
      return "dateRange";
    case "status":
    case "boolean":
      return "select";
    default:
      return "text";
  }
}

export function operatorsFor<T>(column: GridColumn<T>): FilterOperator[] {
  const kind = filterKindOf(column);
  if (kind === "range") return NUMBER_OPERATORS;
  if (kind === "dateRange") return DATE_OPERATORS;
  if (kind === "select" || kind === "set") return SELECT_OPERATORS;
  return TEXT_OPERATORS;
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== "isEmpty" && operator !== "isNotEmpty";
}

let counter = 0;
export function newFilterId(prefix = "f"): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export function emptyGroup(logic: FilterLogic = "and", id = newFilterId("g")): FilterGroup {
  return { type: "group", id, logic, children: [] };
}

export function newCondition<T>(column: GridColumn<T>): FilterCondition {
  return {
    type: "condition",
    id: newFilterId("c"),
    columnId: column.id,
    operator: operatorsFor(column)[0] ?? "contains",
    value: "",
  };
}

const blank = (value: FilterInput | undefined) =>
  value === undefined || (typeof value === "string" && value.trim() === "");

/** A condition counts once it has what its operator needs. */
export function isConditionActive(condition: FilterCondition): boolean {
  const { operator } = condition;
  if (!operatorNeedsValue(operator)) return true;
  if (operator === "in" || operator === "notIn") return (condition.values?.length ?? 0) > 0;
  if (blank(condition.value)) return false;
  return operator !== "between" || !blank(condition.value2);
}

/** Empty groups and incomplete conditions are ignored. */
export function isNodeActive(node: FilterNode): boolean {
  return node.type === "condition" ? isConditionActive(node) : node.children.some(isNodeActive);
}

export function countConditions(node: FilterNode): number {
  if (node.type === "condition") return isConditionActive(node) ? 1 : 0;
  let total = 0;
  for (const child of node.children) total += countConditions(child);
  return total;
}

function mapNode(node: FilterNode, id: string, fn: (node: FilterNode) => FilterNode): FilterNode {
  if (node.id === id) return fn(node);
  if (node.type === "condition") return node;
  return { ...node, children: node.children.map((child) => mapNode(child, id, fn)) };
}

/** Replaces the node with `id` (immutably). */
export function updateNode(
  root: FilterGroup,
  id: string,
  fn: (node: FilterNode) => FilterNode,
): FilterGroup {
  return mapNode(root, id, fn) as FilterGroup;
}

/** Adds `child` at the end of the group `groupId`. */
export function addChild(root: FilterGroup, groupId: string, child: FilterNode): FilterGroup {
  return updateNode(root, groupId, (node) =>
    node.type === "group" ? { ...node, children: [...node.children, child] } : node,
  );
}

/** Removes the node with `id`; the root itself stays. */
export function removeNode(root: FilterGroup, id: string): FilterGroup {
  const strip = (group: FilterGroup): FilterGroup => ({
    ...group,
    children: group.children
      .filter((child) => child.id !== id)
      .map((child) => (child.type === "group" ? strip(child) : child)),
  });
  return strip(root);
}

// ---- text folding ---------------------------------------------------------------------------

const LOCALE_CASE = /^(tr|az|lt)(-|$)/i;

/**
 * Lower-cases for `locale` first (so Turkish `İ` and `I` fold right), then strips accents and
 * folds `ß` to `ss`. Plain ASCII takes a cheap path.
 */
export function createFold(locale?: string): (text: string) => string {
  const tag = canonicalLocale(locale);
  const special = LOCALE_CASE.test(tag);
  const lower = special
    ? (text: string) => text.toLocaleLowerCase(tag)
    : (text: string) => text.toLowerCase();
  return (text) => {
    const folded = lower(text);
    for (let i = 0; i < folded.length; i += 1) {
      if (folded.charCodeAt(i) > 127)
        return folded.normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");
    }
    return folded;
  };
}

/** Local day bounds `[start, end]` in epoch ms of a `yyyy-mm-dd` day, a `Date` or a time. */
export function dayBounds(input: FilterInput | undefined): [number, number] | null {
  let y: number;
  let m: number;
  let d: number;
  if (typeof input === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (!match) return null;
    y = Number(match[1]);
    m = Number(match[2]) - 1;
    d = Number(match[3]);
    const probe = new Date(y, m, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== m || probe.getDate() !== d) return null;
  } else if (input instanceof Date || typeof input === "number") {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    y = date.getFullYear();
    m = date.getMonth();
    d = date.getDate();
  } else return null;
  return [new Date(y, m, d).getTime(), new Date(y, m, d, 23, 59, 59, 999).getTime()];
}

/** A typed number: numbers pass, text is read in `locale` (`1.234,5` in es, `1,234.5` in en). */
function parseNumber(input: FilterInput | undefined, locale: string): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") return parseLocaleNumber(input, locale) ?? Number.NaN;
  return Number.NaN;
}

// ---- compile --------------------------------------------------------------------------------

export interface FilterOptions<T> {
  /** Source rows; `test(i)` reads `rows[i]`. */
  rows: readonly T[];
  columns: readonly GridColumn<T>[];
  /** Header filters by column id. */
  filters?: Readonly<Record<string, ColumnFilter>>;
  /** The advanced AND / OR tree. */
  advanced?: FilterNode;
  /** Quick search: every word must appear in the raw or the formatted text of some search column. */
  search?: string;
  /** Columns the quick search reads, e.g. the visible ones; defaults to all `columns`. */
  searchColumns?: readonly GridColumn<T>[];
  /** Locale of case folding and formatted text. */
  locale?: string;
  labels?: FormatOptions["labels"];
}

export interface CompiledFilter<T> {
  /** `false` when nothing filters: skip the stage. */
  active: boolean;
  /** For the view's filter stage: keeps source row `source`. */
  test: (source: number) => boolean;
  testRow: (row: T) => boolean;
}

type Pred<T> = (row: T) => boolean;

export function isColumnFilterActive(filter: ColumnFilter | undefined): boolean {
  if (!filter) return false;
  switch (filter.kind) {
    case "text":
      return typeof filter.query === "string" && filter.query.trim() !== "";
    case "range":
      return typeof filter.min === "number" || typeof filter.max === "number";
    case "dateRange":
      return !!filter.from || !!filter.to;
    case "select":
      return Array.isArray(filter.values) && filter.values.length > 0;
    case "boolean":
      return typeof filter.value === "boolean";
  }
  return false;
}

const OPERATORS = new Set<string>([
  ...TEXT_OPERATORS,
  ...NUMBER_OPERATORS,
  ...DATE_OPERATORS,
  ...SELECT_OPERATORS,
  "on",
]);
/** Deepest advanced tree `sanitizeFilter` keeps. */
export const MAX_FILTER_DEPTH = 32;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isInput = (value: unknown): value is FilterInput =>
  typeof value === "string" ||
  (typeof value === "number" && !Number.isNaN(value)) ||
  typeof value === "boolean" ||
  value instanceof Date;

export interface SanitizedFilter {
  /** The advanced tree with only valid, active nodes (`undefined` when none is left). */
  advanced: FilterNode | undefined;
  /** Header filters that are valid and active. */
  filters: Record<string, ColumnFilter>;
  /** How many nodes or filters were dropped as invalid. */
  dropped: number;
}

/**
 * Cleans saved filter state (storage, URLs, a host app) before it is compiled: non-objects, unknown
 * operators or `logic`, missing `children` / `values` / `query`, cycles and trees deeper than
 * `MAX_FILTER_DEPTH` are dropped, and so is everything inactive. Never throws.
 */
export function sanitizeFilter(advanced: unknown, filters?: unknown): SanitizedFilter {
  let dropped = 0;
  const seen = new Set<object>();
  const node = (value: unknown, depth: number): FilterNode | null => {
    if (!isObject(value) || depth > MAX_FILTER_DEPTH || seen.has(value)) {
      dropped += 1;
      return null;
    }
    if (value.type === "condition") {
      const { columnId, operator } = value;
      if (
        typeof columnId !== "string" ||
        typeof operator !== "string" ||
        !OPERATORS.has(operator)
      ) {
        dropped += 1;
        return null;
      }
      const clean: FilterCondition = {
        type: "condition",
        id: typeof value.id === "string" ? value.id : "",
        columnId,
        operator: operator as FilterOperator,
      };
      if (isInput(value.value)) clean.value = value.value;
      if (isInput(value.value2)) clean.value2 = value.value2;
      if (Array.isArray(value.values))
        clean.values = value.values.filter((v): v is string => typeof v === "string");
      else if (operator === "in" || operator === "notIn") {
        dropped += 1;
        return null;
      }
      return isConditionActive(clean) ? clean : null;
    }
    if (value.type === "group") {
      if ((value.logic !== "and" && value.logic !== "or") || !Array.isArray(value.children)) {
        dropped += 1;
        return null;
      }
      seen.add(value);
      const children: FilterNode[] = [];
      for (const child of value.children) {
        const clean = node(child, depth + 1);
        if (clean) children.push(clean);
      }
      seen.delete(value);
      return children.length > 0
        ? {
            type: "group",
            id: typeof value.id === "string" ? value.id : "",
            logic: value.logic,
            children,
          }
        : null;
    }
    dropped += 1;
    return null;
  };
  const columnFilters: Record<string, ColumnFilter> = Object.create(null);
  if (isObject(filters)) {
    for (const id of Object.keys(filters)) {
      const f = filters[id];
      if (!isObject(f)) {
        dropped += 1;
        continue;
      }
      let clean: ColumnFilter | null = null;
      switch (f.kind) {
        case "text":
          if (typeof f.query === "string") clean = { kind: "text", query: f.query };
          break;
        case "range":
          clean = {
            kind: "range",
            min: typeof f.min === "number" && !Number.isNaN(f.min) ? f.min : null,
            max: typeof f.max === "number" && !Number.isNaN(f.max) ? f.max : null,
          };
          break;
        case "dateRange":
          clean = {
            kind: "dateRange",
            from: typeof f.from === "string" ? f.from : null,
            to: typeof f.to === "string" ? f.to : null,
          };
          break;
        case "select":
          if (Array.isArray(f.values))
            clean = {
              kind: "select",
              values: f.values.filter((v): v is string => typeof v === "string"),
            };
          break;
        case "boolean":
          clean = { kind: "boolean", value: typeof f.value === "boolean" ? f.value : null };
          break;
      }
      if (!clean) dropped += 1;
      else if (isColumnFilterActive(clean)) columnFilters[id] = clean;
    }
  }
  const tree = advanced === undefined || advanced === null ? null : node(advanced, 0);
  return { advanced: tree ?? undefined, filters: columnFilters, dropped };
}

/**
 * Compiles header filters, the advanced tree and the quick search into one predicate. Saved state
 * goes through `sanitizeFilter` first (invalid parts are dropped with one dev warning). Everything
 * that does not depend on the row (parsed numbers, day bounds, folded needles, sets, the locale) is
 * computed once, so testing a row allocates nothing beyond the text it folds.
 */
export function compileFilter<T>(options: FilterOptions<T>): CompiledFilter<T> {
  const { rows, columns } = options;
  const locale = canonicalLocale(options.locale);
  const format: FormatOptions = { locale, labels: options.labels };
  const fold = createFold(locale);
  const clean = sanitizeFilter(options.advanced, options.filters);
  if (clean.dropped > 0 && typeof console !== "undefined")
    console.warn(`[ui-core/grid/filter] ignored ${clean.dropped} invalid filter node(s)`);
  const byId = new Map<string, GridColumn<T>>();
  for (const column of columns) byId.set(column.id, column);
  const preds: Pred<T>[] = [];

  const simple = (column: GridColumn<T>, filter: ColumnFilter): Pred<T> | null => {
    switch (filter.kind) {
      case "text": {
        const needle = fold(filter.query.trim());
        return (row) => {
          const value = getCellValue(row, column);
          return fold(`${String(value ?? "")} ${formatCellValue(value, column, format)}`).includes(
            needle,
          );
        };
      }
      case "range": {
        const { min, max } = filter;
        const lo = typeof min === "number" ? min : Number.NEGATIVE_INFINITY;
        const hi = typeof max === "number" ? max : Number.POSITIVE_INFINITY;
        return (row) => {
          const number = toNumber(getCellValue(row, column));
          return number !== null && number >= lo && number <= hi;
        };
      }
      case "dateRange": {
        const from = filter.from ? (dayBounds(filter.from)?.[0] ?? null) : null;
        const to = filter.to ? (dayBounds(filter.to)?.[1] ?? null) : null;
        return (row) => {
          const time = toTime(getCellValue(row, column));
          return time !== null && (from === null || time >= from) && (to === null || time <= to);
        };
      }
      case "select": {
        const set = new Set(filter.values);
        return (row) => set.has(selectKey(getCellValue(row, column), column, format));
      }
      case "boolean": {
        const want = filter.value;
        return (row) => {
          const value = getCellValue(row, column);
          return !isEmptyValue(value) && Boolean(value) === want;
        };
      }
    }
    return null;
  };

  const condition = (node: FilterCondition): Pred<T> | null => {
    const column = byId.get(node.columnId);
    if (!column) return null;
    const { operator } = node;
    if (operator === "isEmpty") return (row) => isEmptyValue(getCellValue(row, column));
    if (operator === "isNotEmpty") return (row) => !isEmptyValue(getCellValue(row, column));
    if (operator === "in" || operator === "notIn") {
      const set = new Set(node.values);
      const want = operator === "in";
      return (row) => set.has(selectKey(getCellValue(row, column), column, format)) === want;
    }
    const kind = filterKindOf(column);
    if (kind === "range") {
      const right = parseNumber(node.value, locale);
      const upper = parseNumber(node.value2, locale);
      if (!Number.isFinite(right)) return () => false;
      const test = ((): ((left: number) => boolean) => {
        switch (operator) {
          case "equals":
            return (left) => left === right;
          case "notEquals":
            return (left) => left !== right;
          case "gt":
            return (left) => left > right;
          case "gte":
            return (left) => left >= right;
          case "lt":
            return (left) => left < right;
          case "lte":
            return (left) => left <= right;
          case "between": {
            const lo = Math.min(right, upper);
            const hi = Math.max(right, upper);
            return Number.isFinite(upper) ? (left) => left >= lo && left <= hi : () => false;
          }
          default:
            return () => false;
        }
      })();
      return (row) => {
        const left = toNumber(getCellValue(row, column));
        return left !== null && test(left);
      };
    }
    if (kind === "dateRange") {
      const bounds = dayBounds(node.value);
      if (!bounds) return () => false;
      let [start, end] = bounds;
      if (operator === "between") {
        const other = dayBounds(node.value2);
        if (!other) return () => false;
        start = Math.min(start, other[0]);
        end = Math.max(end, other[1]);
      }
      const test = ((): ((time: number) => boolean) => {
        switch (operator) {
          case "equals":
          case "on":
          case "between":
            return (time) => time >= start && time <= end;
          case "before":
            return (time) => time < start;
          case "after":
            return (time) => time > end;
          default:
            return () => false;
        }
      })();
      return (row) => {
        const time = toTime(getCellValue(row, column));
        return time !== null && test(time);
      };
    }
    if (
      column.type === "boolean" &&
      typeof node.value !== "string" &&
      (operator === "equals" || operator === "notEquals")
    ) {
      const want = Boolean(node.value);
      const eq = operator === "equals";
      return (row) => {
        const value = getCellValue(row, column);
        return !isEmptyValue(value) && (Boolean(value) === want) === eq;
      };
    }
    const needle = fold(String(node.value ?? "").trim());
    const text = (row: T) => {
      const cell = getCellValue(row, column);
      return fold(formatCellValue(cell, column, format) || String(cell ?? ""));
    };
    switch (operator) {
      case "contains":
        return (row) => text(row).includes(needle);
      case "notContains":
        return (row) => !text(row).includes(needle);
      case "equals":
        return (row) => text(row) === needle;
      case "notEquals":
        return (row) => text(row) !== needle;
      case "startsWith":
        return (row) => text(row).startsWith(needle);
      case "endsWith":
        return (row) => text(row).endsWith(needle);
      default:
        return () => false;
    }
  };

  // The tree is already sanitized and pruned: every node left is active.
  const node = (n: FilterNode): Pred<T> | null => {
    if (n.type === "condition") return condition(n);
    const children: Pred<T>[] = [];
    for (const child of n.children) {
      const pred = node(child);
      if (pred) children.push(pred);
    }
    if (children.length === 0) return null;
    if (children.length === 1) return children[0] as Pred<T>;
    const count = children.length;
    return n.logic === "and"
      ? (row) => {
          for (let i = 0; i < count; i += 1) if (!(children[i] as Pred<T>)(row)) return false;
          return true;
        }
      : (row) => {
          for (let i = 0; i < count; i += 1) if ((children[i] as Pred<T>)(row)) return true;
          return false;
        };
  };

  for (const column of columns) {
    const filter = clean.filters[column.id];
    const pred = filter ? simple(column, filter) : null;
    if (pred) preds.push(pred);
  }
  if (clean.advanced) {
    const pred = node(clean.advanced);
    if (pred) preds.push(pred);
  }
  const words = fold(options.search ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 0)
    preds.push(searchPredicate(options.searchColumns ?? columns, words, fold, format));

  const count = preds.length;
  const testRow: Pred<T> =
    count === 0
      ? () => true
      : count === 1
        ? (preds[0] as Pred<T>)
        : (row) => {
            for (let i = 0; i < count; i += 1) if (!(preds[i] as Pred<T>)(row)) return false;
            return true;
          };
  return { active: count > 0, testRow, test: (source) => testRow(rows[source] as T) };
}

/** Whether `formatCellValue` could give text other than the value's own text. */
function needsFormat<T>(value: CellValue, column: GridColumn<T>): boolean {
  if (column.format) return true;
  if (typeof value === "string" || value === null || value === undefined) return false;
  if (typeof value === "number") return column.type === "currency" || column.type === "number";
  return true;
}

/**
 * Quick search: every word must appear in the raw text or the formatted text of some column
 * (accents and case ignored). A column is only formatted when its formatted text can differ from
 * its raw one, and nothing is joined per row.
 */
function searchPredicate<T>(
  cols: readonly GridColumn<T>[],
  words: readonly string[],
  fold: (text: string) => string,
  format: FormatOptions,
): Pred<T> {
  const n = cols.length;
  // Folded text per distinct value and column: repeated values (cities, statuses, numbers) cost a
  // lookup instead of a fold and a format. Capped, so a unique-valued column never grows it.
  const caches = cols.map(() => new Map<CellValue, string>());
  const texts = new Array<string | undefined>(n);
  const textOf = (c: number, row: T): string => {
    const column = cols[c] as GridColumn<T>;
    const value = getCellValue(row, column);
    const cache = caches[c] as Map<CellValue, string>;
    const cacheable = !(value instanceof Date);
    if (cacheable) {
      const hit = cache.get(value);
      if (hit !== undefined) return hit;
    }
    const raw = value instanceof Date || value === null || value === undefined ? "" : String(value);
    const shown = needsFormat(value, column) ? formatCellValue(value, column, format) : "";
    const text = fold(shown && shown !== raw ? `${raw} ${shown}` : raw);
    if (cacheable && cache.size < SEARCH_CACHE_SIZE) cache.set(value, text);
    return text;
  };
  return (row) => {
    texts.fill(undefined);
    for (let w = 0; w < words.length; w += 1) {
      const word = words[w] as string;
      let found = false;
      for (let c = 0; c < n; c += 1) {
        let text = texts[c];
        if (text === undefined) {
          text = textOf(c, row);
          texts[c] = text;
        }
        if (text.includes(word)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  };
}

const SEARCH_CACHE_SIZE = 5000;

// ---- set filter helpers ---------------------------------------------------------------------

/** Checked values of a set filter: every option while the filter is inactive. */
export function checkedSetValues(
  options: readonly string[],
  filter: ColumnFilter | undefined,
): Set<string> {
  if (filter?.kind !== "select" || filter.values.length === 0) return new Set(options);
  return new Set(filter.values.filter((value) => value !== SET_NONE));
}

/**
 * Checks or unchecks `values` in a set filter and returns the new filter: `undefined` when every
 * option ends up checked (no filtering), the `SET_NONE` marker when none is.
 */
export function toggleSetValues(
  options: readonly string[],
  filter: ColumnFilter | undefined,
  values: readonly string[],
  checked: boolean,
): ColumnFilter | undefined {
  const next = checkedSetValues(options, filter);
  for (const value of values) {
    if (checked) next.add(value);
    else next.delete(value);
  }
  const kept = options.filter((option) => next.has(option));
  if (kept.length === options.length) return undefined;
  return { kind: "select", values: kept.length === 0 ? [SET_NONE] : kept };
}

/** Options that contain the search text (accents and case ignored). */
export function searchOptions(
  options: readonly string[],
  query: string,
  locale?: string,
): string[] {
  const fold = createFold(locale);
  const needle = fold(query.trim());
  return needle === "" ? [...options] : options.filter((o) => fold(o).includes(needle));
}

/** Distinct set-filter values of a column, in the order of first appearance. */
export function distinctValues<T>(
  rows: readonly T[],
  column: GridColumn<T>,
  options?: FormatOptions,
): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const key = selectKey(getCellValue(rows[i] as T, column), column, options);
    if (key !== "") seen.add(key);
  }
  return [...seen];
}

export type { CellValue };
