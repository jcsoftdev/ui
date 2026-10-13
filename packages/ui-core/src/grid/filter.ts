import { isEmptyValue, selectKey, toNumber, toTime } from "../internal/grid-values.js";
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

/** Lower-cases and strips accents for `locale`, with a cheap path for plain ASCII. */
export function createFold(locale?: string): (text: string) => string {
  const special = !!locale && LOCALE_CASE.test(locale);
  const lower = special
    ? (text: string) => text.toLocaleLowerCase(locale)
    : (text: string) => text.toLowerCase();
  return (text) => {
    for (let i = 0; i < text.length; i += 1) {
      if (text.charCodeAt(i) > 127) return lower(text.normalize("NFD").replace(/\p{M}/gu, ""));
    }
    return lower(text);
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

function parseNumber(input: FilterInput | undefined): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") return Number.parseFloat(input.replace(",", "."));
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
  /** Quick search: every word must appear in some column (raw or formatted text). */
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
      return filter.query.trim() !== "";
    case "range":
      return typeof filter.min === "number" || typeof filter.max === "number";
    case "dateRange":
      return !!filter.from || !!filter.to;
    case "select":
      return filter.values.length > 0;
    case "boolean":
      return typeof filter.value === "boolean";
  }
}

/**
 * Compiles header filters, the advanced tree and the quick search into one predicate. Everything
 * that does not depend on the row (parsed numbers, day bounds, folded needles, sets) is computed
 * once, so testing a row allocates nothing beyond the text it folds.
 */
export function compileFilter<T>(options: FilterOptions<T>): CompiledFilter<T> {
  const { rows, columns, locale } = options;
  const format: FormatOptions = { locale, labels: options.labels };
  const fold = createFold(locale);
  const byId = new Map<string, GridColumn<T>>();
  for (const column of columns) byId.set(column.id, column);
  const preds: Pred<T>[] = [];

  const simple = (column: GridColumn<T>, filter: ColumnFilter): Pred<T> | null => {
    if (!isColumnFilterActive(filter)) return null;
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
  };

  const condition = (node: FilterCondition): Pred<T> | null => {
    if (!isConditionActive(node)) return null;
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
      const right = parseNumber(node.value);
      const upper = parseNumber(node.value2);
      const reject = () => false;
      if (!Number.isFinite(right)) return reject;
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
      const [start, end] = bounds;
      const upper = operator === "between" ? (dayBounds(node.value2)?.[1] ?? null) : null;
      const test = ((): ((time: number) => boolean) => {
        switch (operator) {
          case "equals":
          case "on":
            return (time) => time >= start && time <= end;
          case "before":
            return (time) => time < start;
          case "after":
            return (time) => time > end;
          case "between":
            return upper === null ? () => false : (time) => time >= start && time <= upper;
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

  const node = (n: FilterNode): Pred<T> | null => {
    if (n.type === "condition") return condition(n);
    const children: Pred<T>[] = [];
    for (const child of n.children) {
      if (!isNodeActive(child)) continue;
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

  if (options.filters) {
    for (const column of columns) {
      const filter = options.filters[column.id];
      const pred = filter ? simple(column, filter) : null;
      if (pred) preds.push(pred);
    }
  }
  if (options.advanced) {
    const pred = node(options.advanced);
    if (pred) preds.push(pred);
  }
  const words = fold(options.search ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 0) {
    const cols = options.searchColumns ?? columns;
    const texts = new Array<string>(cols.length);
    preds.push((row) => {
      for (let c = 0; c < cols.length; c += 1) {
        const column = cols[c] as GridColumn<T>;
        const value = getCellValue(row, column);
        texts[c] = fold(
          `${value instanceof Date ? "" : String(value ?? "")} ${formatCellValue(value, column, format)}`,
        );
      }
      for (let w = 0; w < words.length; w += 1) {
        let found = false;
        for (let c = 0; c < texts.length; c += 1) {
          if ((texts[c] as string).includes(words[w] as string)) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return true;
    });
  }

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
