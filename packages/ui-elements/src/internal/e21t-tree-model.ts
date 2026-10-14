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

/**
 * Builds the node model. `loaded` holds children fetched lazily, keyed by the
 * node's path id; they take the place of an empty `children`.
 */
export function buildTreeModel(
  data: TreeChartDatum,
  loaded: ReadonlyMap<string, readonly TreeChartDatum[]> = new Map(),
): TreeModel {
  const nodes: TreeChartNode[] = [];
  const visit = (
    item: TreeChartDatum,
    parent: TreeChartNode | null,
    id: string,
    index: number,
  ): TreeChartNode => {
    const depth = parent ? parent.depth + 1 : 0;
    const node: TreeChartNode = {
      id,
      name: item.name,
      subtitle: item.subtitle,
      badge: item.badge,
      image: item.image,
      color:
        item.color ??
        (depth === 0 ? seriesColor(0) : depth === 1 ? seriesColor(index + 1) : parent?.color) ??
        seriesColor(0),
      depth,
      parent,
      children: [],
      index,
      lazy: false,
      group: !!item.group,
      data: item,
    };
    nodes.push(node);
    const seen = new Map<string, number>();
    const fetched = loaded.get(id);
    const own = item.children?.length ? item.children : fetched;
    node.lazy = !!item.lazy && !fetched && !item.children?.length;
    node.children = (own ?? []).map((child, position) => {
      const key = child.id ?? child.name;
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      return visit(child, node, `${id}/${count ? `${key}~${count}` : key}`, position);
    });
    return node;
  };
  const root = visit(data, null, data.id ?? "root", 0);
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
  const visit = (node: TreeChartNode): TreeLayoutInput => ({
    id: node.id,
    ...size(node),
    children: collapsed.has(node.id) ? [] : node.children.map(visit),
  });
  return visit(root);
}

/** Every node below `node`. */
export function subtreeSize(node: TreeChartNode): number {
  return node.children.reduce((sum, child) => sum + 1 + subtreeSize(child), 0);
}

/** "AR" for "Ana Rojas", "K" for "Kevin". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Folds runs of leaf siblings into one group node, so a manager with twenty
 * apprentices shows "20 apprentices" instead of twenty cards. A node is
 * grouped when it has at least `min` leaf children; the group starts collapsed
 * and expands to the original leaves. Nodes with other children keep them.
 */
export function groupLeaves(
  data: TreeChartDatum,
  min: number,
  label: (count: number) => string = (count) => `${count}`,
): TreeChartDatum {
  const visit = (item: TreeChartDatum, key: string): TreeChartDatum => {
    const children = item.children ?? [];
    if (children.length === 0) return item;
    const leaves = children.filter((child) => !child.children?.length && !child.lazy);
    const next = children.map((child) =>
      leaves.includes(child) ? child : visit(child, child.id ?? child.name),
    );
    if (leaves.length < min) return { ...item, children: next };
    const group: TreeChartDatum = {
      id: `${key}~leaves`,
      name: label(leaves.length),
      subtitle: leaves
        .slice(0, 3)
        .map((leaf) => leaf.name)
        .join(", "),
      group: true,
      collapsed: true,
      children: leaves,
    };
    const kept = next.filter((child) => !leaves.includes(child));
    return { ...item, children: [...kept, group] };
  };
  return visit(data, data.id ?? data.name);
}

/** Lower-case text without accents, for forgiving searches. */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Nodes whose name, subtitle or badge contains every word of `query`, in
 * pre-order (document order). An empty query matches nothing.
 */
export function searchTree(model: TreeModel, query: string): TreeChartNode[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return model.nodes.filter((node) => {
    const haystack = foldText([node.name, node.subtitle, node.badge].filter(Boolean).join(" "));
    return words.every((word) => haystack.includes(word));
  });
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
