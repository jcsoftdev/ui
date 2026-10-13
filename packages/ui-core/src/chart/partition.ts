/** Adjacency partition (sunburst and icicle) and sector paths. */
import type { HierarchyNode } from "./hierarchy.ts";

export interface PartitionSpan {
  /** Start and end of the node along the partitioned axis, 0-1 of the root. */
  x0: number;
  x1: number;
}

/**
 * Adjacency partition: every node gets a slice of its parent's span
 * proportional to its value. The root spans [0, 1]. Depth is the other axis
 * (rings in a sunburst, bands in an icicle).
 */
export function partitionLayout(root: HierarchyNode): Map<string, PartitionSpan> {
  const spans = new Map<string, PartitionSpan>();
  function visit(node: HierarchyNode, x0: number, x1: number): void {
    spans.set(node.id, { x0, x1 });
    let start = x0;
    const total = node.value || 1;
    node.children.forEach((child, index) => {
      const end =
        index === node.children.length - 1 ? x1 : start + ((x1 - x0) * child.value) / total;
      visit(child, start, end);
      start = end;
    });
  }
  visit(root, 0, 1);
  return spans;
}

/** The focused window of a partition: which span fills the view and at which depth it sits. */
export interface PartitionView {
  x0: number;
  x1: number;
  depth: number;
}

/** Position of a span inside a view: x in 0-1 of the view (may fall outside), level relative to it. */
export function projectSpan(
  span: PartitionSpan,
  depth: number,
  view: PartitionView,
): { x0: number; x1: number; level: number } {
  const width = view.x1 - view.x0 || 1;
  return {
    x0: (span.x0 - view.x0) / width,
    x1: (span.x1 - view.x0) / width,
    level: depth - view.depth,
  };
}

export function interpolateView(from: PartitionView, to: PartitionView, t: number): PartitionView {
  return {
    x0: from.x0 + (to.x0 - from.x0) * t,
    x1: from.x1 + (to.x1 - from.x1) * t,
    depth: from.depth + (to.depth - from.depth) * t,
  };
}

const TAU = Math.PI * 2;

/**
 * Annular sector ("donut slice") path. Angles in radians, 0 at twelve
 * o'clock, clockwise. `padAngle` trims both ends; a full turn draws a ring.
 */
export function sectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  padAngle = 0,
): string {
  const r0 = Math.max(0, innerRadius);
  const r1 = Math.max(r0, outerRadius);
  const span = endAngle - startAngle;
  if (r1 <= 0 || span <= 0) return "";
  const point = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
  if (span >= TAU - 1e-6) {
    const outer = `M${point(r1, 0)}A${r1},${r1} 0 1 1 ${point(r1, Math.PI)}A${r1},${r1} 0 1 1 ${point(r1, 0)}Z`;
    if (r0 <= 0) return outer;
    return `${outer}M${point(r0, 0)}A${r0},${r0} 0 1 0 ${point(r0, Math.PI)}A${r0},${r0} 0 1 0 ${point(r0, 0)}Z`;
  }
  const pad = Math.min(padAngle, span * 0.4) / 2;
  const a0 = startAngle + pad;
  const a1 = endAngle - pad;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `M${point(r1, a0)}A${r1},${r1} 0 ${large} 1 ${point(r1, a1)}`;
  if (r0 <= 0) return `${outer}L${point(0, 0)}Z`;
  return `${outer}L${point(r0, a1)}A${r0},${r0} 0 ${large} 0 ${point(r0, a0)}Z`;
}
