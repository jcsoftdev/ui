/** Radial tree layout: depth is the distance from the centre. */
import { flatten, polar, TAU, type Walk, walk } from "../internal/tree-shared.ts";
import type {
  RadialLayoutOptions,
  TreeLayout,
  TreeLayoutInput,
  TreeLayoutNode,
} from "../internal/tree-types.ts";

export type { RadialLayoutOptions };

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
