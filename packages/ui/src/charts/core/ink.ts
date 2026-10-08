// Framework-free math of the ruler and ink annotations: stroke smoothing, measures between two
// points in data units, a piecewise axis map and the undo / redo history.

export interface DataPoint {
  x: number;
  y: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/** Freehand stroke, stored in data units so it stays on its data when the chart is resized. */
export interface InkStroke {
  kind: "stroke";
  id: number;
  color: string;
  points: DataPoint[];
}

/** Two points whose difference is measured. */
export interface InkRuler {
  kind: "ruler";
  id: number;
  a: DataPoint;
  b: DataPoint;
}

export type InkItem = InkStroke | InkRuler;

export interface InkState {
  items: InkItem[];
  /** Items taken back by undo, most recent last; a new item empties it. */
  redo: InkItem[];
}

export type InkAction =
  | { type: "add"; item: InkItem }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

export const EMPTY_INK: InkState = { items: [], redo: [] };

export function inkReducer(state: InkState, action: InkAction): InkState {
  switch (action.type) {
    case "add":
      return { items: [...state.items, action.item], redo: [] };
    case "undo": {
      const last = state.items[state.items.length - 1];
      return last ? { items: state.items.slice(0, -1), redo: [...state.redo, last] } : state;
    }
    case "redo": {
      const next = state.redo[state.redo.length - 1];
      return next ? { items: [...state.items, next], redo: state.redo.slice(0, -1) } : state;
    }
    case "clear":
      return state.items.length === 0 && state.redo.length === 0 ? state : EMPTY_INK;
  }
}

/** Drops points closer than `minDistance` to the previous kept one; the last point is always kept. */
export function thinPoints<P extends PixelPoint>(points: readonly P[], minDistance: number): P[] {
  if (points.length <= 2) return points.slice();
  const out: P[] = [points[0] as P];
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i] as P;
    const previous = out[out.length - 1] as P;
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance) out.push(point);
  }
  out.push(points[points.length - 1] as P);
  return out;
}

/** Moving average over three points, `passes` times; the ends stay where the pen started and stopped. */
export function smoothPoints<P extends PixelPoint>(points: readonly P[], passes = 2): P[] {
  let current = points.slice();
  for (let pass = 0; pass < passes && current.length > 2; pass += 1) {
    const source = current;
    current = source.map((point, i) =>
      i === 0 || i === source.length - 1
        ? point
        : {
            ...point,
            x: ((source[i - 1] as P).x + point.x + (source[i + 1] as P).x) / 3,
            y: ((source[i - 1] as P).y + point.y + (source[i + 1] as P).y) / 3,
          },
    );
  }
  return current;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * SVG path through the points as a Catmull-Rom spline converted to cubic Béziers: smooth, passing
 * through every point. One point becomes a dot, two a straight line.
 */
export function smoothPath(points: readonly PixelPoint[]): string {
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M${round(first.x)},${round(first.y)}h0`;
  let d = `M${round(first.x)},${round(first.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)] as PixelPoint;
    const p1 = points[i] as PixelPoint;
    const p2 = points[i + 1] as PixelPoint;
    const p3 = points[Math.min(points.length - 1, i + 2)] as PixelPoint;
    d += `C${round(p1.x + (p2.x - p0.x) / 6)},${round(p1.y + (p2.y - p0.y) / 6)} ${round(p2.x - (p3.x - p1.x) / 6)},${round(p2.y - (p3.y - p1.y) / 6)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

/** The pen path of a stroke given in pixels: thinned, smoothed, then splined. */
export function inkPath(points: readonly PixelPoint[], minDistance = 3): string {
  return smoothPath(smoothPoints(thinPoints(points, minDistance), 2));
}

export interface Measure {
  dx: number;
  dy: number;
  /** dy / dx, `null` for a vertical ruler. */
  slope: number | null;
  /** Change of y as a percentage of the start, `null` when the start is 0. */
  percent: number | null;
}

/** Difference between two points of the chart, in data units. */
export function measureSegment(a: DataPoint, b: DataPoint): Measure {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    dx,
    dy,
    slope: dx === 0 ? null : dy / dx,
    percent: a.y === 0 ? null : (dy / Math.abs(a.y)) * 100,
  };
}

const UNITS: Array<[string, number]> = [
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["min", 60_000],
  ["s", 1000],
];

/** Elapsed time as a short text: "3 d", "2.5 h", "40 min". */
export function formatDuration(ms: number): string {
  const size = Math.abs(ms);
  for (const [unit, length] of UNITS) {
    if (size >= length) return `${round(ms / length)} ${unit}`;
  }
  return `${Math.round(ms)} ms`;
}

/** A signed number with its sign always shown: "+4", "-2.5", "0". */
export function signed(
  value: number,
  format: (value: number) => string = (v) => String(round(v)),
): string {
  if (value === 0) return format(0);
  return `${value > 0 ? "+" : "-"}${format(Math.abs(value))}`;
}

export interface AxisMap {
  toPixel: (value: number) => number;
  fromPixel: (pixel: number) => number;
}

/**
 * Piecewise-linear map between data values and pixels, given matching samples (e.g. the center of
 * each category and its index or time). Outside the samples it continues the nearest segment.
 */
export function createAxisMap(pixels: readonly number[], values: readonly number[]): AxisMap {
  const n = Math.min(pixels.length, values.length);
  const interpolate = (from: readonly number[], to: readonly number[], x: number) => {
    if (n === 0) return 0;
    if (n === 1) return to[0] as number;
    let i = 0;
    while (i < n - 2 && x > (from[i + 1] as number)) i += 1;
    const x0 = from[i] as number;
    const x1 = from[i + 1] as number;
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    return (to[i] as number) + ((to[i + 1] as number) - (to[i] as number)) * t;
  };
  return {
    toPixel: (value) => interpolate(values, pixels, value),
    fromPixel: (pixel) => interpolate(pixels, values, pixel),
  };
}
