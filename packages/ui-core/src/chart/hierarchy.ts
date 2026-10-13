/**
 * Hierarchy model for treemap, sunburst, icicle and tree charts: nodes with summed values,
 * and the traversals. Pure functions: no React, no DOM.
 */

import { positive } from "../internal/positive.ts";

/** Input tree. Leaves carry `value`; a parent's value is the sum of its children. */
export interface HierarchyDatum {
  /** Stable key among siblings; defaults to `name`. */
  id?: string;
  name: string;
  value?: number;
  /** CSS color for this branch, e.g. `var(--chart-cat-2)`. */
  color?: string;
  children?: readonly HierarchyDatum[];
}

export interface HierarchyNode {
  /** Unique path id, e.g. `root/miraflores/kevin`. */
  id: string;
  name: string;
  /** Leaf value, or the sum of the children. */
  value: number;
  /** 0 for the root. */
  depth: number;
  parent: HierarchyNode | null;
  /** Positive-value children, largest first when sorted. */
  children: HierarchyNode[];
  /** Position of the top-level branch (depth 1) this node belongs to; -1 for the root. */
  branch: number;
  /** Rank among its siblings, 0 = first. */
  index: number;
  /** Own color, or the closest ancestor's. */
  color?: string;
  data: HierarchyDatum;
}

export interface BuildHierarchyOptions {
  /** Largest first (default). `false` keeps the data order. */
  sort?: boolean;
}

/**
 * Turns nested data into linked nodes with summed values. Zero, negative and
 * non-finite branches are dropped, since they have no area to draw.
 */
export function buildHierarchy(
  datum: HierarchyDatum,
  { sort = true }: BuildHierarchyOptions = {},
): HierarchyNode {
  function visit(
    item: HierarchyDatum,
    parent: HierarchyNode | null,
    id: string,
    index: number,
  ): HierarchyNode {
    const node: HierarchyNode = {
      id,
      name: item.name,
      value: 0,
      depth: parent ? parent.depth + 1 : 0,
      parent,
      children: [],
      branch: parent ? (parent.depth === 0 ? index : parent.branch) : -1,
      index,
      color: item.color ?? parent?.color,
      data: item,
    };
    if (item.children && item.children.length > 0) {
      const seen = new Map<string, number>();
      const children = item.children.map((child, position) => {
        const key = child.id ?? child.name;
        const count = seen.get(key) ?? 0;
        seen.set(key, count + 1);
        return visit(child, node, `${id}/${count ? `${key}~${count}` : key}`, position);
      });
      const kept = children.filter((child) => child.value > 0);
      if (sort) kept.sort((a, b) => b.value - a.value);
      kept.forEach((child, rank) => {
        child.index = rank;
        if (node.depth === 0) reassignBranch(child, rank);
      });
      node.children = kept;
      node.value = kept.reduce((sum, child) => sum + child.value, 0);
    } else {
      node.value = positive(item.value);
    }
    return node;
  }
  return visit(datum, null, datum.id ?? "root", 0);
}

function reassignBranch(node: HierarchyNode, branch: number): void {
  node.branch = branch;
  for (const child of node.children) reassignBranch(child, branch);
}

/** Root first, `node` last. */
export function ancestors(node: HierarchyNode): HierarchyNode[] {
  const path: HierarchyNode[] = [];
  for (let current: HierarchyNode | null = node; current; current = current.parent) {
    path.unshift(current);
  }
  return path;
}

/** Pre-order list: `node`, then its subtree. */
export function descendants(node: HierarchyNode): HierarchyNode[] {
  const out: HierarchyNode[] = [];
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop() as HierarchyNode;
    out.push(current);
    for (let i = current.children.length - 1; i >= 0; i--) {
      stack.push(current.children[i] as HierarchyNode);
    }
  }
  return out;
}

export function findNode(root: HierarchyNode, id: string): HierarchyNode | null {
  return descendants(root).find((node) => node.id === id) ?? null;
}

/** Number of levels below `node` (0 for a leaf). */
export function heightOf(node: HierarchyNode): number {
  let height = 0;
  for (const child of node.children) height = Math.max(height, heightOf(child) + 1);
  return height;
}
