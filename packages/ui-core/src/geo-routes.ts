import type { Position } from "./internal/geo.js";

const RAD = Math.PI / 180;

type Vector = [number, number, number];

function toVector([lon, lat]: Position): Vector {
  const phi = lat * RAD;
  const lambda = lon * RAD;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

function fromVector([x, y, z]: Vector): Position {
  return [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
}

function angle(a: Vector, b: Vector): number {
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
}

/**
 * Points of the great circle (the shortest path on the globe) from `a` to `b`, `steps + 1` of
 * them, as `[lon, lat]`. The path is cut into pieces where it crosses the antimeridian, so a
 * projected line never streaks across the whole map.
 */
export function greatCircle(a: Position, b: Position, steps = 48): Position[][] {
  const va = toVector(a);
  const vb = toVector(b);
  const omega = angle(va, vb);
  const count = Math.max(1, Math.round(steps));
  const points: Position[] = [];
  for (let i = 0; i <= count; i += 1) {
    if (omega < 1e-9) {
      points.push(a);
      continue;
    }
    const t = i / count;
    const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
    const wb = Math.sin(t * omega) / Math.sin(omega);
    points.push(
      fromVector([wa * va[0] + wb * vb[0], wa * va[1] + wb * vb[1], wa * va[2] + wb * vb[2]]),
    );
  }
  // Keep the exact ends the caller gave: the trigonometric round trip drifts in the last digits.
  points[0] = a;
  points[points.length - 1] = b;
  const pieces: Position[][] = [[points[0] as Position]];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1] as Position;
    const point = points[i] as Position;
    if (Math.abs(point[0] - previous[0]) > 180) pieces.push([]);
    (pieces[pieces.length - 1] as Position[]).push(point);
  }
  return pieces;
}

/** Angular length of the great circle between two positions, in degrees. */
export function greatCircleDistance(a: Position, b: Position): number {
  return angle(toVector(a), toVector(b)) / RAD;
}

/**
 * Control point of a quadratic curve from `a` to `b`: the midpoint pushed sideways by `bend`
 * times the distance (0 is a straight line, 0.25 a soft arch). With y pointing down a positive
 * `bend` bulges to the left of the travel direction.
 */
export function routeControl(
  a: readonly [number, number],
  b: readonly [number, number],
  bend = 0.25,
): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return [(a[0] + b[0]) / 2 + dy * bend, (a[1] + b[1]) / 2 - dx * bend];
}

/** SVG path of a quadratic arc. */
export function routeArcPath(
  a: readonly [number, number],
  b: readonly [number, number],
  bend = 0.25,
): string {
  const [cx, cy] = routeControl(a, b, bend);
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
}

/** SVG path of a polyline given as separate pieces (`greatCircle` output once projected). */
export function routePolylinePath(
  pieces: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): string {
  return pieces
    .filter((piece) => piece.length > 1)
    .map((piece) => `M${piece.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}`)
    .join("");
}

export type { Position } from "./internal/geo.js";
