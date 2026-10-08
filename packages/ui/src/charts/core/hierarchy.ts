/**
 * Hierarchy model and layouts for treemap, sunburst and icicle charts.
 * Pure functions: no React, no DOM, so they are unit tested directly.
 */

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

function positive(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
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

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Width / height ratio, always >= 1. Infinite for degenerate rectangles. */
export function aspectRatio(rect: Rect): number {
  const width = rect.x1 - rect.x0;
  const height = rect.y1 - rect.y0;
  if (width <= 0 || height <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(width / height, height / width);
}

/** Worst aspect ratio of a row with `sum` area along a side of length `side`. */
function worstRatio(sum: number, min: number, max: number, side: number): number {
  const side2 = side * side;
  const sum2 = sum * sum;
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
}

/**
 * Squarified treemap: splits `rect` into one rectangle per value, areas
 * proportional to the values, keeping them as close to squares as possible.
 * Rows are laid along the shorter side and grow while the worst aspect ratio
 * of the row improves. Pass values largest first for the best result; the
 * output keeps the input order. Zero values get an empty rectangle.
 */
export function squarify(values: readonly number[], rect: Rect): Rect[] {
  const out: Rect[] = values.map(() => ({ x0: rect.x0, y0: rect.y0, x1: rect.x0, y1: rect.y0 }));
  let { x0, y0 } = rect;
  const { x1, y1 } = rect;
  const order = values.map((_, index) => index).filter((index) => positive(values[index]) > 0);
  let remaining = order.reduce((sum, index) => sum + (values[index] as number), 0);
  let cursor = 0;

  while (cursor < order.length) {
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0 || remaining <= 0) break;
    const scale = (width * height) / remaining;
    const side = Math.min(width, height);

    let end = cursor;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    let worst = Number.POSITIVE_INFINITY;
    while (end < order.length) {
      const area = (values[order[end] as number] as number) * scale;
      const nextSum = sum + area;
      const nextMin = Math.min(min, area);
      const nextMax = Math.max(max, area);
      const nextWorst = worstRatio(nextSum, nextMin, nextMax, side);
      if (end > cursor && nextWorst > worst) break;
      sum = nextSum;
      min = nextMin;
      max = nextMax;
      worst = nextWorst;
      end++;
    }

    const last = end === order.length;
    const thickness = last ? (width >= height ? width : height) : sum / side;
    let offset = 0;
    for (let k = cursor; k < end; k++) {
      const index = order[k] as number;
      const length =
        k === end - 1 ? side - offset : ((values[index] as number) * scale) / thickness;
      out[index] =
        width >= height
          ? { x0, y0: y0 + offset, x1: x0 + thickness, y1: y0 + offset + length }
          : { x0: x0 + offset, y0, x1: x0 + offset + length, y1: y0 + thickness };
      offset += length;
    }
    if (width >= height) x0 += thickness;
    else y0 += thickness;
    remaining -= sum / scale;
    cursor = end;
  }
  return out;
}

export interface TreemapCell extends Rect {
  node: HierarchyNode;
  /** Depth below the laid-out root, 1 for its children. */
  level: number;
  /** Drawn as a group: header band on top, children inside. */
  group: boolean;
}

export interface TreemapOptions {
  /** Levels to draw below the root. */
  maxDepth?: number;
  /** Gap between siblings, in pixels. */
  gap?: number;
  /** Inset of a group's children from its border. */
  padding?: number;
  /** Header band height of a group (its name). */
  headerHeight?: number;
  /** A group smaller than this (either side) is drawn as a single cell. */
  minGroupSize?: number;
}

function inset(rect: Rect, amount: number): Rect {
  const dx = Math.min(amount, (rect.x1 - rect.x0) / 2);
  const dy = Math.min(amount, (rect.y1 - rect.y0) / 2);
  return { x0: rect.x0 + dx, y0: rect.y0 + dy, x1: rect.x1 - dx, y1: rect.y1 - dy };
}

/**
 * Nested squarified layout of `root`'s subtree inside `rect`. Cells are
 * returned parents before children, so painting in order nests correctly.
 */
export function treemapLayout(
  root: HierarchyNode,
  rect: Rect,
  { maxDepth = 2, gap = 2, padding = 4, headerHeight = 22, minGroupSize = 64 }: TreemapOptions = {},
): TreemapCell[] {
  const cells: TreemapCell[] = [];
  function place(node: HierarchyNode, area: Rect, level: number): void {
    const rects = squarify(
      node.children.map((child) => child.value),
      area,
    );
    node.children.forEach((child, index) => {
      const cellRect = inset(rects[index] as Rect, gap / 2);
      const width = cellRect.x1 - cellRect.x0;
      const height = cellRect.y1 - cellRect.y0;
      if (width <= 0 || height <= 0) return;
      const group =
        child.children.length > 0 &&
        level < maxDepth &&
        width >= minGroupSize &&
        height >= minGroupSize;
      cells.push({ ...cellRect, node: child, level, group });
      if (group) {
        place(
          child,
          {
            x0: cellRect.x0 + padding,
            y0: cellRect.y0 + headerHeight,
            x1: cellRect.x1 - padding,
            y1: cellRect.y1 - padding,
          },
          level + 1,
        );
      }
    });
  }
  place(root, rect, 1);
  return cells;
}

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
