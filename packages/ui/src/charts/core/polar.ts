/**
 * Polar geometry shared by the radial charts (donut, pie, radial bars, gauge,
 * radar, polar area, funnel). Angles are radians with 0 at 12 o'clock, growing
 * clockwise, so a gauge or a donut reads the way a clock does.
 */
import type { Point } from "./path.js";

export const TAU = Math.PI * 2;

const round = (value: number) => Math.round(value * 100) / 100;

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Point at `radius` from (cx, cy) in the direction of `angle`. */
export function polarPoint(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}

/** Angle of the vector (cx, cy) -> (x, y), in [0, TAU). */
export function angleOf(cx: number, cy: number, x: number, y: number): number {
  const angle = Math.atan2(x - cx, cy - y);
  return angle < 0 ? angle + TAU : angle;
}

/** Wraps any angle into [0, TAU). */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

/** Index of the equal-width slot centred on `offset + i * TAU / count` that `angle` falls in. */
export function slotAt(angle: number, count: number, offset = 0): number {
  if (count <= 0) return -1;
  const slot = TAU / count;
  return Math.floor(normalizeAngle(angle - offset + slot / 2) / slot) % count;
}

export interface ArcSlice {
  index: number;
  value: number;
  /** Share of the total, 0-1. */
  fraction: number;
  /** Angles after the gap is taken off both sides. */
  start: number;
  end: number;
  /** Middle of the slice before the gap (the label direction). */
  mid: number;
}

export interface SliceOptions {
  startAngle?: number;
  endAngle?: number;
  /** Gap between neighbours, in radians (split between both sides). */
  padAngle?: number;
}

/**
 * Splits [startAngle, endAngle] proportionally to `values`. Non-finite and
 * non-positive values get a zero-width slice. A slice narrower than the gap
 * collapses onto its middle instead of inverting.
 */
export function sliceAngles(values: readonly number[], options: SliceOptions = {}): ArcSlice[] {
  const { startAngle = 0, endAngle = TAU, padAngle = 0 } = options;
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = clean.reduce((sum, value) => sum + value, 0);
  const span = endAngle - startAngle;
  const visible = clean.filter((value) => value > 0).length;
  // A single slice that fills the circle has no neighbour to leave a gap to.
  const pad = visible > 1 || Math.abs(span) < TAU - 1e-6 ? padAngle : 0;
  let cursor = startAngle;
  return clean.map((value, index) => {
    const fraction = total > 0 ? value / total : 0;
    const from = cursor;
    const to = cursor + span * fraction;
    cursor = to;
    const inset = Math.min(pad / 2, Math.abs(to - from) / 2);
    return {
      index,
      value,
      fraction,
      start: from + inset,
      end: to - inset,
      mid: (from + to) / 2,
    };
  });
}

export interface ArcSpec {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  /** Radius of the rounded corners; clamped so the shape stays valid. */
  cornerRadius?: number;
}

const at = (cx: number, cy: number, radius: number, angle: number): string => {
  const point = polarPoint(cx, cy, radius, angle);
  return `${round(point.x)} ${round(point.y)}`;
};

/** Appends circular arcs from `from` to `to`, split so none exceeds a half turn. */
function arcSegments(
  parts: string[],
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
  sweep: 0 | 1,
): void {
  const pieces = Math.max(1, Math.ceil(Math.abs(to - from) / (Math.PI * 0.99)));
  for (let step = 1; step <= pieces; step++) {
    const target = at(cx, cy, radius, from + ((to - from) * step) / pieces);
    parts.push(`A${round(radius)} ${round(radius)} 0 0 ${sweep} ${target}`);
  }
}

/**
 * Closed path of an annular sector (a pie wedge when `innerRadius` is 0),
 * with optional rounded corners. The corners are circles tangent to both the
 * arc and the radial edge, so rounding never changes the gap between slices.
 */
export function arcPath(spec: ArcSpec): string {
  const { cx, cy, startAngle: a0, endAngle: a1 } = spec;
  const r0 = Math.max(0, spec.innerRadius);
  const r1 = spec.outerRadius;
  const span = a1 - a0;
  if (!(span > 1e-6) || !(r1 > r0)) return "";

  if (span >= TAU - 1e-3) {
    const ring: string[] = [`M${at(cx, cy, r1, a0)}`];
    arcSegments(ring, cx, cy, r1, a0, a0 + TAU, 1);
    ring.push("Z");
    if (r0 > 0) {
      ring.push(`M${at(cx, cy, r0, a0)}`);
      arcSegments(ring, cx, cy, r0, a0, a0 - TAU, 0);
      ring.push("Z");
    }
    return ring.join("");
  }

  let rc = Math.max(0, Math.min(spec.cornerRadius ?? 0, (r1 - r0) / 2, r1 / 2));
  const fits = (radius: number) =>
    2 * Math.asin(radius / (r1 - radius)) <= span &&
    (r0 <= 0 || 2 * Math.asin(radius / (r0 + radius)) <= span);
  while (rc > 0.05 && !fits(rc)) rc *= 0.85;
  if (rc <= 0.05) rc = 0;

  const outerOffset = rc > 0 ? Math.asin(rc / (r1 - rc)) : 0;
  const innerOffset = rc > 0 && r0 > 0 ? Math.asin(rc / (r0 + rc)) : 0;
  const outerEdge = rc > 0 ? Math.sqrt((r1 - rc) ** 2 - rc ** 2) : r1;
  const innerEdge = rc > 0 && r0 > 0 ? Math.sqrt((r0 + rc) ** 2 - rc ** 2) : r0;
  const corner = (target: string) => `A${round(rc)} ${round(rc)} 0 0 1 ${target}`;

  const parts: string[] = [`M${at(cx, cy, r1, a0 + outerOffset)}`];
  arcSegments(parts, cx, cy, r1, a0 + outerOffset, a1 - outerOffset, 1);
  if (rc > 0) parts.push(corner(at(cx, cy, outerEdge, a1)));
  if (r0 > 0) {
    parts.push(`L${at(cx, cy, innerEdge, a1)}`);
    if (rc > 0) parts.push(corner(at(cx, cy, r0, a1 - innerOffset)));
    arcSegments(parts, cx, cy, r0, a1 - innerOffset, a0 + innerOffset, 0);
    if (rc > 0) parts.push(corner(at(cx, cy, innerEdge, a0)));
  } else {
    parts.push(`L${round(cx)} ${round(cy)}`);
  }
  parts.push(`L${at(cx, cy, outerEdge, a0)}`);
  if (rc > 0) parts.push(corner(at(cx, cy, r1, a0 + outerOffset)));
  parts.push("Z");
  return parts.join("");
}

/**
 * Open centre-line arc, meant to be stroked (`strokeLinecap="round"` gives
 * the rounded ends). Used by progress rings, tracks and gauge bands.
 */
export function arcLine(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  if (!(radius > 0) || !(Math.abs(endAngle - startAngle) > 1e-6)) return "";
  const sweep = endAngle > startAngle ? 1 : 0;
  const delta = Math.max(-TAU + 1e-3, Math.min(TAU - 1e-3, endAngle - startAngle));
  const parts: string[] = [`M${at(cx, cy, radius, startAngle)}`];
  arcSegments(parts, cx, cy, radius, startAngle, startAngle + delta, sweep);
  return parts.join("");
}

export interface LabelBox {
  /** Preferred vertical centre. */
  y: number;
  /** Height the label needs. */
  height: number;
}

/**
 * Vertical collision avoidance for a column of labels. Returns the adjusted
 * centres in the original order: labels are pushed down until they clear the
 * one above, then pushed back up from `max`, so nothing overlaps and the
 * column stays inside [min, max]. A column taller than the room keeps its
 * order and starts at `min`.
 */
export function spreadLabels(
  boxes: readonly LabelBox[],
  min: number,
  max: number,
  gap = 2,
): number[] {
  const order = boxes
    .map((_, index) => index)
    .sort((a, b) => (boxes[a]?.y ?? 0) - (boxes[b]?.y ?? 0));
  const ys = order.map((index) => boxes[index]?.y ?? 0);
  const half = order.map((index) => (boxes[index]?.height ?? 0) / 2);
  const h = (i: number) => half[i] ?? 0;

  for (let i = 0; i < ys.length; i++) {
    const floor = i === 0 ? min + h(0) : (ys[i - 1] ?? 0) + h(i - 1) + gap + h(i);
    ys[i] = Math.max(ys[i] ?? 0, floor);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    const ceil = i === ys.length - 1 ? max - h(i) : (ys[i + 1] ?? 0) - h(i + 1) - gap - h(i);
    ys[i] = Math.min(ys[i] ?? 0, ceil);
  }
  if (ys.length > 0 && (ys[0] ?? 0) - h(0) < min - 1e-9) {
    let cursor = min;
    for (let i = 0; i < ys.length; i++) {
      ys[i] = cursor + h(i);
      cursor += h(i) * 2 + gap;
    }
  }
  const out = new Array<number>(boxes.length).fill(0);
  order.forEach((original, i) => {
    out[original] = ys[i] ?? 0;
  });
  return out;
}

export interface FunnelStage {
  index: number;
  value: number;
  /** Main-axis start and end of the stage. */
  from: number;
  to: number;
  /** Cross-axis full widths at `from` and at `to`. */
  widthFrom: number;
  widthTo: number;
  /** Share of the first stage, 0-1. */
  ofFirst: number;
  /** Share of the previous stage, null for the first one. */
  conversion: number | null;
}

export interface FunnelOptions {
  /** Main-axis length available. */
  length: number;
  /** Cross-axis width of the largest stage. */
  thickness: number;
  gap?: number;
  /** `funnel` keeps a flat neck; `pyramid` tapers the last stage to a point. */
  variant?: "funnel" | "pyramid";
  /** Width of the last stage's far edge relative to its own width (funnel only). */
  neck?: number;
  /**
   * `true` (default) narrows each stage towards the next one (trapezoids, one
   * continuous outline); `false` keeps every stage a straight bar of its own width.
   */
  tapered?: boolean;
}

/**
 * Stage geometry along one axis: each stage spans its slice of `length`,
 * starts as wide as its own value and ends as wide as the next stage, so the
 * outline is continuous. Widths are proportional to value.
 */
export function funnelStages(values: readonly number[], options: FunnelOptions): FunnelStage[] {
  const { length, thickness, gap = 0, variant = "funnel", neck = 0.72, tapered = true } = options;
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(0, ...clean);
  const count = clean.length;
  const first = clean[0] ?? 0;
  const size = count > 0 ? Math.max(0, (length - gap * (count - 1)) / count) : 0;
  return clean.map((value, index) => {
    const next = clean[index + 1];
    const widthFrom = max > 0 ? (value / max) * thickness : 0;
    const widthTo =
      !tapered && variant !== "pyramid"
        ? widthFrom
        : next != null && max > 0
          ? (next / max) * thickness
          : variant === "pyramid"
            ? 0
            : widthFrom * neck;
    const previous = clean[index - 1];
    return {
      index,
      value,
      from: index * (size + gap),
      to: index * (size + gap) + size,
      widthFrom,
      widthTo,
      ofFirst: first > 0 ? value / first : 0,
      conversion: previous == null ? null : previous > 0 ? value / previous : 0,
    };
  });
}
