export type TableShape = "round" | "square" | "rect" | "bar";

export interface Chair {
  cx: number;
  cy: number;
  rotate: number;
  width: number;
  height: number;
  circle: boolean;
}

export interface GlyphLayout {
  width: number;
  height: number;
  body: { x: number; y: number; width: number; height: number; round: boolean };
  chairs: Chair[];
}

export const UNIT = 100;
export const CHAIR_DEPTH = 18;
export const CHAIR_WIDTH = 26;
export const CHAIR_GAP = 6;
const INSET = CHAIR_DEPTH + CHAIR_GAP;

type Side = "top" | "bottom" | "left" | "right";

function spread(count: number, length: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * length);
}

function chairWidthFor(count: number, length: number): number {
  if (count === 0) return CHAIR_WIDTH;
  return Math.max(6, Math.min(CHAIR_WIDTH, length / count - CHAIR_GAP));
}

function sideChair(side: Side, along: number, w: number, h: number, size: number): Chair {
  const horizontal = side === "top" || side === "bottom";
  const half = CHAIR_DEPTH / 2;
  const cx = horizontal ? along : side === "left" ? half : w - half;
  const cy = horizontal ? (side === "top" ? half : h - half) : along;
  return {
    cx,
    cy,
    rotate: horizontal ? 0 : 90,
    width: size,
    height: CHAIR_DEPTH,
    circle: false,
  };
}

/** Chairs per side of a square table: one per side up to four seats, then spread evenly with the remainder going top, bottom, left, right. */
export function squareSideCounts(seats: number): Record<Side, number> {
  const order: Side[] = ["top", "bottom", "left", "right"];
  const counts: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  const base = Math.floor(seats / 4);
  const extra = seats % 4;
  order.forEach((side, i) => {
    counts[side] = base + (i < extra ? 1 : 0);
  });
  return counts;
}

/** Chairs of a rect table: one at each end, the rest split between the two long sides (top gets the odd one). */
export function rectSideCounts(seats: number): Record<Side, number> {
  const ends = Math.min(seats, 2);
  const rest = seats - ends;
  return {
    left: ends >= 1 ? 1 : 0,
    right: ends >= 2 ? 1 : 0,
    top: Math.ceil(rest / 2),
    bottom: Math.floor(rest / 2),
  };
}

function sidedChairs(counts: Record<Side, number>, w: number, h: number): Chair[] {
  const out: Chair[] = [];
  for (const side of ["top", "bottom", "left", "right"] as const) {
    const horizontal = side === "top" || side === "bottom";
    const length = horizontal ? w - 2 * INSET : h - 2 * INSET;
    const offset = INSET;
    const size = chairWidthFor(counts[side], length);
    for (const along of spread(counts[side], length)) {
      out.push(sideChair(side, offset + along, w, h, size));
    }
  }
  return out;
}

function roundLayout(seats: number, w: number, h: number): GlyphLayout {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.max(8, Math.min(w, h) / 2 - INSET);
  const orbit = radius + CHAIR_GAP + CHAIR_DEPTH / 2;
  const size = chairWidthFor(seats, 2 * Math.PI * orbit);
  const chairs = Array.from({ length: seats }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / seats;
    return {
      cx: cx + orbit * Math.cos(angle),
      cy: cy + orbit * Math.sin(angle),
      rotate: (angle * 180) / Math.PI + 90,
      width: size,
      height: CHAIR_DEPTH,
      circle: false,
    };
  });
  return {
    width: w,
    height: h,
    body: { x: cx - radius, y: cy - radius, width: 2 * radius, height: 2 * radius, round: true },
    chairs,
  };
}

function barLayout(seats: number, w: number, h: number): GlyphLayout {
  const counterHeight = Math.max(14, h * 0.4);
  const stool = Math.min(
    CHAIR_WIDTH * 0.8,
    h - counterHeight - CHAIR_GAP,
    w / Math.max(seats, 1) - 4,
  );
  const diameter = Math.max(6, stool);
  const chairs = spread(seats, w - 2 * CHAIR_GAP).map((x) => ({
    cx: CHAIR_GAP + x,
    cy: counterHeight + CHAIR_GAP + diameter / 2,
    rotate: 0,
    width: diameter,
    height: diameter,
    circle: true,
  }));
  return {
    width: w,
    height: h,
    body: { x: 0, y: 0, width: w, height: counterHeight, round: false },
    chairs,
  };
}

function transpose(layout: GlyphLayout): GlyphLayout {
  return {
    width: layout.height,
    height: layout.width,
    body: {
      x: layout.body.y,
      y: layout.body.x,
      width: layout.body.height,
      height: layout.body.width,
      round: layout.body.round,
    },
    chairs: layout.chairs.map((c) => ({
      ...c,
      cx: c.cy,
      cy: c.cx,
      rotate: c.circle ? 0 : c.rotate === 0 ? 90 : 0,
    })),
  };
}

function framed(counts: Record<Side, number>, w: number, h: number): GlyphLayout {
  return {
    width: w,
    height: h,
    body: { x: INSET, y: INSET, width: w - 2 * INSET, height: h - 2 * INSET, round: false },
    chairs: sidedChairs(counts, w, h),
  };
}

/**
 * Geometry of a table glyph in a `width` x `height` box (100 units per grid cell). Round tables
 * space chairs radially; square ones put a chair per side up to four, then spread; rect tables
 * seat one at each end and split the rest along the long sides; bars line stools up in a row.
 * Rect and bar follow the longer axis of the box.
 */
export function glyphLayout(
  shape: TableShape,
  seats: number,
  width: number,
  height: number,
): GlyphLayout {
  const count = Math.max(0, Math.floor(seats));
  if (shape === "round") return roundLayout(count, width, height);
  if (shape === "square") return framed(squareSideCounts(count), width, height);
  const vertical = height > width;
  const w = vertical ? height : width;
  const h = vertical ? width : height;
  const layout = shape === "rect" ? framed(rectSideCounts(count), w, h) : barLayout(count, w, h);
  return vertical ? transpose(layout) : layout;
}
