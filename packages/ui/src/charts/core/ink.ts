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

/**
 * Conversions of a plot. On a vertical chart `toX` / `fromX` map the category (or time) axis to pixels
 * along x and `toY` / `fromY` the value axis along y. On a horizontal bar chart the categories run
 * top to bottom: `toX` / `fromX` still map the category axis (now to pixels along y) and `toY` / `fromY`
 * the value axis (now to pixels along x). A data point is always `{ x: category, y: value }`.
 */
export interface PlotAxes {
  horizontal?: boolean;
  width: number;
  height: number;
  xKind: "index" | "time";
  toX: (value: number) => number;
  fromX: (pixel: number) => number;
  toY: (value: number) => number;
  fromY: (pixel: number) => number;
}

/** Plot-relative pixel of a data point, whichever way the plot is laid out. */
export function plotToPixel(plot: PlotAxes, point: DataPoint): PixelPoint {
  return plot.horizontal
    ? { x: plot.toY(point.y), y: plot.toX(point.x) }
    : { x: plot.toX(point.x), y: plot.toY(point.y) };
}

/** Data point under a plot-relative pixel, clamped to the plot box. */
export function pixelToPlot(plot: PlotAxes, pixel: PixelPoint): DataPoint {
  const px = Math.min(plot.width, Math.max(0, pixel.x));
  const py = Math.min(plot.height, Math.max(0, pixel.y));
  return plot.horizontal
    ? { x: plot.fromX(py), y: plot.fromY(px) }
    : { x: plot.fromX(px), y: plot.fromY(py) };
}

/** Visible data window of a plot, for the keyboard cursor. */
export function plotDomain(plot: PlotAxes): CursorDomain {
  return plot.horizontal
    ? {
        x: [plot.fromX(0), plot.fromX(plot.height)],
        y: [plot.fromY(0), plot.fromY(plot.width)],
        xKind: plot.xKind,
      }
    : {
        x: [plot.fromX(0), plot.fromX(plot.width)],
        y: [plot.fromY(plot.height), plot.fromY(0)],
        xKind: plot.xKind,
      };
}

export type CursorKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Visible data window of a plot, which the keyboard cursor moves inside. */
export interface CursorDomain {
  x: readonly [number, number];
  y: readonly [number, number];
  /** "index": x moves one category at a time; "time": by a fiftieth of the window. */
  xKind: "index" | "time";
}

const clampTo = (value: number, [a, b]: readonly [number, number]) =>
  Math.min(Math.max(a, b), Math.max(Math.min(a, b), value));

/** Where the crosshair appears when a plot is focused: the middle of the window. */
export function startCursor(domain: CursorDomain): DataPoint {
  const x = (domain.x[0] + domain.x[1]) / 2;
  return {
    x: domain.xKind === "index" ? clampTo(Math.round(x), domain.x) : x,
    y: (domain.y[0] + domain.y[1]) / 2,
  };
}

/**
 * One arrow-key step of the crosshair in data units: a category on index axes (a fiftieth of the
 * window on time axes) and a fiftieth of the value window vertically; `big` moves five times as far.
 * It never leaves the window. On a horizontal plot (`horizontal`) left and right move the value and
 * up and down the category (down is the next one, as the categories run top to bottom).
 */
export function moveCursor(
  cursor: DataPoint,
  key: CursorKey,
  big: boolean,
  domain: CursorDomain,
  horizontal = false,
): DataPoint {
  const factor = big ? 5 : 1;
  const xStep = domain.xKind === "index" ? 1 : Math.abs(domain.x[1] - domain.x[0]) / 50;
  const yStep = Math.abs(domain.y[1] - domain.y[0]) / 50;
  if (horizontal) {
    const sideways = key === "ArrowLeft" || key === "ArrowRight";
    const forward = key === "ArrowRight" || key === "ArrowDown";
    const sign = forward ? 1 : -1;
    return sideways
      ? { ...cursor, y: clampTo(cursor.y + sign * yStep * factor, domain.y) }
      : { ...cursor, x: clampTo(cursor.x + sign * xStep * factor, domain.x) };
  }
  const sign = key === "ArrowRight" || key === "ArrowUp" ? 1 : -1;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return { ...cursor, x: clampTo(cursor.x + sign * xStep * factor, domain.x) };
  }
  return { ...cursor, y: clampTo(cursor.y + sign * yStep * factor, domain.y) };
}

/**
 * What a key does with the points collected so far. The ruler needs two points and commits on the
 * second; the pen collects vertices with Space and Enter finishes (the cursor becomes the last vertex).
 */
export type CursorAction =
  | { type: "pending"; points: DataPoint[] }
  | { type: "commit"; points: DataPoint[] }
  | { type: "cancel" };

export function cursorAction(
  tool: "ruler" | "ink",
  key: " " | "Enter" | "Escape",
  points: readonly DataPoint[],
  cursor: DataPoint,
): CursorAction {
  if (key === "Escape") return { type: "cancel" };
  if (tool === "ruler") {
    const first = points[0];
    if (!first) return { type: "pending", points: [cursor] };
    if (first.x === cursor.x && first.y === cursor.y) return { type: "pending", points: [first] };
    return { type: "commit", points: [first, cursor] };
  }
  if (key === " ") return { type: "pending", points: [...points, cursor] };
  const last = points[points.length - 1];
  const all =
    last && last.x === cursor.x && last.y === cursor.y ? [...points] : [...points, cursor];
  return all.length >= 2 ? { type: "commit", points: all } : { type: "pending", points: all };
}
