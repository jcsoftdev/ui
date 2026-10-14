// What only some charts, or only the moments after the first draw, need: folding leaf siblings into
// a group, the search, the tooltip rows and the data table. Lazy: loaded with the input chunk.
import type { PanZoomView } from "@jcsoftdev/ui-core/chart/pan-zoom";
import type { TreeDirection, TreeLayoutNode } from "@jcsoftdev/ui-core/chart/tree";
import { treeKeyMove, treeNeighbor } from "@jcsoftdev/ui-core/chart/tree-nav";
import type { NavIntent } from "../internal/chart-base.js";
import type { ChartSnapshot, TooltipRow } from "../internal/chart-protocol.js";
import type { TreeLabels } from "../internal/tree-labels.js";
import {
  MAX_DEPTH,
  subtreeSize,
  type TreeChartDatum,
  type TreeChartNode,
  type TreeModel,
} from "../internal/tree-model.js";

const KEYS: Record<string, string> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};
const DETAIL_LABELS = { category: "Name", subtitle: "Role", parent: "Reports to" };

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
  const visit = (item: TreeChartDatum, key: string, path: readonly object[]): TreeChartDatum => {
    const children = item.children ?? [];
    if (children.length === 0 || path.length >= MAX_DEPTH || path.includes(item)) return item;
    const leaves = children.filter((child) => !child.children?.length && !child.lazy);
    const isLeaf = new Set(leaves);
    const next = children.map((child) =>
      isLeaf.has(child) ? child : visit(child, child.id ?? child.name, [...path, item]),
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
    const kept = next.filter((child) => !isLeaf.has(child));
    return { ...item, children: [...kept, group] };
  };
  return visit(data, data.id ?? data.name, []);
}

/** Lower-case text without accents, for forgiving searches. */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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

/** The rows of a node's tooltip: role, level, parent and the size of what hangs below. */
export function tipRows(
  node: TreeChartNode,
  labels: Partial<TreeLabels> & Pick<TreeLabels, "level" | "children" | "descendants">,
): TooltipRow[] {
  const l = { ...DETAIL_LABELS, ...labels };
  const rows: TooltipRow[] = [];
  const row = (id: string, name: string, value: string) =>
    rows.push({ id, name, value, color: node.color });
  if (node.subtitle) row("role", l.subtitle, node.subtitle);
  row("level", l.level, `${node.depth + 1}`);
  if (node.parent) row("parent", l.parent, node.parent.name);
  if (node.children.length > 0) {
    row("children", l.children, `${node.children.length}`);
    row("descendants", l.descendants, `${subtreeSize(node)}`);
  }
  return rows;
}

/** The table, legend and export data of the tree: one row per node, hidden ones included. */
export function snapshotOf(
  model: TreeModel,
  labels: Partial<TreeLabels> & Pick<TreeLabels, "level" | "children" | "descendants">,
  title: string,
  color: string,
): ChartSnapshot {
  const l = { ...DETAIL_LABELS, ...labels };
  const all = model.nodes;
  const column = (id: string, name: string, values: Array<string | number>) => ({
    id,
    name,
    color,
    values,
    text: values.map(String),
  });
  return {
    title,
    categoryHeader: l.category,
    categories: all.map((node) => node.name),
    series: [
      column(
        "subtitle",
        l.subtitle,
        all.map((node) => node.subtitle ?? ""),
      ),
      column(
        "level",
        l.level,
        all.map((node) => node.depth + 1),
      ),
      column(
        "parent",
        l.parent,
        all.map((node) => node.parent?.name ?? ""),
      ),
      column(
        "children",
        l.children,
        all.map((node) => node.children.length),
      ),
      column(
        "descendants",
        l.descendants,
        all.map((node) => subtreeSize(node)),
      ),
    ],
    legend: [],
  };
}

/** The index of the card under (or nearest to, within `reach` px) the point `px, py` of the stage, or -1. */
export function nearestCard(
  poses: readonly TreeLayoutNode[],
  px: number,
  py: number,
  k: number,
  reach: number,
): number {
  let best = -1;
  let distance = reach;
  for (let i = 0; i < poses.length; i += 1) {
    const pose = poses[i] as TreeLayoutNode;
    const dx = Math.max(Math.abs(px - pose.x) - pose.width / 2, 0);
    const dy = Math.max(Math.abs(py - pose.y) - pose.height / 2, 0);
    const d = Math.hypot(dx, dy) * k;
    if (d === 0) return i;
    if (d < distance) {
      distance = d;
      best = i;
    }
  }
  return best;
}

/** The id of the node a keyboard `intent` leads to from node `i` of the laid-out `nodes`. */
export function navigate(
  nodes: readonly TreeLayoutNode[],
  i: number,
  intent: NavIntent,
  direction: TreeDirection,
  rtl: boolean,
  drilled: boolean,
): string | undefined {
  const current = nodes[i];
  if (!current) return undefined;
  if (intent === "home") return nodes[0]?.id;
  if (intent === "end") return nodes[nodes.length - 1]?.id;
  if (intent === "parent") return treeNeighbor(nodes, current.id, "parent");
  // Shift+Enter just expanded or collapsed this node: the children are about to change.
  if (intent === "child") return drilled ? undefined : treeNeighbor(nodes, current.id, "child");
  // The layout is not mirrored in right-to-left pages, so the base's swap is undone.
  const side = rtl
    ? (({ left: "right", right: "left" } as Record<string, string>)[intent] ?? intent)
    : intent;
  const move = treeKeyMove(KEYS[side] as string, direction);
  return move ? treeNeighbor(nodes, current.id, move) : undefined;
}

/** The view that brings `node` fully into a drawing of `size`, or `undefined` when it already is. */
export function reveal(
  node: TreeLayoutNode,
  view: PanZoomView,
  size: { width: number; height: number },
): PanZoomView | undefined {
  const margin = 12;
  const { k, x, y } = view;
  const left = x + (node.x - node.width / 2) * k;
  const right = x + (node.x + node.width / 2) * k;
  const top = y + (node.y - node.height / 2) * k;
  const bottom = y + (node.y + node.height / 2) * k;
  let dx = 0;
  let dy = 0;
  if (left < margin) dx = margin - left;
  else if (right > size.width - margin) dx = size.width - margin - right;
  if (top < margin) dy = margin - top;
  else if (bottom > size.height - margin) dy = size.height - margin - bottom;
  return dx || dy ? { k, x: x + dx, y: y + dy } : undefined;
}
