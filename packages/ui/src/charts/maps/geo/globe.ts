import type { Position } from "./types.js";

const RAD = Math.PI / 180;

/** Unit vector on the sphere (x, y, z). */
export type Vec3 = readonly [number, number, number];

/** The point of the globe facing the viewer, in degrees. */
export interface GlobeRotation {
  lon: number;
  lat: number;
}

/** Maximum latitude of the view center: the poles themselves are a singular view. */
export const GLOBE_MAX_LAT = 89;

/** Longitude wrapped into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Keeps a rotation valid: longitude wrapped, latitude clamped. */
export function normalizeRotation(rotation: GlobeRotation): GlobeRotation {
  return {
    lon: wrapLon(rotation.lon),
    lat: Math.max(-GLOBE_MAX_LAT, Math.min(GLOBE_MAX_LAT, rotation.lat)),
  };
}

/** `[lon, lat]` in degrees to a unit vector. */
export function toVec([lon, lat]: Position): Vec3 {
  const phi = lat * RAD;
  const lambda = lon * RAD;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

/** Unit vector to `[lon, lat]` in degrees. */
export function fromVec([x, y, z]: Vec3): Position {
  return [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
}

type Matrix = readonly [Vec3, Vec3, Vec3];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Rows of the view basis: east, north and the direction towards the viewer at the rotation's
 * center. Applying it to a world vector gives view coordinates (x right, y up, z towards the viewer).
 */
export function viewMatrix({ lon, lat }: GlobeRotation): Matrix {
  const lambda = lon * RAD;
  const phi = lat * RAD;
  return [
    [-Math.sin(lambda), Math.cos(lambda), 0],
    [-Math.sin(phi) * Math.cos(lambda), -Math.sin(phi) * Math.sin(lambda), Math.cos(phi)],
    [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)],
  ];
}

export function applyMatrix(matrix: Matrix, v: Vec3): Vec3 {
  return [dot(matrix[0], v), dot(matrix[1], v), dot(matrix[2], v)];
}

/** The disc the globe occupies on screen. */
export interface GlobeDisc {
  cx: number;
  cy: number;
  radius: number;
}

/** View coordinates to screen pixels (y grows downwards). */
export function viewToScreen(v: Vec3, { cx, cy, radius }: GlobeDisc): [number, number] {
  return [cx + radius * v[0], cy - radius * v[1]];
}

/** Orthographic projection of `[lon, lat]`, or `null` on the far side of the globe. */
export function projectOrthographic(
  position: Position,
  rotation: GlobeRotation,
  disc: GlobeDisc,
): [number, number] | null {
  const v = applyMatrix(viewMatrix(rotation), toVec(position));
  return v[2] < 0 ? null : viewToScreen(v, disc);
}

/** The `[lon, lat]` under a screen pixel, or `null` outside the disc. */
export function invertOrthographic(
  x: number,
  y: number,
  rotation: GlobeRotation,
  { cx, cy, radius }: GlobeDisc,
): Position | null {
  const xv = (x - cx) / radius;
  const yv = -(y - cy) / radius;
  const r2 = xv * xv + yv * yv;
  if (r2 > 1) return null;
  const [east, north, front] = viewMatrix(rotation);
  const zv = Math.sqrt(1 - r2);
  return fromVec([
    xv * east[0] + yv * north[0] + zv * front[0],
    xv * east[1] + yv * north[1] + zv * front[1],
    xv * east[2] + yv * north[2] + zv * front[2],
  ]);
}

/**
 * New rotation after dragging `dx`, `dy` pixels: the surface follows the pointer (one disc
 * radius is one radian), so a small globe turns faster per pixel than a big one.
 */
export function dragRotation(
  rotation: GlobeRotation,
  dx: number,
  dy: number,
  radius: number,
): GlobeRotation {
  const k = 1 / Math.max(1, radius) / RAD;
  return normalizeRotation({ lon: rotation.lon - dx * k, lat: rotation.lat + dy * k });
}

/** Rotation after an arrow key: left and right turn the globe, up and down tilt it. */
export function keyRotation(rotation: GlobeRotation, key: string, step = 10): GlobeRotation | null {
  if (key === "ArrowLeft") return normalizeRotation({ ...rotation, lon: rotation.lon - step });
  if (key === "ArrowRight") return normalizeRotation({ ...rotation, lon: rotation.lon + step });
  if (key === "ArrowUp") return normalizeRotation({ ...rotation, lat: rotation.lat + step });
  if (key === "ArrowDown") return normalizeRotation({ ...rotation, lat: rotation.lat - step });
  return null;
}

/** Rotation after `seconds` of the idle spin at `speed` degrees per second (eastwards view drift). */
export function spinRotation(
  rotation: GlobeRotation,
  seconds: number,
  speed: number,
): GlobeRotation {
  return normalizeRotation({ ...rotation, lon: rotation.lon + speed * seconds });
}

function lerpUnit(a: Vec3, b: Vec3, t: number): Vec3 {
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  const z = a[2] + (b[2] - a[2]) * t;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function arcPoints(from: Vec3, to: Vec3, stepRad: number): Vec3[] {
  // Both ends sit on the horizon circle (z = 0): walk the shorter arc between them.
  const start = Math.atan2(from[1], from[0]);
  let delta = Math.atan2(to[1], to[0]) - start;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  const count = Math.floor(Math.abs(delta) / stepRad);
  const points: Vec3[] = [];
  for (let i = 1; i < count; i += 1) {
    const angle = start + (delta * i) / count;
    points.push([Math.cos(angle), Math.sin(angle), 0]);
  }
  return points;
}

/**
 * A closed ring in view coordinates cut to the visible hemisphere (z >= 0). Where the ring
 * leaves and re-enters the visible side, the cut follows the horizon circle instead of a
 * straight chord, so a continent half behind the globe keeps its round edge.
 * Returns `null` when the ring is entirely hidden.
 */
export function clipRingToHemisphere(ring: readonly Vec3[], arcStep = 6 * RAD): Vec3[] | null {
  const n = ring.length;
  if (n < 3) return null;
  const marked: Array<{ v: Vec3; kind: "inside" | "exit" | "enter" }> = [];
  let anyInside = false;
  for (let i = 0; i < n; i += 1) {
    const previous = ring[(i + n - 1) % n] as Vec3;
    const current = ring[i] as Vec3;
    const insideNow = current[2] >= 0;
    const insideBefore = previous[2] >= 0;
    if (insideNow !== insideBefore) {
      const t = previous[2] / (previous[2] - current[2]);
      const cut = lerpUnit(previous, current, t);
      marked.push({ v: [cut[0], cut[1], 0], kind: insideNow ? "enter" : "exit" });
    }
    if (insideNow) {
      marked.push({ v: current, kind: "inside" });
      anyInside = true;
    }
  }
  if (!anyInside) return null;
  const out: Vec3[] = [];
  for (let i = 0; i < marked.length; i += 1) {
    const item = marked[i] as (typeof marked)[number];
    out.push(item.v);
    if (item.kind === "exit") {
      const next = marked[(i + 1) % marked.length] as (typeof marked)[number];
      if (next.kind === "enter") out.push(...arcPoints(item.v, next.v, arcStep));
    }
  }
  return out;
}

/**
 * SVG path of rings drawn on the globe. `rings` hold precomputed world vectors (`toVec`), so
 * turning the globe is one matrix product per vertex. Use with `fill-rule: evenodd`.
 */
export function globeRingsPath(
  rings: ReadonlyArray<readonly Vec3[]>,
  rotation: GlobeRotation,
  disc: GlobeDisc,
): string {
  const matrix = viewMatrix(rotation);
  let d = "";
  for (const ring of rings) {
    const view = ring.map((v) => applyMatrix(matrix, v));
    const clipped = view.every((v) => v[2] >= 0) ? view : clipRingToHemisphere(view);
    if (!clipped) continue;
    let part = "";
    let count = 0;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    for (const v of clipped) {
      const [px, py] = viewToScreen(v, disc);
      const x = Math.round(px * 10) / 10;
      const y = Math.round(py * 10) / 10;
      if (x === lastX && y === lastY) continue;
      part += `${count === 0 ? "M" : "L"}${x} ${y}`;
      lastX = x;
      lastY = y;
      count += 1;
    }
    if (count >= 3) d += `${part}Z`;
  }
  return d;
}

/** Meridians and parallels every `step` degrees, as polylines of `[lon, lat]`. */
export function graticuleLines(step = 30, resolution = 6): Position[][] {
  const lines: Position[][] = [];
  for (let lon = -180; lon < 180; lon += step) {
    const line: Position[] = [];
    for (let lat = -90; lat <= 90; lat += resolution) line.push([lon, lat]);
    lines.push(line);
  }
  for (let lat = -90 + step; lat < 90; lat += step) {
    const line: Position[] = [];
    for (let lon = -180; lon <= 180; lon += resolution) line.push([lon, lat]);
    lines.push(line);
  }
  return lines;
}

/**
 * Visible stretches of a polyline of world vectors, projected: a path leaving the visible
 * hemisphere is cut at the horizon so lines never wrap behind the globe.
 */
export function globeLinePieces(
  line: readonly Vec3[],
  rotation: GlobeRotation,
  disc: GlobeDisc,
): Array<Array<[number, number]>> {
  const matrix = viewMatrix(rotation);
  const pieces: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  let previous: Vec3 | null = null;
  for (const world of line) {
    const v = applyMatrix(matrix, world);
    if (v[2] >= 0) {
      if (previous && previous[2] < 0) {
        const cut = lerpUnit(previous, v, previous[2] / (previous[2] - v[2]));
        current.push(viewToScreen([cut[0], cut[1], 0], disc));
      }
      current.push(viewToScreen(v, disc));
    } else if (previous && previous[2] >= 0) {
      const cut = lerpUnit(previous, v, previous[2] / (previous[2] - v[2]));
      current.push(viewToScreen([cut[0], cut[1], 0], disc));
      pieces.push(current);
      current = [];
    }
    previous = v;
  }
  if (current.length > 1) pieces.push(current);
  return pieces.filter((piece) => piece.length > 1);
}

/**
 * Points of the great circle from `a` to `b` as world vectors, optionally lifted off the surface
 * (`lift` is the extra radius at the middle, as a fraction of the globe radius) so an arc
 * seems to fly over the globe.
 */
export function globeArc(a: Position, b: Position, steps = 48, lift = 0): Vec3[] {
  const va = toVec(a);
  const vb = toVec(b);
  const cos = Math.max(-1, Math.min(1, dot(va, vb)));
  const omega = Math.acos(cos);
  const count = Math.max(1, Math.round(steps));
  const points: Vec3[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    let p: Vec3;
    if (omega < 1e-9 || Math.abs(Math.PI - omega) < 1e-9) {
      p = va;
    } else {
      const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
      const wb = Math.sin(t * omega) / Math.sin(omega);
      p = [wa * va[0] + wb * vb[0], wa * va[1] + wb * vb[1], wa * va[2] + wb * vb[2]];
    }
    const scale = 1 + lift * Math.sin(Math.PI * t) * Math.min(1, omega / Math.PI);
    points.push([p[0] * scale, p[1] * scale, p[2] * scale]);
  }
  return points;
}
