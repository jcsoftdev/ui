"use client";

import { ChartBreadcrumb } from "./breadcrumb.js";
import { ChartDataTable } from "./data-table.js";
import type { ValueFormatter } from "./format.js";
import { descendants, type HierarchyNode } from "./hierarchy.js";
import { ChartLegend } from "./legend.js";
import { seriesColor } from "./palette.js";
import type { TooltipRow } from "./tooltip.js";
import { type ChartLabels, DEFAULT_LABELS } from "./types.js";

/** Visible strings of the hierarchy charts (treemap, sunburst, icicle). */
export interface HierarchyLabels extends ChartLabels {
  /** Accessible name of the drill-down path. */
  breadcrumb: string;
  /** Tooltip row: share of the focused node. */
  share: string;
  /** Hint shown in the tooltip of a node that can be opened. */
  drillHint: string;
}

export const DEFAULT_HIERARCHY_LABELS: HierarchyLabels = {
  ...DEFAULT_LABELS,
  explore: "Chart segments. Use the arrow keys to move, Enter to open, Escape to go back.",
  category: "Segment",
  breadcrumb: "Drill-down path",
  share: "Share",
  drillHint: "Click to open",
};

export function resolveHierarchyLabels(labels?: Partial<HierarchyLabels>): HierarchyLabels {
  return labels ? { ...DEFAULT_HIERARCHY_LABELS, ...labels } : DEFAULT_HIERARCHY_LABELS;
}

/**
 * Base color of a node: its own `color`, otherwise the palette slot of the
 * branch it belongs to below `focus`, so the open level always shows several hues.
 */
export function branchColor(node: HierarchyNode, focus: HierarchyNode): string {
  if (node.color) return node.color;
  let branch: HierarchyNode = node;
  while (branch.parent && branch.parent.id !== focus.id) branch = branch.parent;
  return seriesColor(branch.parent ? branch.index : 0);
}

/** "Miraflores › Kevin" relative to `from` (excluded). */
export function nodePath(node: HierarchyNode, from?: HierarchyNode): string {
  const names: string[] = [];
  for (
    let current: HierarchyNode | null = node;
    current && current !== from;
    current = current.parent
  ) {
    names.unshift(current.name);
  }
  return names.join(" › ");
}

/**
 * Strength (0-100) of the branch hue for a partition cell (sunburst ring or
 * icicle band): strong next to the open node, lighter further out, with a small
 * spread between siblings so neighbours stay distinguishable.
 */
export function levelStrength(node: HierarchyNode, focus: HierarchyNode): number {
  const level = Math.max(1, node.depth - focus.depth);
  const siblings = node.parent?.children.length ?? 1;
  const spread = siblings > 1 ? node.index / (siblings - 1) : 0;
  return Math.max(26, 86 - (level - 1) * 24 - spread * 10);
}

/**
 * Label that fits in `maxWidth`: the full text, a shortened one with an
 * ellipsis, or `null` when not even four characters fit.
 */
export function fitLabel(text: string, maxWidth: number, fontSize = 12): string | null {
  const charWidth = fontSize * 0.58;
  if (text.length * charWidth <= maxWidth) return text;
  const chars = Math.floor(maxWidth / charWidth) - 1;
  return chars >= 4 ? `${text.slice(0, chars).trimEnd()}…` : null;
}

export function shareOf(node: HierarchyNode, of: HierarchyNode): number {
  return of.value > 0 ? node.value / of.value : 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

/** Spoken summary of a node for the live region and `aria-valuetext`. */
export function describeNode(
  node: HierarchyNode,
  focus: HierarchyNode,
  format: ValueFormatter,
): string {
  return `${nodePath(node, focus)}: ${format(node.value)} (${percent(shareOf(node, focus))})`;
}

export function nodeTooltipRows(
  node: HierarchyNode,
  focus: HierarchyNode,
  format: ValueFormatter,
  labels: HierarchyLabels,
  color: string,
): TooltipRow[] {
  const rows: TooltipRow[] = [
    { id: "value", name: node.name, value: format(node.value), color },
    {
      id: "share",
      name: `${labels.share} · ${focus.name}`,
      value: percent(shareOf(node, focus)),
      color: "transparent",
    },
  ];
  if (node.children.length > 0) {
    rows.push({
      id: "hint",
      name: labels.drillHint,
      value: `${node.children.length}`,
      color: "transparent",
      emphasis: true,
    });
  }
  return rows;
}

/**
 * Class for the `ChartFrame` of a hierarchy chart: makes it a size container
 * (`@container/chart`) so the header and legend below can react to its width.
 */
export const HIERARCHY_FRAME_CLASS = "@container/chart";

export interface HierarchyHeaderProps {
  path: readonly HierarchyNode[];
  onSelect: (id: string) => void;
  labels: HierarchyLabels;
}

/**
 * Drill-down path, pass it as the frame `legend`. Always first in the frame,
 * even when the legend moves above the drawing.
 */
export function HierarchyHeader({ path, onSelect, labels }: HierarchyHeaderProps) {
  return (
    <ChartBreadcrumb
      className="-order-2"
      items={path.map((node) => ({ id: node.id, name: node.name }))}
      onSelect={onSelect}
      label={labels.breadcrumb}
    />
  );
}

export interface HierarchyLegendProps {
  focus: HierarchyNode;
  /** Most items listed. */
  limit?: number;
}

/**
 * Read-only legend of the open level's branches, pass it as the frame
 * `footer`: below the drawing in narrow containers, above it from `@md`.
 */
export function HierarchyLegend({ focus, limit = 8 }: HierarchyLegendProps) {
  if (focus.children.length === 0) return null;
  return (
    <ChartLegend
      className="@md/chart:-order-1"
      items={focus.children.slice(0, limit).map((child) => ({
        id: child.id,
        name: child.name,
        color: branchColor(child, focus),
      }))}
    />
  );
}

export interface HierarchyTableProps {
  root: HierarchyNode;
  caption: string;
  format: ValueFormatter;
  labels: HierarchyLabels;
}

/** Hidden table: every node below the root with its value and share of the total. */
export function HierarchyTable({ root, caption, format, labels }: HierarchyTableProps) {
  const nodes = descendants(root).slice(1);
  return (
    <ChartDataTable
      caption={caption}
      categoryHeader={labels.category}
      categories={nodes.map((node) => nodePath(node, root))}
      columns={[
        { id: "value", name: root.name, values: nodes.map((node) => format(node.value)) },
        {
          id: "share",
          name: labels.share,
          values: nodes.map((node) => percent(shareOf(node, root))),
        },
      ]}
    />
  );
}

/**
 * Keyboard handling shared by the hierarchy charts: arrows move between the
 * children of the focused node, Enter opens the active one, Escape goes up.
 * Returns the next active index, or `undefined` when the key is not handled.
 */
export function hierarchyKey(
  key: string,
  active: number | null,
  count: number,
): "drill" | "up" | number | undefined {
  if (count === 0) return key === "Escape" ? "up" : undefined;
  const current = active ?? -1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "Enter":
    case " ":
      return "drill";
    case "Escape":
      return "up";
    default:
      return undefined;
  }
}
