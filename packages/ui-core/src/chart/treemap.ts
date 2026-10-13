/** Squarified treemap layout over a `buildHierarchy` tree. */
import { positive } from "../internal/positive.ts";
import type { HierarchyNode } from "./hierarchy.ts";

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
