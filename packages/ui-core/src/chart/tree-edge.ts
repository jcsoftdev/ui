/** Edge paths between laid out tree nodes: boxes (tidy, dendrogram) and rings (radial). */
import { isVertical, polar, TAU } from "../internal/tree-shared.ts";
import type { TreeDirection, TreeEdgeStyle, TreeLayoutNode } from "../internal/tree-types.ts";

export type { TreeEdgeStyle };

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
