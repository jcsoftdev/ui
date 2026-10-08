/**
 * Alternative tree layouts: radial (depth = distance from the centre) and
 * dendrogram (every leaf on the last level). Pure functions that return the
 * same `TreeLayout` as `treeLayout`, so the chart draws them with the same
 * boxes, transitions and edge paths.
 */

import type {
  TreeDirection,
  TreeEdgeStyle,
  TreeLayout,
  TreeLayoutInput,
  TreeLayoutNode,
  TreeLayoutOptions,
} from "./tree-layout.js";

const TAU = Math.PI * 2;

export interface RadialLayoutOptions {
  /** Minimum distance between rings (centre to centre). */
  levelGap?: number;
  /** Minimum gap between neighbouring boxes on one ring. */
  siblingGap?: number;
  /** Angle where the first leaf starts, radians, 0 at twelve o'clock clockwise. */
  startAngle?: number;
  /** Angular span in radians; a full circle by default. */
  sweep?: number;
}

interface Walk {
  input: TreeLayoutInput;
  depth: number;
  parentId: string | null;
  children: Walk[];
  /** Index range of the leaves below (inclusive). */
  lo: number;
  hi: number;
}

function walk(input: TreeLayoutInput, depth: number, parentId: string | null): Walk {
  return {
    input,
    depth,
    parentId,
    children: (input.children ?? []).map((child) => walk(child, depth + 1, input.id)),
    lo: 0,
    hi: 0,
  };
}

function flatten(root: Walk): Walk[] {
  const out: Walk[] = [];
  const visit = (node: Walk) => {
    out.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return out;
}

/** Assigns every node the range of leaf slots it spans; returns the leaf count. */
function spanLeaves(root: Walk): number {
  let next = 0;
  const visit = (node: Walk) => {
    if (node.children.length === 0) {
      node.lo = next;
      node.hi = next;
      next += 1;
      return;
    }
    for (const child of node.children) visit(child);
    node.lo = (node.children[0] as Walk).lo;
    node.hi = (node.children[node.children.length - 1] as Walk).hi;
  };
  visit(root);
  return next;
}

/** Point at `angle` (0 at twelve o'clock, clockwise) and `radius` around (0, 0). */
function polar(angle: number, radius: number): { x: number; y: number } {
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

/**
 * Radial tidy tree: the root sits in the centre, each level on its own ring,
 * leaves share the angle evenly and every parent points at the middle of its
 * leaves. Rings are pushed outwards until the boxes of a ring fit side by side.
 */
export function radialTreeLayout(
  root: TreeLayoutInput,
  { levelGap = 96, siblingGap = 10, startAngle = 0, sweep = TAU }: RadialLayoutOptions = {},
): TreeLayout {
  const tree = walk(root, 0, null);
  const leaves = Math.max(1, spanLeaves(tree));
  const all = flatten(tree);
  const maxDepth = Math.max(...all.map((node) => node.depth));
  const full = sweep >= TAU - 1e-6;

  const slot = (index: number) => startAngle + ((index + 0.5) / leaves) * sweep;
  const angleOf = (node: Walk) =>
    node.children.length === 0 ? slot(node.lo) : (slot(node.lo) + slot(node.hi)) / 2;

  // Ring radius: the level gap, or the smallest radius where no box touches another (siblingGap apart).
  const radii: number[] = [0];
  const placed: Array<{ x: number; y: number; width: number; height: number }> = [
    { x: 0, y: 0, width: tree.input.width, height: tree.input.height },
  ];
  const touches = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) =>
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + siblingGap &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + siblingGap;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const ring = all.filter((node) => node.depth === depth);
    const arc = Math.max(
      ...ring.map((node) => Math.max(node.input.height, node.input.width * 0.55)),
    );
    const needed = (ring.length * (arc + siblingGap)) / (full ? TAU : sweep);
    let radius = Math.max((radii[depth - 1] as number) + levelGap, needed * 0.6);
    const fits = (candidate: number) => {
      const boxes = ring.map((node) => {
        const point = polar(angleOf(node), candidate);
        return { ...point, width: node.input.width, height: node.input.height };
      });
      return boxes.every(
        (box, index) =>
          !placed.some((other) => touches(box, other)) &&
          !boxes.some((other, otherIndex) => otherIndex > index && touches(box, other)),
      );
    };
    for (let guard = 0; guard < 4000 && !fits(radius); guard += 1) radius += 2;
    radii[depth] = radius;
    for (const node of ring) {
      const point = polar(angleOf(node), radius);
      placed.push({ ...point, width: node.input.width, height: node.input.height });
    }
  }

  const nodes: TreeLayoutNode[] = all.map((node) => {
    const angle = angleOf(node);
    const radius = radii[node.depth] as number;
    const point = polar(angle, radius);
    return {
      id: node.input.id,
      parentId: node.parentId,
      depth: node.depth,
      x: point.x,
      y: point.y,
      width: node.input.width,
      height: node.input.height,
      angle,
    };
  });

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }
  for (const node of nodes) {
    node.x -= minX;
    node.y -= minY;
  }
  return {
    nodes,
    width: maxX - minX,
    height: maxY - minY,
    center: { x: -minX, y: -minY },
  };
}

/**
 * Dendrogram (cluster layout): like the tidy tree, but every leaf is drawn on
 * the last level, so the leaves line up and the branches read as a hierarchy
 * of groupings. Internal nodes are centred over their first and last child.
 */
export function dendrogramLayout(
  root: TreeLayoutInput,
  { direction = "top", siblingGap = 20, levelGap = 48 }: TreeLayoutOptions = {},
): TreeLayout {
  const vertical = direction === "top" || direction === "bottom";
  const tree = walk(root, 0, null);
  const all = flatten(tree);
  const maxDepth = Math.max(...all.map((node) => node.depth));
  const breadthOf = (node: Walk) => (vertical ? node.input.width : node.input.height);
  const alongOf = (node: Walk) => (vertical ? node.input.height : node.input.width);

  const centre = new Map<Walk, number>();
  let cursor = 0;
  const place = (node: Walk) => {
    if (node.children.length === 0) {
      const size = breadthOf(node);
      centre.set(node, cursor + size / 2);
      cursor += size + siblingGap;
      return;
    }
    for (const child of node.children) place(child);
    const first = centre.get(node.children[0] as Walk) as number;
    const last = centre.get(node.children[node.children.length - 1] as Walk) as number;
    centre.set(node, (first + last) / 2);
  };
  place(tree);

  const levelOf = (node: Walk) => (node.children.length === 0 ? maxDepth : node.depth);
  const levelSize: number[] = [];
  for (const node of all) {
    const level = levelOf(node);
    levelSize[level] = Math.max(levelSize[level] ?? 0, alongOf(node));
  }
  const levelStart: number[] = [0];
  for (let level = 1; level <= maxDepth; level += 1) {
    levelStart[level] = (levelStart[level - 1] as number) + (levelSize[level - 1] ?? 0) + levelGap;
  }

  const flip = direction === "bottom" || direction === "right" ? -1 : 1;
  const nodes: TreeLayoutNode[] = all.map((node) => {
    const level = levelOf(node);
    const along = ((levelStart[level] as number) + (levelSize[level] ?? 0) / 2) * flip;
    const across = centre.get(node) as number;
    return {
      id: node.input.id,
      parentId: node.parentId,
      depth: node.depth,
      x: vertical ? across : along,
      y: vertical ? along : across,
      width: node.input.width,
      height: node.input.height,
    };
  });

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }
  for (const node of nodes) {
    node.x -= minX;
    node.y -= minY;
  }
  return { nodes, width: maxX - minX, height: maxY - minY };
}

/** Angle (0 at twelve o'clock, clockwise) and distance of a point around `center`. */
export function toPolar(
  point: { x: number; y: number },
  center: { x: number; y: number },
): { angle: number; radius: number } {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { angle: Math.atan2(dx, -dy), radius: Math.hypot(dx, dy) };
}

/**
 * Edge between two points of a radial layout. `curved` bends smoothly from the
 * parent's ring to the child's, `step` leaves radially, runs along the middle
 * ring and enters radially, `straight` is a line.
 */
export function radialEdgePath(
  parent: { x: number; y: number },
  child: { x: number; y: number },
  center: { x: number; y: number },
  style: TreeEdgeStyle = "curved",
): string {
  const a = toPolar(parent, center);
  const b = toPolar(child, center);
  const r = (n: number) => Math.round(n * 100) / 100;
  const at = (angle: number, radius: number) => {
    const p = polar(angle, radius);
    return { x: center.x + p.x, y: center.y + p.y };
  };
  const from = at(a.angle, a.radius);
  const to = at(b.angle, b.radius);
  if (style === "straight" || a.radius < 1)
    return `M${r(from.x)},${r(from.y)}L${r(to.x)},${r(to.y)}`;
  const mid = (a.radius + b.radius) / 2;
  if (style === "curved") {
    const c1 = at(a.angle, mid);
    const c2 = at(b.angle, mid);
    return `M${r(from.x)},${r(from.y)}C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(to.x)},${r(to.y)}`;
  }
  const out = at(a.angle, mid);
  const into = at(b.angle, mid);
  const delta = ((((b.angle - a.angle) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  const sweepFlag = delta > 0 ? 1 : 0;
  return `M${r(from.x)},${r(from.y)}L${r(out.x)},${r(out.y)}A${r(mid)},${r(mid)} 0 0 ${sweepFlag} ${r(into.x)},${r(into.y)}L${r(to.x)},${r(to.y)}`;
}

/** Layout kinds the tree chart can draw. */
export type TreeLayoutKind = "tidy" | "radial" | "dendrogram";

/** Re-exported so callers can type a direction next to a layout kind. */
export type { TreeDirection };
