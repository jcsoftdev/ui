// What only some charts, or only the moments after the first draw, need: folding leaf siblings into
// a group, the search, the tooltip rows and the data table. Lazy: loaded with the input chunk.
import type { ChartSnapshot, TooltipRow } from "../internal/chart-protocol.js";
import type { TreeLabels } from "../internal/tree-labels.js";
import {
  MAX_DEPTH,
  subtreeSize,
  type TreeChartDatum,
  type TreeChartNode,
  type TreeModel,
} from "../internal/tree-model.js";

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
