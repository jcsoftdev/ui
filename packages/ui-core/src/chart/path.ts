/** SVG path builders. All coordinates are in pixels. */

export interface Point {
  x: number;
  y: number;
}

/**
 * `smooth` is a monotone cubic; the `step*` curves hold a value until the next
 * sample (`step-after`), jump to it early (`step-before`) or change halfway (`step`).
 */
export type Curve = "linear" | "smooth" | "step" | "step-before" | "step-after";

/** The same step curve walked backwards (the lower edge of an area). */
function mirrorCurve(curve: Curve): Curve {
  if (curve === "step-before") return "step-after";
  if (curve === "step-after") return "step-before";
  return curve;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Splits a sequence at `null` gaps into drawable runs. */
export function segments(points: ReadonlyArray<Point | null>): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  for (const point of points) {
    if (point) {
      run.push(point);
    } else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

/**
 * Tangents for a monotone cubic through `points` (Fritsch–Butland): the curve
 * never overshoots between two samples, so a peak in the data is a peak on screen.
 */
export function monotoneTangents(points: readonly Point[]): number[] {
  const n = points.length;
  if (n < 2) return [0];
  const slopes: number[] = [];
  const widths: number[] = [];
  for (let k = 0; k < n - 1; k += 1) {
    const a = points[k] as Point;
    const b = points[k + 1] as Point;
    const h = b.x - a.x;
    widths.push(h);
    slopes.push(h === 0 ? 0 : (b.y - a.y) / h);
  }
  const tangents: number[] = [slopes[0] as number];
  for (let k = 1; k < n - 1; k += 1) {
    const d0 = slopes[k - 1] as number;
    const d1 = slopes[k] as number;
    const h0 = widths[k - 1] as number;
    const h1 = widths[k] as number;
    tangents.push(d0 * d1 <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1));
  }
  tangents.push(slopes[n - 2] as number);
  return tangents;
}

/**
 * Commands through `points`. The first command is `M`, or `L` when `join` is
 * true, so the run can extend a path already in progress (areas).
 */
export function curveCommands(points: readonly Point[], curve: Curve, join = false): string {
  if (!points.length) return "";
  const first = points[0] as Point;
  let d = `${join ? "L" : "M"}${round(first.x)},${round(first.y)}`;
  if (curve === "step" || curve === "step-before" || curve === "step-after") {
    for (let k = 1; k < points.length; k += 1) {
      const a = points[k - 1] as Point;
      const b = points[k] as Point;
      if (curve === "step-after") {
        d += `H${round(b.x)}V${round(b.y)}`;
      } else if (curve === "step-before") {
        d += `V${round(b.y)}H${round(b.x)}`;
      } else {
        const mid = round((a.x + b.x) / 2);
        d += `H${mid}V${round(b.y)}H${round(b.x)}`;
      }
    }
    return d;
  }
  if (curve === "linear" || points.length < 3) {
    for (let k = 1; k < points.length; k += 1) {
      const p = points[k] as Point;
      d += `L${round(p.x)},${round(p.y)}`;
    }
    return d;
  }
  const m = monotoneTangents(points);
  for (let k = 0; k < points.length - 1; k += 1) {
    const a = points[k] as Point;
    const b = points[k + 1] as Point;
    const h = (b.x - a.x) / 3;
    d += `C${round(a.x + h)},${round(a.y + (m[k] as number) * h)} ${round(b.x - h)},${round(
      b.y - (m[k + 1] as number) * h,
    )} ${round(b.x)},${round(b.y)}`;
  }
  return d;
}

/** Line through the points; `null` entries break the line. */
export function linePath(points: ReadonlyArray<Point | null>, curve: Curve = "linear"): string {
  return segments(points)
    .map((run) => curveCommands(run, curve))
    .join("");
}

/**
 * Closed area between a top and a bottom edge sampled at the same x positions
 * (`bottom[i]` pairs with `top[i]`). A `null` in `top` breaks the area.
 */
export function areaPath(
  top: ReadonlyArray<Point | null>,
  bottom: ReadonlyArray<Point>,
  curve: Curve = "linear",
): string {
  let d = "";
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    const upper = top.slice(start, end) as Point[];
    const lower = bottom.slice(start, end).reverse();
    d += `${curveCommands(upper, curve)}${curveCommands(lower, mirrorCurve(curve), true)}Z`;
    start = -1;
  };
  top.forEach((point, index) => {
    if (point && start < 0) start = index;
    if (!point) flush(index);
  });
  flush(top.length);
  return d;
}

export interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** Rectangle with an independent radius per corner, clamped to fit. */
export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: CornerRadii,
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const cap = Math.min(w, h) / 2;
  const tl = Math.min(radii.tl, cap);
  const tr = Math.min(radii.tr, cap);
  const br = Math.min(radii.br, cap);
  const bl = Math.min(radii.bl, cap);
  const r = round;
  return [
    `M${r(x + tl)},${r(y)}`,
    `H${r(x + w - tr)}`,
    tr ? `A${r(tr)},${r(tr)} 0 0 1 ${r(x + w)},${r(y + tr)}` : "",
    `V${r(y + h - br)}`,
    br ? `A${r(br)},${r(br)} 0 0 1 ${r(x + w - br)},${r(y + h)}` : "",
    `H${r(x + bl)}`,
    bl ? `A${r(bl)},${r(bl)} 0 0 1 ${r(x)},${r(y + h - bl)}` : "",
    `V${r(y + tl)}`,
    tl ? `A${r(tl)},${r(tl)} 0 0 1 ${r(x + tl)},${r(y)}` : "",
    "Z",
  ].join("");
}

export type BarEnd = "top" | "bottom" | "left" | "right" | "all" | "none";

/** Bar rounded only at its value end, the way the eye reads the bar's length. */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  end: BarEnd,
): string {
  const on = (corner: boolean) => (corner ? radius : 0);
  const all = end === "all";
  return roundedRectPath(x, y, width, height, {
    tl: on(all || end === "top" || end === "left"),
    tr: on(all || end === "top" || end === "right"),
    br: on(all || end === "bottom" || end === "right"),
    bl: on(all || end === "bottom" || end === "left"),
  });
}
