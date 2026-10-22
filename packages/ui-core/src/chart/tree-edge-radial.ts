/** Edge paths between the nodes of a radial layout. Apart from `tree-edge` so a tidy tree never loads it. */
import { polar, TAU } from "../internal/tree-shared.ts";
import type { TreeEdgeStyle } from "../internal/tree-types.ts";

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
