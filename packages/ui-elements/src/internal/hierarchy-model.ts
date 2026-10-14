/**
 * Pure helpers shared by the hierarchy charts (sunburst, treemap, icicle, hierarchy morph): colors
 * by branch, spoken text, tooltip rows, label fitting and keyboard navigation over the visible
 * nodes. No DOM: golden-tested against the React kit's `core/hierarchy-chart`.
 */
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import type { NavIntent } from "./chart-base.js";
import type { TooltipRow } from "./chart-protocol.js";

/** Visible strings of the hierarchy charts. English defaults; override with `chart.labels`. */
export interface HierarchyStrings {
  /** Header of the segment column in the data table. */
  category: string;
  /** Accessible name of the drill-down path. */
  breadcrumb: string;
  /** Tooltip row: share of the open node. */
  share: string;
  /** Hint in the details of a node that can be opened. */
  drillHint: string;
}

export const HIERARCHY_STRINGS: HierarchyStrings = {
  category: "Segment",
  breadcrumb: "Drill-down path",
  share: "Share",
  drillHint: "Double-click or press Shift+Enter to open",
};

/**
 * Base color of a node: its own `color`, otherwise the palette slot of the branch it belongs to
 * below `focus`, so the open level always shows several hues.
 */
export function branchColor(
  node: HierarchyNode,
  focus: HierarchyNode,
  color: (index: number) => string,
): string {
  if (node.color) return node.color;
  let branch: HierarchyNode = node;
  while (branch.parent && branch.parent.id !== focus.id) branch = branch.parent;
  return color(branch.parent ? branch.index : 0);
}

/** "Miraflores › Kevin" relative to `from` (excluded). */
export function nodePath(node: HierarchyNode, from?: HierarchyNode): string {
  const names: string[] = [];
  for (
    let current: HierarchyNode | null = node;
    current && current !== from;
    current = current.parent
  )
    names.unshift(current.name);
  return names.join(" › ");
}

/**
 * Strength (0-100) of the branch hue for a partition cell (sunburst ring or icicle band): strong
 * next to the open node, lighter further out, with a small spread between siblings.
 */
export function levelStrength(node: HierarchyNode, focus: HierarchyNode): number {
  const level = Math.max(1, node.depth - focus.depth);
  const siblings = node.parent?.children.length ?? 1;
  const spread = siblings > 1 ? node.index / (siblings - 1) : 0;
  return Math.max(26, 86 - (level - 1) * 24 - spread * 10);
}

export const shareOf = (node: HierarchyNode, of: HierarchyNode): number =>
  of.value > 0 ? node.value / of.value : 0;

export const percent = (value: number): string => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;

/** Spoken summary of a node: "Miraflores › Kevin: 1,200 (32%)". */
export function describeNode(
  node: HierarchyNode,
  focus: HierarchyNode,
  format: (value: number) => string,
): string {
  return `${nodePath(node, focus)}: ${format(node.value)} (${percent(shareOf(node, focus))})`;
}

export function nodeTooltipRows(
  node: HierarchyNode,
  focus: HierarchyNode,
  format: (value: number) => string,
  strings: HierarchyStrings,
  color: string,
): TooltipRow[] {
  const rows: TooltipRow[] = [
    { id: "value", name: node.name, value: format(node.value), color },
    {
      id: "share",
      name: `${strings.share} · ${focus.name}`,
      value: percent(shareOf(node, focus)),
      color: "transparent",
    },
  ];
  if (node.children.length > 0)
    rows.push({
      id: "hint",
      name: strings.drillHint,
      value: `${node.children.length}`,
      color: "transparent",
      emphasis: true,
    });
  return rows;
}

/** Which arrow keys mean what for a layout (a sunburst walks outward with Down, an icicle across with Right...). */
export interface NavKeys {
  child: readonly NavIntent[];
  parent: readonly NavIntent[];
  next: readonly NavIntent[];
  previous: readonly NavIntent[];
}
/** Down goes to the first child, Up to the parent, Right and Left across siblings. */
export const NAV_DOWN: NavKeys = {
  child: ["down", "child"],
  parent: ["up", "parent"],
  next: ["right"],
  previous: ["left"],
};
/** Right goes to the first child, Left to the parent, Down and Up across siblings. */
export const NAV_RIGHT: NavKeys = {
  child: ["right", "child"],
  parent: ["left", "parent"],
  next: ["down"],
  previous: ["up"],
};

/**
 * Hierarchical keyboard move over the visible nodes: `nodes[i]` is mark `i`. Returns the mark to
 * go to, `undefined` to stay, and calls `out()` when `parent` leaves the open node (the caller
 * zooms out). Siblings stop at the ends, `home`/`end` jump to the first/last sibling.
 */
export function hierarchyNav(
  nodes: readonly HierarchyNode[],
  focus: HierarchyNode,
  keys: NavKeys,
  index: number,
  intent: NavIntent,
  out: () => void,
): number | undefined {
  const node = nodes[index];
  if (!node) return undefined;
  const at = new Map<string, number>();
  nodes.forEach((n, i) => {
    at.set(n.id, i);
  });
  const shown = (list: readonly HierarchyNode[]) => list.filter((n) => at.has(n.id));
  const siblings = shown(node.parent?.children ?? [node]);
  const position = siblings.indexOf(node);
  const target = (n: HierarchyNode | undefined) => (n ? at.get(n.id) : undefined);
  if (keys.child.includes(intent)) return target(shown(node.children)[0]);
  if (keys.parent.includes(intent)) {
    const parent = node.parent;
    if (parent && at.has(parent.id)) return target(parent);
    if (parent === focus && focus.parent) out();
    return undefined;
  }
  if (keys.next.includes(intent)) return target(siblings[position + 1]);
  if (keys.previous.includes(intent)) return target(siblings[position - 1]);
  if (intent === "home") return target(siblings[0]);
  if (intent === "end") return target(siblings[siblings.length - 1]);
  return undefined;
}

/** Node ids from `node` up to the root: the path that stays lit while one of them is hovered. */
export function litPath(node: HierarchyNode): Set<string> {
  const ids = new Set<string>();
  for (let current: HierarchyNode | null = node; current; current = current.parent)
    ids.add(current.id);
  return ids;
}
