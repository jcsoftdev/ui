// Port of the React kit's tree-chart/tree-model.ts, kept in step with it by test/tree-chart-model.test.ts.
import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import type { TreeLayoutInput } from "@jcsoftdev/ui-core/chart/tree";

/** One person (or unit) of the tree. */
export interface TreeChartDatum {
  /** Stable key among siblings; defaults to `name`. */
  id?: string;
  name: string;
  /** Second line of the default card, e.g. the role. */
  subtitle?: string;
  /** Short pill on the default card, e.g. a branch or a count. */
  badge?: string;
  /** Avatar image URL; initials are shown without it. */
  image?: string;
  /** CSS color of this node and its subtree; defaults to a palette slot per top-level branch. */
  color?: string;
  /** Start with this node's children hidden. */
  collapsed?: boolean;
  /** Children are fetched on first expand through the chart's `loadChildren`. */
  lazy?: boolean;
  /** Known number of children of a `lazy` node, shown on its toggle before they load. */
  childCount?: number;
  /** A synthetic node standing for several leaves (see `groupLeaves`). */
  group?: boolean;
  children?: readonly TreeChartDatum[];
}

export interface TreeChartNode {
  /** Unique path id, e.g. `root/miraflores/kevin`. */
  id: string;
  name: string;
  subtitle?: string;
  badge?: string;
  image?: string;
  /** Resolved color (own, inherited or the branch palette slot). */
  color: string;
  /** 0 for the root. */
  depth: number;
  parent: TreeChartNode | null;
  children: TreeChartNode[];
  /** Rank among its siblings. */
  index: number;
  /** Children not loaded yet. */
  lazy: boolean;
  /** Stands for a group of leaves. */
  group: boolean;
  data: TreeChartDatum;
}

export interface TreeModel {
  root: TreeChartNode;
  /** Pre-order list of every node, hidden ones included. */
  nodes: TreeChartNode[];
  byId: Map<string, TreeChartNode>;
}

/** Deepest level that is built; deeper nodes are dropped (a guard against runaway or cyclic data). */
export const MAX_DEPTH = 128;

const COLOR =
  /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([^;{}<>"'\\@]*\))$/i;
const UNSAFE = /url|expression|image|attr|env|\/\*/i;

/** `value` when it is plain CSS color syntax (hex, name, color function, token), else `undefined`. */
export function safeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim();
  return COLOR.test(color) && !UNSAFE.test(color) ? color : undefined;
}

const text = (value: unknown): string | undefined => (value == null ? undefined : String(value));

/**
 * Builds the node model. `loaded` holds children fetched lazily, keyed by the
 * node's path id; they take the place of an empty `children`. The walk is
 * iterative, stops at `MAX_DEPTH` and skips a child that is its own ancestor.
 */
export function buildTreeModel(
  data: TreeChartDatum,
  loaded: ReadonlyMap<string, readonly TreeChartDatum[]> = new Map(),
): TreeModel {
  const nodes: TreeChartNode[] = [];
  type Frame = { item: TreeChartDatum; parent: TreeChartNode | null; id: string; index: number };
  const stack: Frame[] = [{ item: data, parent: null, id: text(data.id) ?? "root", index: 0 }];
  for (let frame = stack.pop(); frame; frame = stack.pop()) {
    const { item, parent, id, index } = frame;
    const depth = parent ? parent.depth + 1 : 0;
    const fetched = loaded.get(id);
    const own = item.children?.length ? item.children : fetched;
    const node: TreeChartNode = {
      id,
      name: text(item.name) ?? "",
      subtitle: text(item.subtitle),
      badge: text(item.badge),
      image: item.image,
      color:
        safeColor(item.color) ??
        (depth === 0 ? seriesColor(0) : depth === 1 ? seriesColor(index + 1) : parent?.color) ??
        seriesColor(0),
      depth,
      parent,
      children: [],
      index,
      lazy: !!item.lazy && !fetched && !item.children?.length,
      group: !!item.group,
      data: item,
    };
    nodes.push(node);
    parent?.children.push(node);
    if (depth >= MAX_DEPTH) continue;
    const seen = new Map<string, number>();
    const next: Frame[] = [];
    for (const child of own ?? []) {
      if (!child || typeof child !== "object") continue;
      let cycle = false;
      for (let up: TreeChartNode | null = node; up && !cycle; up = up.parent)
        cycle = up.data === child;
      if (cycle) continue;
      const key = text(child.id) ?? text(child.name) ?? "";
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      next.push({
        item: child,
        parent: node,
        id: `${id}/${count ? `${key}~${count}` : key}`,
        index: next.length,
      });
    }
    for (let i = next.length - 1; i >= 0; i -= 1) stack.push(next[i] as Frame);
  }
  const root = nodes[0] as TreeChartNode;
  return { root, nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
}

/** Ids collapsed at first: nodes flagged `collapsed`, and every node at `initialDepth`. */
export function initialCollapsed(model: TreeModel, initialDepth: number): Set<string> {
  const collapsed = new Set<string>();
  for (const node of model.nodes) {
    if (node.children.length === 0) continue;
    if (node.data.collapsed || node.depth >= initialDepth) collapsed.add(node.id);
  }
  return collapsed;
}

/** The part of the tree that is visible, as layout input. */
export function visibleTree(
  root: TreeChartNode,
  collapsed: ReadonlySet<string>,
  size: (node: TreeChartNode) => { width: number; height: number },
): TreeLayoutInput {
  type Input = TreeLayoutInput & { children: TreeLayoutInput[] };
  const input = (node: TreeChartNode): Input => ({ id: node.id, ...size(node), children: [] });
  const top = input(root);
  const stack: Array<[TreeChartNode, Input]> = [[root, top]];
  for (let item = stack.pop(); item; item = stack.pop()) {
    const [node, at] = item;
    if (collapsed.has(node.id)) continue;
    for (const child of node.children) {
      const next = input(child);
      at.children.push(next);
      stack.push([child, next]);
    }
  }
  return top;
}

/** Every node below `node`. */
export function subtreeSize(node: TreeChartNode): number {
  let count = 0;
  const stack = [node];
  for (let at = stack.pop(); at; at = stack.pop())
    for (const child of at.children) {
      count += 1;
      stack.push(child);
    }
  return count;
}

/** "AR" for "Ana Rojas", "K" for "Kevin". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** Ids of the ancestors of `node`, root first (the node itself excluded). */
export function ancestorIds(node: TreeChartNode): string[] {
  const ids: string[] = [];
  for (let parent = node.parent; parent; parent = parent.parent) ids.unshift(parent.id);
  return ids;
}

/** Edge color rule: `depth` colors by level, `branch` by top-level branch, `neutral` is the line token. */
export type TreeEdgeColor = "neutral" | "depth" | "branch";

/** Color of the edge that enters `node`. */
export function edgeColorOf(node: TreeChartNode, mode: TreeEdgeColor): string {
  if (mode === "branch") return node.color;
  if (mode === "depth") return seriesColor(Math.max(0, node.depth - 1));
  return "var(--line-strong)";
}
