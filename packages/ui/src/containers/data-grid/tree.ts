// Tree data: a flat list of rows linked by a parent id, flattened for display with aggregates.
import { computeAggregates } from "./model.js";
import type { DataDisplayRow, DataGridColumn, DisplayRow } from "./types.js";

export interface TreeOptions<T> {
  getKey: (row: T) => string;
  /** Key of the parent row; nullish for roots. Unknown parents make the row a root. */
  getParentId: (row: T) => string | null | undefined;
}

/**
 * Keeps `matches` plus every ancestor of a match, in the order of `all`, so a filtered tree
 * still shows the path to each hit.
 */
export function withAncestors<T>(
  all: readonly T[],
  matches: readonly T[],
  options: TreeOptions<T>,
): T[] {
  const byKey = new Map(all.map((row) => [options.getKey(row), row]));
  const keep = new Set<string>();
  for (const row of matches) {
    let current: T | undefined = row;
    while (current) {
      const key = options.getKey(current);
      if (keep.has(key)) break;
      keep.add(key);
      const parent = options.getParentId(current);
      current = parent === null || parent === undefined ? undefined : byKey.get(parent);
    }
  }
  return all.filter((row) => keep.has(options.getKey(row)));
}

export interface TreeResult<T> {
  rows: DisplayRow<T>[];
  /** Rows without children: what the footer totals aggregate. */
  leaves: T[];
}

/**
 * Depth-first flattening. Children keep the order of `rows` (sort before calling). A collapsed
 * node hides its subtree unless `forceExpand` is on. Parents carry the aggregates of every leaf
 * below them. Cycles are cut where they close.
 */
export function buildTreeRows<T>(
  rows: readonly T[],
  columns: readonly DataGridColumn<T>[],
  options: TreeOptions<T> & { expanded: ReadonlySet<string>; forceExpand?: boolean },
): TreeResult<T> {
  const { getKey, getParentId, expanded, forceExpand = false } = options;
  const keys = new Set(rows.map(getKey));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const row of rows) {
    const parent = getParentId(row);
    if (parent === null || parent === undefined || !keys.has(parent) || parent === getKey(row)) {
      roots.push(row);
    } else {
      const list = children.get(parent);
      if (list) list.push(row);
      else children.set(parent, [row]);
    }
  }

  const out: DisplayRow<T>[] = [];
  const leaves: T[] = [];
  const visited = new Set<string>();

  const walk = (row: T, depth: number): T[] => {
    const key = getKey(row);
    visited.add(key);
    const kids = (children.get(key) ?? []).filter((child) => !visited.has(getKey(child)));
    const isExpanded = forceExpand || expanded.has(key);
    const entry: DataDisplayRow<T> = {
      kind: "data",
      key,
      depth,
      row,
      tree: { hasChildren: kids.length > 0, expanded: isExpanded, aggregates: {} },
    };
    out.push(entry);
    if (kids.length === 0) {
      leaves.push(row);
      return [row];
    }
    const below: T[] = [];
    const mark = out.length;
    for (const child of kids) below.push(...walk(child, depth + 1));
    if (entry.tree) entry.tree.aggregates = computeAggregates(below, columns);
    if (!isExpanded) out.length = mark;
    return below;
  };

  for (const root of roots) walk(root, 0);
  return { rows: out, leaves };
}
