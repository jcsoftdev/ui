/**
 * Tidy tree layout for org charts and other node-link hierarchies.
 * Pure functions: no React, no DOM, unit tested in `test/charts-graph.test.mjs`.
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
}

export interface TreeLayout {
  /** Pre-order: parents before their children, siblings in input order. */
  nodes: TreeLayoutNode[];
  /** Size of the whole drawing. */
  width: number;
  height: number;
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
