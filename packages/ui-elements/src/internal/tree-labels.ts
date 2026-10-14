import { subtreeSize, type TreeChartNode } from "./tree-model.js";

/** Visible strings of the tree chart. English defaults; override with `chart.labels = { ... }`. */
export interface TreeLabels {
  /** Description of the drawing: how the keyboard moves. */
  explore: string;
  /** Data table header of the node names. */
  category: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  /** Accessible name of the zoom toolbar. */
  controls: string;
  /** Hint under the drawing about wheel zoom. */
  zoomHint: string;
  /** Data table header and spoken text: the subtitle column (for example "Role"). */
  subtitle: string;
  level: string;
  /** Data table header: the parent node. */
  parent: string;
  /** Data table header and spoken text: number of children. */
  children: string;
  /** Spoken state of a node whose children are hidden. */
  collapsed: string;
  /** Spoken position among siblings, as in "2 of 4". */
  of: string;
  /** Search box name and placeholder. */
  search: string;
  searchPrevious: string;
  searchNext: string;
  noMatches: string;
  /** Word after the count in a group of leaves: "5 more". */
  groupWord: string;
  /** Data table header and spoken text: every node below. */
  descendants: string;
  /** Spoken when children could not be loaded. */
  loadFailed: string;
}

export const DEFAULT_TREE_LABELS: TreeLabels = {
  explore:
    "Tree. Arrow keys move between parent, children and siblings; Shift+Enter expands or collapses; plus and minus zoom; 0 fits the view.",
  category: "Name",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit to view",
  controls: "Zoom controls",
  zoomHint: "Drag to pan · Ctrl + wheel to zoom",
  subtitle: "Role",
  level: "Level",
  parent: "Reports to",
  children: "Direct reports",
  collapsed: "collapsed",
  of: "of",
  search: "Search",
  searchPrevious: "Previous match",
  searchNext: "Next match",
  noMatches: "No matches",
  groupWord: "more",
  descendants: "Total below",
  loadFailed: "Could not load. Try again.",
};

/** The spoken name of a node: name, role, badge, level, position among siblings and its reports. */
export function describeNode(
  node: TreeChartNode,
  collapsed: ReadonlySet<string>,
  labels: TreeLabels,
): string {
  const parts = [node.name];
  if (node.subtitle) parts.push(node.subtitle);
  if (node.badge) parts.push(node.badge);
  parts.push(`${labels.level} ${node.depth + 1}`);
  if (node.parent) parts.push(`${node.index + 1} ${labels.of} ${node.parent.children.length}`);
  if (node.children.length > 0) {
    const state = collapsed.has(node.id) ? `, ${labels.collapsed}` : "";
    parts.push(`${labels.children}: ${node.children.length}${state}`);
    parts.push(`${labels.descendants}: ${subtreeSize(node)}`);
  } else if (node.lazy) parts.push(labels.collapsed);
  return parts.join(". ");
}
