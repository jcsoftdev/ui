import { seriesColor } from "../core/palette.js";
import type { TreeLayoutInput } from "../core/tree-layout.js";

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
  data: TreeChartDatum;
}

export interface TreeModel {
  root: TreeChartNode;
  /** Pre-order list of every node, hidden ones included. */
  nodes: TreeChartNode[];
  byId: Map<string, TreeChartNode>;
}

export function buildTreeModel(data: TreeChartDatum): TreeModel {
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
      data: item,
    };
    nodes.push(node);
    const seen = new Map<string, number>();
    node.children = (item.children ?? []).map((child, position) => {
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
