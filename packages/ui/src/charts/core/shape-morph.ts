/**
 * Shape morphing between a rectangle and an annular sector. Both are sampled
 * as closed polygons with the same number of points, edge for edge, so any
 * blend between them is a plain point-wise interpolation. Pure functions.
 */

export interface RingPoint {
  x: number;
  y: number;
}

/** Samples per edge: four edges, so a ring holds `4 * EDGE_SAMPLES` points. */
export const EDGE_SAMPLES = 20;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Rectangle as a clockwise polygon starting at the top-left corner:
 * top edge, right edge, bottom edge, left edge.
 */
export function rectRing(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  samples = EDGE_SAMPLES,
): RingPoint[] {
  const out: RingPoint[] = [];
  for (let i = 0; i < samples; i++) out.push({ x: lerp(x0, x1, i / samples), y: y0 });
  for (let i = 0; i < samples; i++) out.push({ x: x1, y: lerp(y0, y1, i / samples) });
  for (let i = 0; i < samples; i++) out.push({ x: lerp(x1, x0, i / samples), y: y1 });
  for (let i = 0; i < samples; i++) out.push({ x: x0, y: lerp(y1, y0, i / samples) });
  return out;
}

/**
 * Annular sector as a polygon with the same edge order as `rectRing`: the
 * outer arc plays the top edge, the end radius the right edge, the inner arc
 * the bottom edge and the start radius the left edge. Angles in radians, 0 at
 * twelve o'clock, clockwise.
 */
export function sectorRing(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  samples = EDGE_SAMPLES,
): RingPoint[] {
  const at = (r: number, a: number): RingPoint => ({
    x: cx + r * Math.sin(a),
    y: cy - r * Math.cos(a),
  });
  const out: RingPoint[] = [];
  for (let i = 0; i < samples; i++) out.push(at(r1, lerp(a0, a1, i / samples)));
  for (let i = 0; i < samples; i++) out.push(at(lerp(r1, r0, i / samples), a1));
  for (let i = 0; i < samples; i++) out.push(at(r0, lerp(a1, a0, i / samples)));
  for (let i = 0; i < samples; i++) out.push(at(lerp(r0, r1, i / samples), a0));
  return out;
}

/** RingPoint-wise blend of two rings of equal length: `t` 0 gives `from`, 1 gives `to`. */
export function blendRings(
  from: readonly RingPoint[],
  to: readonly RingPoint[],
  t: number,
): RingPoint[] {
  const count = Math.min(from.length, to.length);
  const out: RingPoint[] = [];
  for (let i = 0; i < count; i++) {
    const a = from[i] as RingPoint;
    const b = to[i] as RingPoint;
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return out;
}

/** Closed SVG path through the points. Empty for fewer than three points. */
export function ringPath(points: readonly RingPoint[]): string {
  if (points.length < 3) return "";
  let d = "";
  points.forEach((point, index) => {
    d += `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  });
  return `${d}Z`;
}

/** Mean of the polygon's points; for these convex-ish shapes it sits inside the shape. */
export function ringCenter(points: readonly RingPoint[]): RingPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}
