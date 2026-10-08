// Advanced filter: AND / OR groups of conditions, evaluated against rows.
import {
  cellToNumber,
  cellToTime,
  filterKindOf,
  formatCellValue,
  getCellValue,
  isoDayBounds,
  normalizeText,
} from "./model.js";
import type { CellValue, DataGridColumn } from "./types.js";

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
  | "isEmpty"
  | "isNotEmpty";

export type FilterLogic = "and" | "or";

export interface FilterCondition {
  type: "condition";
  id: string;
  columnId: string;
  operator: FilterOperator;
  /** Text, number or `yyyy-mm-dd` date, as typed. */
  value: string;
  /** Upper end of `between`. */
  value2?: string;
}

export interface FilterGroup {
  type: "group";
  id: string;
  logic: FilterLogic;
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

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
const SELECT_OPERATORS: FilterOperator[] = ["equals", "notEquals", "isEmpty", "isNotEmpty"];

export type ValueKind = "text" | "number" | "date";

export function valueKindOf<T>(column: DataGridColumn<T>): ValueKind {
  const kind = filterKindOf(column);
  if (kind === "range") return "number";
  if (kind === "dateRange") return "date";
  return "text";
}

export function operatorsFor<T>(column: DataGridColumn<T>): FilterOperator[] {
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

export function newCondition<T>(column: DataGridColumn<T>): FilterCondition {
  return {
    type: "condition",
    id: newFilterId("c"),
    columnId: column.id,
    operator: operatorsFor(column)[0] ?? "contains",
    value: "",
  };
}

function isEmptyValue(value: CellValue): boolean {
  return value === null || value === undefined || value === "";
}

function compare(a: number, b: number): number {
  return a - b;
}

/** A condition counts once it has what its operator needs. */
export function isConditionActive(condition: FilterCondition): boolean {
  if (!operatorNeedsValue(condition.operator)) return true;
  if (condition.value.trim() === "") return false;
  if (condition.operator === "between") return (condition.value2 ?? "").trim() !== "";
  return true;
}

export function evaluateCondition<T>(
  row: T,
  condition: FilterCondition,
  columns: readonly DataGridColumn<T>[],
): boolean {
  const column = columns.find((c) => c.id === condition.columnId);
  if (!column) return true;
  const cell = getCellValue(row, column);
  const { operator } = condition;
  if (operator === "isEmpty") return isEmptyValue(cell);
  if (operator === "isNotEmpty") return !isEmptyValue(cell);

  const kind = valueKindOf(column);
  if (kind === "number") {
    const left = cellToNumber(cell);
    const right = Number.parseFloat(condition.value.replace(",", "."));
    if (left === null || !Number.isFinite(right)) return false;
    const upper = Number.parseFloat((condition.value2 ?? "").replace(",", "."));
    switch (operator) {
      case "equals":
        return compare(left, right) === 0;
      case "notEquals":
        return compare(left, right) !== 0;
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
      case "between":
        return (
          Number.isFinite(upper) && left >= Math.min(right, upper) && left <= Math.max(right, upper)
        );
      default:
        return false;
    }
  }
  if (kind === "date") {
    const time = cellToTime(cell);
    const start = isoDayBounds(condition.value, false);
    const end = isoDayBounds(condition.value, true);
    if (time === null || start === null || end === null) return false;
    switch (operator) {
      case "equals":
        return time >= start && time <= end;
      case "before":
        return time < start;
      case "after":
        return time > end;
      case "between": {
        const upper = isoDayBounds(condition.value2 ?? "", true);
        return upper !== null && time >= start && time <= upper;
      }
      default:
        return false;
    }
  }

  const text = normalizeText(formatCellValue(cell, column) || String(cell ?? ""));
  const needle = normalizeText(condition.value.trim());
  switch (operator) {
    case "contains":
      return text.includes(needle);
    case "notContains":
      return !text.includes(needle);
    case "equals":
      return text === needle;
    case "notEquals":
      return text !== needle;
    case "startsWith":
      return text.startsWith(needle);
    case "endsWith":
      return text.endsWith(needle);
    default:
      return false;
  }
}

/** Empty groups and incomplete conditions are ignored; a group with no active child matches all. */
export function isNodeActive(node: FilterNode): boolean {
  if (node.type === "condition") return isConditionActive(node);
  return node.children.some(isNodeActive);
}

export function evaluateNode<T>(
  row: T,
  node: FilterNode,
  columns: readonly DataGridColumn<T>[],
): boolean {
  if (node.type === "condition") {
    return isConditionActive(node) ? evaluateCondition(row, node, columns) : true;
  }
  const active = node.children.filter(isNodeActive);
  if (active.length === 0) return true;
  return node.logic === "and"
    ? active.every((child) => evaluateNode(row, child, columns))
    : active.some((child) => evaluateNode(row, child, columns));
}

export function applyAdvancedFilter<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  node: FilterGroup | undefined,
): T[] {
  if (!node || !isNodeActive(node)) return [...rows];
  return rows.filter((row) => evaluateNode(row, node, columns));
}

export function countConditions(node: FilterNode): number {
  if (node.type === "condition") return isConditionActive(node) ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countConditions(child), 0);
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

/** Readable summary, for example `(Barbero es Luis Y Total > 30)`. */
export function describeFilter<T>(
  node: FilterNode,
  columns: readonly DataGridColumn<T>[],
  words: { and: string; or: string; operators: Record<FilterOperator, string> },
): string {
  if (node.type === "condition") {
    if (!isConditionActive(node)) return "";
    const header = columns.find((c) => c.id === node.columnId)?.header ?? node.columnId;
    const value = operatorNeedsValue(node.operator)
      ? node.operator === "between"
        ? ` ${node.value} – ${node.value2 ?? ""}`
        : ` ${node.value}`
      : "";
    return `${header} ${words.operators[node.operator]}${value}`;
  }
  const parts = node.children.map((child) => describeFilter(child, columns, words)).filter(Boolean);
  if (parts.length === 0) return "";
  const text = parts.join(` ${node.logic === "and" ? words.and : words.or} `);
  return parts.length > 1 ? `(${text})` : text;
}
