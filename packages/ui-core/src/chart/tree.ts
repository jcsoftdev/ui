/** Node-link tree layouts: tidy, radial and dendrogram, with fitting, edge paths and keyboard moves. */

/**
 * Tidy tree layout for org charts and other node-link hierarchies.
 * Pure functions: no React, no DOM,
 *
 * The layout works in a local frame where `breadth` runs across siblings and
 * `depth` runs from the root to the leaves, then maps that frame onto one of
 * four directions. Subtrees are packed with contours (Reingold–Tilford): each
 * subtree keeps, per level, the extent it occupies across the breadth axis,
 * and the next sibling is pushed just far enough that no level overlaps.
 * Siblings are packed once from the left and once from the right and the two
 * placements are averaged, so small subtrees between large ones are spread
 * evenly (the symmetry Walker's algorithm achieves) and every gap still holds.
 */

/** Where the root sits: `top` grows downwards, `left` grows to the right. */
export type TreeDirection = "top" | "bottom" | "left" | "right";

/** Input of the layout: a node box and the children that are visible. */
export interface TreeLayoutInput {
  id: string;
  /** Box size on screen, in pixels. */
  width: number;
  height: number;
  children?: readonly TreeLayoutInput[];
}

export interface TreeLayoutOptions {
  direction?: TreeDirection;
  /** Minimum gap between neighbouring boxes on the same level. */
  siblingGap?: number;
  /** Gap between levels (from the far side of a level to the near side of the next). */
  levelGap?: number;
}

export interface TreeLayoutNode {
  id: string;
  parentId: string | null;
  depth: number;
  /** Centre of the box, in pixels; the bounds start at 0, 0. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radial layouts: angle in radians, 0 at twelve o'clock, clockwise. */
  angle?: number;
}

export interface TreeLayout {
  /** Pre-order: parents before their children, siblings in input order. */
  nodes: TreeLayoutNode[];
  /** Size of the whole drawing. */
  width: number;
  height: number;
  /** Radial layouts: the root's centre, where the rings are centred. */
  center?: { x: number; y: number };
}

interface Placed {
  input: TreeLayoutInput;
  depth: number;
  /** Size across the breadth axis and along the depth axis. */
  breadth: number;
  along: number;
  /** Centre on the breadth axis, relative to the parent's centre while packing. */
  offset: number;
  children: Placed[];
  /** Per relative level: [min, max] across the breadth axis, relative to this node's centre. */
  contour: Array<[number, number]>;
}

function isVertical(direction: TreeDirection): boolean {
  return direction === "top" || direction === "bottom";
}

function place(input: TreeLayoutInput, depth: number, vertical: boolean): Placed {
  return {
    input,
    depth,
    breadth: vertical ? input.width : input.height,
    along: vertical ? input.height : input.width,
    offset: 0,
    children: (input.children ?? []).map((child) => place(child, depth + 1, vertical)),
    contour: [],
  };
}

/** Smallest offset that puts `next` to the right of `placed`, `gap` apart on every shared level. */
function clearRight(
  placed: ReadonlyArray<[number, number]>,
  next: ReadonlyArray<[number, number]>,
  gap: number,
): number {
  let offset = Number.NEGATIVE_INFINITY;
  const levels = Math.min(placed.length, next.length);
  for (let level = 0; level < levels; level++) {
    offset = Math.max(
      offset,
      (placed[level] as [number, number])[1] - (next[level] as [number, number])[0] + gap,
    );
  }
  return offset;
}

/** Largest offset that puts `next` to the left of `placed`, `gap` apart on every shared level. */
function clearLeft(
  placed: ReadonlyArray<[number, number]>,
  next: ReadonlyArray<[number, number]>,
  gap: number,
): number {
  let offset = Number.POSITIVE_INFINITY;
  const levels = Math.min(placed.length, next.length);
  for (let level = 0; level < levels; level++) {
    offset = Math.min(
      offset,
      (placed[level] as [number, number])[0] - (next[level] as [number, number])[1] - gap,
    );
  }
  return offset;
}

function mergeContour(
  into: Array<[number, number]>,
  contour: ReadonlyArray<[number, number]>,
  offset: number,
): void {
  contour.forEach(([min, max], level) => {
    const current = into[level];
    if (current) {
      current[0] = Math.min(current[0], min + offset);
      current[1] = Math.max(current[1], max + offset);
    } else {
      into[level] = [min + offset, max + offset];
    }
  });
}

/** Offsets of each child centre when packed in order (`reverse` packs from the last one). */
function pack(children: readonly Placed[], gap: number, reverse: boolean): number[] {
  const offsets = new Array<number>(children.length).fill(0);
  const order = children.map((_, index) => index);
  if (reverse) order.reverse();
  const placed: Array<[number, number]> = [];
  order.forEach((index, position) => {
    const child = children[index] as Placed;
    const offset =
      position === 0
        ? 0
        : reverse
          ? clearLeft(placed, child.contour, gap)
          : clearRight(placed, child.contour, gap);
    offsets[index] = offset;
    mergeContour(placed, child.contour, offset);
  });
  return offsets;
}

/** Bottom-up: places children around their parent and builds the subtree contour. */
function arrange(node: Placed, gap: number): void {
  for (const child of node.children) arrange(child, gap);
  const half = node.breadth / 2;
  node.contour = [[-half, half]];
  if (node.children.length === 0) return;

  const fromLeft = pack(node.children, gap, false);
  const fromRight = pack(node.children, gap, true);
  // Both placements satisfy every pairwise gap, so their average does too.
  const shiftLeft = fromLeft[0] as number;
  const shiftRight = fromRight[0] as number;
  const offsets = fromLeft.map(
    (value, index) => (value - shiftLeft + ((fromRight[index] as number) - shiftRight)) / 2,
  );
  const first = offsets[0] as number;
  const last = offsets[offsets.length - 1] as number;
  const centre = (first + last) / 2;

  const below: Array<[number, number]> = [];
  node.children.forEach((child, index) => {
    child.offset = (offsets[index] as number) - centre;
    mergeContour(below, child.contour, child.offset);
  });
  node.contour.push(...below);
}

/**
 * Tidy layout of a tree: parents centred over their children, no two boxes
 * on the same level closer than `siblingGap`, levels `levelGap` apart. Boxes
 * of one level share the same depth band (the tallest box of the level).
 */
export function treeLayout(root: TreeLayoutInput, options: TreeLayoutOptions = {}): TreeLayout {
  const { direction = "top", siblingGap = 20, levelGap = 48 } = options;
  const vertical = isVertical(direction);
  const tree = place(root, 0, vertical);
  arrange(tree, siblingGap);

  const all: Array<{ node: Placed; centre: number; parentId: string | null }> = [];
  const levelSize: number[] = [];
  const visit = (node: Placed, centre: number, parentId: string | null) => {
    all.push({ node, centre, parentId });
    levelSize[node.depth] = Math.max(levelSize[node.depth] ?? 0, node.along);
    for (const child of node.children) visit(child, centre + child.offset, node.input.id);
  };
  visit(tree, 0, null);

  const levelStart: number[] = [0];
  for (let level = 1; level < levelSize.length; level++) {
    levelStart[level] =
      (levelStart[level - 1] as number) + (levelSize[level - 1] as number) + levelGap;
  }

  const nodes: TreeLayoutNode[] = all.map(({ node, centre, parentId }) => {
    const band = levelSize[node.depth] as number;
    const along = (levelStart[node.depth] as number) + band / 2;
    const flip = direction === "bottom" || direction === "right" ? -1 : 1;
    return {
      id: node.input.id,
      parentId,
      depth: node.depth,
      x: vertical ? centre : along * flip,
      y: vertical ? along * flip : centre,
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

/** Edge drawing style between a parent and a child. */
export type TreeEdgeStyle = "curved" | "step" | "straight";

type Box = Pick<TreeLayoutNode, "x" | "y" | "width" | "height">;

/** Point on the side of `box` that faces the next level (`far`) or the previous one. */
function anchor(box: Box, direction: TreeDirection, far: boolean): [number, number] {
  const sign = far ? 1 : -1;
  switch (direction) {
    case "top":
      return [box.x, box.y + (sign * box.height) / 2];
    case "bottom":
      return [box.x, box.y - (sign * box.height) / 2];
    case "left":
      return [box.x + (sign * box.width) / 2, box.y];
    default:
      return [box.x - (sign * box.width) / 2, box.y];
  }
}

/**
 * SVG path from a parent box to a child box. `curved` is a cubic S-curve,
 * `step` an orthogonal elbow with rounded corners (`radius`), `straight` a line.
 */
export function treeEdgePath(
  parent: Box,
  child: Box,
  direction: TreeDirection,
  style: TreeEdgeStyle = "curved",
  radius = 8,
): string {
  const [x0, y0] = anchor(parent, direction, true);
  const [x1, y1] = anchor(child, direction, false);
  const r = (n: number) => Math.round(n * 100) / 100;
  if (style === "straight") return `M${r(x0)},${r(y0)}L${r(x1)},${r(y1)}`;
  const vertical = isVertical(direction);
  if (style === "curved") {
    if (vertical) {
      const mid = (y0 + y1) / 2;
      return `M${r(x0)},${r(y0)}C${r(x0)},${r(mid)} ${r(x1)},${r(mid)} ${r(x1)},${r(y1)}`;
    }
    const mid = (x0 + x1) / 2;
    return `M${r(x0)},${r(y0)}C${r(mid)},${r(y0)} ${r(mid)},${r(y1)} ${r(x1)},${r(y1)}`;
  }
  // Step: along the depth axis to the middle, across, then on to the child.
  if (vertical) {
    const mid = (y0 + y1) / 2;
    const across = x1 - x0;
    const turn = Math.min(radius, Math.abs(across) / 2, Math.abs(mid - y0));
    if (turn < 0.5) return `M${r(x0)},${r(y0)}V${r(mid)}H${r(x1)}V${r(y1)}`;
    const sx = Math.sign(across);
    const sy = Math.sign(y1 - y0);
    return [
      `M${r(x0)},${r(y0)}`,
      `V${r(mid - sy * turn)}`,
      `Q${r(x0)},${r(mid)} ${r(x0 + sx * turn)},${r(mid)}`,
      `H${r(x1 - sx * turn)}`,
      `Q${r(x1)},${r(mid)} ${r(x1)},${r(mid + sy * turn)}`,
      `V${r(y1)}`,
    ].join("");
  }
  const mid = (x0 + x1) / 2;
  const across = y1 - y0;
  const turn = Math.min(radius, Math.abs(across) / 2, Math.abs(mid - x0));
  if (turn < 0.5) return `M${r(x0)},${r(y0)}H${r(mid)}V${r(y1)}H${r(x1)}`;
  const sy = Math.sign(across);
  const sx = Math.sign(x1 - x0);
  return [
    `M${r(x0)},${r(y0)}`,
    `H${r(mid - sx * turn)}`,
    `Q${r(mid)},${r(y0)} ${r(mid)},${r(y0 + sy * turn)}`,
    `V${r(y1 - sy * turn)}`,
    `Q${r(mid)},${r(y1)} ${r(mid + sx * turn)},${r(y1)}`,
    `H${r(x1)}`,
  ].join("");
}

/** Ids from the root down to `id` (inclusive), following `parentId`. */
export function treePathToRoot(
  nodes: readonly Pick<TreeLayoutNode, "id" | "parentId">[],
  id: string,
): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: string[] = [];
  for (let current = byId.get(id); current; ) {
    path.unshift(current.id);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** What an arrow key means in a given direction. */
export type TreeMove = "parent" | "child" | "previous" | "next";

/**
 * Maps an arrow key to a tree move relative to the drawing: in a top-down
 * chart Down goes to the first child and Right to the next sibling; in a
 * left-to-right chart Right goes to the child and Down to the next sibling.
 */
export function treeKeyMove(key: string, direction: TreeDirection): TreeMove | null {
  const towardsChild: Record<TreeDirection, string> = {
    top: "ArrowDown",
    bottom: "ArrowUp",
    left: "ArrowRight",
    right: "ArrowLeft",
  };
  const towardsParent: Record<TreeDirection, string> = {
    top: "ArrowUp",
    bottom: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  };
  if (key === towardsChild[direction]) return "child";
  if (key === towardsParent[direction]) return "parent";
  const vertical = isVertical(direction);
  if (key === (vertical ? "ArrowRight" : "ArrowDown")) return "next";
  if (key === (vertical ? "ArrowLeft" : "ArrowUp")) return "previous";
  return null;
}

/**
 * Node reached from `id` by `move` among the laid-out (visible) nodes.
 * Siblings stop at the ends; `child` goes to the middle child, which sits
 * right under the parent. Returns `id` itself when there is nowhere to go.
 */
export function treeNeighbor(
  nodes: readonly Pick<TreeLayoutNode, "id" | "parentId">[],
  id: string,
  move: TreeMove,
): string {
  const current = nodes.find((node) => node.id === id);
  if (!current) return id;
  if (move === "parent") return current.parentId ?? id;
  if (move === "child") {
    const children = nodes.filter((node) => node.parentId === id);
    return children[Math.floor((children.length - 1) / 2)]?.id ?? id;
  }
  if (current.parentId == null) return id;
  const siblings = nodes.filter((node) => node.parentId === current.parentId);
  const index = siblings.findIndex((node) => node.id === id);
  const next = siblings[index + (move === "next" ? 1 : -1)];
  return next?.id ?? id;
}

/**
 * Alternative tree layouts: radial (depth = distance from the centre) and
 * dendrogram (every leaf on the last level). Pure functions that return the
 * same `TreeLayout` as `treeLayout`, so the chart draws them with the same
 * boxes, transitions and edge paths.
 */

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

interface PanZoomView {
  k: number;
  x: number;
  y: number;
}

/** `contain` shows the whole tree, `readable` keeps cards legible and puts the root in view. */
export type TreeFitMode = "contain" | "readable";

export interface TreeFitOptions {
  /** Pixels reserved at the top (the zoom toolbar). */
  inset?: number;
  padding?: number;
  /** `auto` falls back to `readable` when `contain` would scale below `minReadable`. */
  mode?: TreeFitMode | "auto";
  /** Smallest scale at which a fitted tree still counts as legible. */
  minReadable?: number;
  /** Scale range of the `readable` view. */
  readableMin?: number;
  readableMax?: number;
  minZoom?: number;
  /** Centre the root in the `readable` view (radial layouts), instead of pinning it to an edge. */
  centerRoot?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Initial view of a laid out tree in a `width` x `height` viewport. `contain` scales the whole
 * tree to fit (never past 1). `readable` ignores the width: it fits by height within
 * `[readableMin, readableMax]` and puts the root at its edge (centred across, never above the `inset` band), so the
 * rest is a pan away. `auto` picks `contain` unless it would drop below `minReadable`.
 */
export function treeFitView(
  layout: Pick<TreeLayout, "nodes" | "width" | "height">,
  width: number,
  height: number,
  direction: TreeDirection,
  {
    inset = 0,
    padding = 16,
    mode = "auto",
    minReadable = 0.6,
    readableMin = 0.85,
    readableMax = 1,
    minZoom = 0.05,
    centerRoot = false,
  }: TreeFitOptions = {},
): { view: PanZoomView; mode: TreeFitMode } {
  const areaHeight = Math.max(1, height - inset);
  const containK = Math.max(
    minZoom,
    Math.min(
      (width - padding * 2) / Math.max(1, layout.width),
      (areaHeight - padding * 2) / Math.max(1, layout.height),
      1,
    ),
  );
  const root = layout.nodes[0];
  if (!root || mode === "contain" || (mode === "auto" && containK >= minReadable)) {
    return {
      mode: "contain",
      view: {
        k: containK,
        x: (width - layout.width * containK) / 2,
        y: inset + (areaHeight - layout.height * containK) / 2,
      },
    };
  }

  const k = clamp(
    (areaHeight - padding * 2) / Math.max(1, layout.height),
    readableMin,
    readableMax,
  );
  let x = width / 2 - root.x * k;
  let y = inset + areaHeight / 2 - root.y * k;
  if (centerRoot) {
    // Radial: the root stays at the middle, the rings are a pan away.
  } else if (direction === "top") y = inset + padding - (root.y - root.height / 2) * k;
  else if (direction === "bottom") y = height - padding - (root.y + root.height / 2) * k;
  else {
    x =
      direction === "left"
        ? padding - (root.x - root.width / 2) * k
        : width - padding - (root.x + root.width / 2) * k;
    const top = Math.min(...layout.nodes.map((node) => node.y - node.height / 2));
    y = Math.max(y, inset + padding - top * k);
  }
  return { mode: "readable", view: { k, x, y } };
}
