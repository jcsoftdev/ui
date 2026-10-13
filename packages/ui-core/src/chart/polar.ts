/**
 * Polar geometry shared by the radial charts (donut, pie, radial bars, gauge,
 * radar, polar area, funnel). Angles are radians with 0 at 12 o'clock, growing
 * clockwise, so a gauge or a donut reads the way a clock does.
 */
import { type Point, polarPoint, TAU } from "../internal/polar-math.ts";

export { type Point, polarPoint, TAU };

const round = (value: number) => Math.round(value * 100) / 100;

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
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

// --- donut centre text ---

const VALUE_WIDTH_EM = 0.62;
const CAPTION_WIDTH_EM = 0.58;
const LINE_GAP = 4;
const HOLE_MARGIN = 0.92;

export interface CenterFit {
  valueSize: number;
  captionSize: number;
  /** Characters of the caption that fit the hole; 0 hides it. */
  captionChars: number;
  /** Height of the whole text block, for vertical centring. */
  block: number;
}

/** Width of the chord of a circle of radius `radius` at distance `dy` from its centre. */
function chordWidth(radius: number, dy: number): number {
  return 2 * Math.sqrt(Math.max(0, radius * radius - dy * dy));
}

/**
 * Sizes the centre text of a donut so both lines sit inside the hole: the font shrinks from
 * `maxSize` until the value fits the chord at the block's outer edge, and the caption drops
 * characters (or disappears) when only the value fits.
 */
export function fitCenterText(
  inner: number,
  valueChars: number,
  captionChars: number,
  semi = false,
  maxSize = 34,
): CenterFit {
  const room = inner * HOLE_MARGIN;
  const captionSize = inner > 54 ? 12 : 10.5;
  const start = Math.min(maxSize, Math.max(15, Math.round(inner * 0.34)));

  for (let valueSize = start; valueSize >= 9; valueSize--) {
    const block = valueSize + LINE_GAP + captionSize;
    const width = chordWidth(room, semi ? block + 6 : block / 2);
    const chars = Math.floor(width / (captionSize * CAPTION_WIDTH_EM));
    if (valueChars * VALUE_WIDTH_EM * valueSize <= width && chars >= 6) {
      return { valueSize, captionSize, captionChars: Math.min(captionChars, chars), block };
    }
  }
  for (let valueSize = Math.min(maxSize, Math.round(inner * 0.5)); valueSize >= 8; valueSize--) {
    if (
      valueChars * VALUE_WIDTH_EM * valueSize <=
      chordWidth(room, semi ? valueSize + 6 : valueSize / 2)
    ) {
      return { valueSize, captionSize, captionChars: 0, block: valueSize };
    }
  }
  return { valueSize: 8, captionSize, captionChars: 0, block: 8 };
}

// --- gauge layout ---

export type GaugeVariant = "semi" | "three-quarter";
export type GaugeMode = "progress" | "needle";

const PAD = 12;
const HUB_RADIUS = 8;
const MIN_RADIUS = 40;
const CAPTION_SIZE = 12;
/** Height of a custom centre block (`centerContent`), which cannot be measured here. */
const CUSTOM_BLOCK_HEIGHT = 72;
const SIN_45 = Math.sin(Math.PI / 4);

export interface GaugeLayoutInput {
  width: number;
  height: number;
  variant: GaugeVariant;
  mode: GaugeMode;
  thickness: number;
  /** Min and max printed under the arc ends. */
  endLabels: boolean;
  /** The value block is custom HTML of unknown size. */
  customCenter: boolean;
  caption: boolean;
  bandLabel: boolean;
  /** Longest formatted value, in characters; sizes the value block width. */
  valueChars: number;
}

export interface GaugeLayout {
  radius: number;
  /** Stroke width of the track and value arc. */
  band: number;
  cx: number;
  cy: number;
  /** Radius of the arc centre line. */
  mid: number;
  valueSize: number;
  /** Distance from the centre to the top of the value block. */
  blockTop: number;
  /** Baselines relative to the centre. */
  valueDy: number;
  captionDy: number;
  labelDy: number;
  /** Where the custom centre block is anchored, relative to the centre. */
  customAnchor: "above" | "below" | "middle";
  customDy: number;
  customWidth: number;
  /** Needle reach from the hub; stops at the arc. */
  needleLength: number;
}

/** Min/max labels duplicate the tick labels at the arc ends, so ticks win. */
export function showEndLabels(minMaxLabels: boolean, ticks: number): boolean {
  return minMaxLabels && !(ticks >= 1);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Width of one tabular glyph as a share of the font size. */
const GLYPH_WIDTH = 0.6;

/**
 * Value font size: scales with the radius, but long values (currency) shrink
 * so the text stays inside the inner edge of the arc.
 */
function valueSizeFor(input: GaugeLayoutInput, radius: number, band: number): number {
  const bySize = clamp(radius * 0.34, 20, 52);
  if (input.customCenter || input.valueChars <= 0) return Math.round(bySize);
  const inner = input.mode === "needle" ? radius * 2 : (radius - band) * 2 - 16;
  const byWidth = inner / (input.valueChars * GLYPH_WIDTH);
  return Math.max(12, Math.min(Math.round(bySize), Math.floor(byWidth)));
}

interface Block {
  /** Distance from the centre to the top of the block. */
  top: number;
  valueDy: number;
  captionDy: number;
  labelDy: number;
  bottom: number;
}

function blockFor(input: GaugeLayoutInput, radius: number, valueSize: number): Block {
  const { variant, mode, customCenter } = input;
  const halfWidth = customCenter ? radius * 0.35 : (input.valueChars * GLYPH_WIDTH * valueSize) / 2;
  const needle = mode === "needle";
  let top: number;
  if (needle) {
    // Semicircle: the sweep is the upper half, anything under the hub is free.
    // Three-quarter: the free area is the wedge under the hub, so the top
    // corners of the block must sit below the 45 degree needle positions.
    top = variant === "semi" ? HUB_RADIUS + 14 : Math.max(HUB_RADIUS + 14, halfWidth + 12);
  } else if (variant === "semi") {
    top = customCenter ? -(CUSTOM_BLOCK_HEIGHT + 6) : -(valueSize * 0.9 + 6);
  } else {
    top = customCenter ? -CUSTOM_BLOCK_HEIGHT / 2 : -valueSize * 0.5;
  }
  const gap = needle ? 6 : 8;
  const valueDy = top + valueSize * 0.85;
  const captionDy = valueDy + gap + CAPTION_SIZE;
  const withCaption = input.caption ? captionDy : valueDy;
  const labelDy = withCaption + (input.caption || !needle ? 16 : 14);
  const last = input.bandLabel ? labelDy : withCaption;
  const bottom = customCenter ? top + CUSTOM_BLOCK_HEIGHT : last + 4;
  return { top, valueDy, captionDy, labelDy, bottom };
}

/** Distance from the centre to the lowest thing drawn. */
function below(input: GaugeLayoutInput, radius: number, band: number): number {
  const valueSize = valueSizeFor(input, radius, band);
  const mid = radius - band / 2;
  const arcBottom = input.variant === "semi" ? band / 2 : mid * SIN_45 + band / 2;
  const withLabels = arcBottom + (input.endLabels ? 19 : 2);
  const block = blockFor(input, radius, valueSize).bottom;
  const needleHub = input.mode === "needle" ? HUB_RADIUS : 0;
  return Math.max(withLabels, block, needleHub);
}

/**
 * Largest arc that fits the box in both directions, with the value block
 * placed where the needle and hub never reach it.
 */
export function layoutGauge(input: GaugeLayoutInput): GaugeLayout {
  const { width, height, thickness } = input;
  const maxByWidth = width / 2 - PAD - (input.endLabels ? 6 : 0);
  const fits = (radius: number) => {
    const band = Math.min(thickness, radius * 0.4);
    return radius + below(input, radius, band) + PAD * 2 <= height;
  };

  let radius = MIN_RADIUS;
  if (maxByWidth > MIN_RADIUS) {
    if (fits(maxByWidth)) {
      radius = maxByWidth;
    } else {
      let lo = MIN_RADIUS;
      let hi = maxByWidth;
      for (let i = 0; i < 30; i++) {
        const probe = (lo + hi) / 2;
        if (fits(probe)) lo = probe;
        else hi = probe;
      }
      radius = lo;
    }
  }

  const band = Math.min(thickness, radius * 0.4);
  const mid = radius - band / 2;
  const valueSize = valueSizeFor(input, radius, band);
  const block = blockFor(input, radius, valueSize);
  const extent = radius + below(input, radius, band);
  const cx = width / 2;
  const cy = Math.max(PAD + radius, (height - extent) / 2 + radius);

  const needle = input.mode === "needle";
  const customAnchor = needle || input.variant === "three-quarter" ? "below" : "above";
  const customWidth = Math.max(40, radius * 1.5);
  let customDy = block.top;
  let anchor: GaugeLayout["customAnchor"] = customAnchor;
  if (!needle && input.variant === "semi") customDy = -6;
  else if (!needle) {
    anchor = "middle";
    customDy = 0;
  }

  return {
    radius,
    band,
    cx,
    cy,
    mid,
    valueSize,
    blockTop: block.top,
    valueDy: block.valueDy,
    captionDy: block.captionDy,
    labelDy: block.labelDy,
    customAnchor: anchor,
    customDy,
    customWidth,
    needleLength: mid + band * 0.3,
  };
}

// --- radar scale ---

/** Rounds `value` up to a tidy multiple so `levels` rings land on round numbers. */
export function niceRadarMax(value: number, levels: number): number {
  if (!(value > 0)) return levels;
  const raw = value / levels;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * magnitude * levels;
}

// --- parliament (hemicycle) ---

/** Drops floating point noise (0.6000000000000001 -> 0.6). */
function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Shares `total` whole units between weights so they add up exactly
 * (largest remainder method). Negative or missing weights count as zero; all
 * zero weights get nothing.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const slots = Math.max(0, Math.round(total));
  if (sum <= 0 || slots === 0) return safe.map(() => 0);
  const exact = safe.map((weight) => (weight / sum) * slots);
  const counts = exact.map((share) => Math.floor(clean(share)));
  let left = slots - counts.reduce((acc, count) => acc + count, 0);
  const order = exact
    .map((share, index) => ({ index, rest: share - (counts[index] as number) }))
    .filter((entry) => (safe[entry.index] as number) > 0)
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; left > 0 && order.length > 0; i += 1, left -= 1) {
    const entry = order[i % order.length] as { index: number };
    counts[entry.index] = (counts[entry.index] as number) + 1;
  }
  return counts;
}

export interface Seat {
  /** Center relative to the hemicycle center, in outer-radius units (y grows downwards). */
  x: number;
  y: number;
  /** 0 is the innermost row. */
  row: number;
  /** Radians, pi on the left end, 0 on the right end. */
  angle: number;
}

export interface ParliamentLayout {
  rows: number;
  /** Radius of each seat, in outer-radius units. */
  seatRadius: number;
  /** Every seat ordered left to right, so consecutive groups form wedges. */
  seats: Seat[];
  /** Radius of every row, innermost first. */
  radii: number[];
}

function rowRadii(rows: number, inner: number): number[] {
  if (rows <= 1) return [1];
  return Array.from({ length: rows }, (_, row) => inner + ((1 - inner) * row) / (rows - 1));
}

/** Seats that fit in `rows` arcs when neighbours keep the radial row spacing. */
function arcCapacity(rows: number, inner: number): number {
  if (rows <= 1) return 5;
  const spacing = (1 - inner) / (rows - 1);
  return rowRadii(rows, inner).reduce(
    (acc, radius) => acc + Math.floor((Math.PI * radius) / spacing) + 1,
    0,
  );
}

/** Fewest arcs that hold `seats` without crowding. */
export function parliamentRows(seats: number, innerRatio = 0.4): number {
  if (seats <= 0) return 0;
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  let rows = 1;
  while (rows < 60 && arcCapacity(rows, inner) < seats) rows += 1;
  return rows;
}

/**
 * Seats of a hemicycle. Rows are auto-computed for the seat count (or fixed
 * with `rows`), each row gets seats in proportion to its length, and the
 * result is sorted left to right so assigning groups in order draws wedges.
 */
export function parliamentLayout(
  total: number,
  { rows: fixedRows, innerRatio = 0.4 }: { rows?: number; innerRatio?: number } = {},
): ParliamentLayout {
  const seatsWanted = Math.max(0, Math.floor(total));
  if (seatsWanted === 0) return { rows: 0, seatRadius: 0, seats: [], radii: [] };
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  const rows = Math.max(1, Math.min(seatsWanted, fixedRows ?? parliamentRows(seatsWanted, inner)));
  const radii = rowRadii(rows, inner);
  const perRow = largestRemainder(radii, seatsWanted);
  const seats: Seat[] = [];
  let spacing = rows > 1 ? (1 - inner) / (rows - 1) : Number.POSITIVE_INFINITY;
  perRow.forEach((count, row) => {
    const radius = radii[row] as number;
    if (count > 1) spacing = Math.min(spacing, (Math.PI * radius) / (count - 1));
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - (index * Math.PI) / (count - 1);
      seats.push({
        x: clean(radius * Math.cos(angle)),
        y: clean(-radius * Math.sin(angle)),
        row,
        angle,
      });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const seatRadius = Number.isFinite(spacing) ? spacing * 0.42 : 0.3;
  return { rows, seatRadius, seats, radii };
}

/** Category of each position when `counts` are laid one after the other. */
export function assignUnits(counts: readonly number[]): number[] {
  const owners: number[] = [];
  counts.forEach((count, category) => {
    for (let i = 0; i < count; i += 1) owners.push(category);
  });
  return owners;
}
