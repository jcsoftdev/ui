/**
 * Pure placement maths for anchored floating content. No DOM access, so it runs
 * in node tests. All rectangles share one coordinate space (the viewport).
 */

export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";
export type Direction = "ltr" | "rtl";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Padding = number | Partial<Record<Side, number>>;

export interface ArrowGeometry {
  /** Length of the arrow base, along the edge of the content. */
  width: number;
  /** How far the arrow protrudes from the content. It is added to `sideOffset`. */
  height: number;
  /** Minimum distance between the arrow and the corners of the content. */
  padding?: number;
}

export interface PlacementInput {
  anchor: Rect;
  content: Size;
  /** Area content must stay inside (the viewport, or an intersection of elements). */
  boundary: Rect;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: Padding;
  /** Flip to the opposite side and shift along the edge to stay in the boundary. Defaults to true. */
  avoidCollisions?: boolean;
  /** `partial` keeps the content touching the anchor while shifting; `always` never lets go of the boundary. */
  sticky?: "partial" | "always";
  dir?: Direction;
  arrow?: ArrowGeometry;
}

export interface Placement {
  x: number;
  y: number;
  side: Side;
  align: Align;
  /** Free width/height for the content on the placed side, for `max-width`/`max-height`. */
  availableWidth: number;
  availableHeight: number;
  /** `transform-origin` pointing at the anchor centre, in content-local pixels. */
  transformOrigin: string;
  /** The anchor is entirely outside the boundary (scrolled out of view). */
  anchorHidden: boolean;
  /** Arrow offset along the content edge (`x` for top/bottom, `y` for left/right). */
  arrow?: { x?: number; y?: number; centerOffset: number };
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function normalizePadding(padding: Padding | undefined): Record<Side, number> {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
}

/** Intersection of rectangles; an empty intersection collapses to a zero-sized rect. */
export function intersectRects(rects: readonly Rect[]): Rect {
  let left = Number.NEGATIVE_INFINITY;
  let top = Number.NEGATIVE_INFINITY;
  let right = Number.POSITIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    left = Math.max(left, rect.x);
    top = Math.max(top, rect.y);
    right = Math.min(right, rect.x + rect.width);
    bottom = Math.min(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Where the content's top-left corner goes for a side and alignment, before collision handling. */
function coordsFor(
  side: Side,
  align: Align,
  anchor: Rect,
  content: Size,
  offset: number,
  alignOffset: number,
  dir: Direction,
): { x: number; y: number } {
  const rtl = dir === "rtl";
  if (side === "top" || side === "bottom") {
    // Along the inline axis, `start` follows the reading direction.
    let x: number;
    if (align === "center") {
      x = anchor.x + (anchor.width - content.width) / 2 + (rtl ? -alignOffset : alignOffset);
    } else if ((align === "start") !== rtl) {
      x = anchor.x + alignOffset;
    } else {
      x = anchor.x + anchor.width - content.width - alignOffset;
    }
    const y =
      side === "bottom" ? anchor.y + anchor.height + offset : anchor.y - content.height - offset;
    return { x, y };
  }
  let y: number;
  if (align === "center") y = anchor.y + (anchor.height - content.height) / 2 + alignOffset;
  else if (align === "start") y = anchor.y + alignOffset;
  else y = anchor.y + anchor.height - content.height - alignOffset;
  const x = side === "right" ? anchor.x + anchor.width + offset : anchor.x - content.width - offset;
  return { x, y };
}

/** Positive when the content sticks out of the boundary on its main side. */
function mainOverflow(
  side: Side,
  at: { x: number; y: number },
  content: Size,
  inner: { left: number; top: number; right: number; bottom: number },
): number {
  if (side === "top") return inner.top - at.y;
  if (side === "bottom") return at.y + content.height - inner.bottom;
  if (side === "left") return inner.left - at.x;
  return at.x + content.width - inner.right;
}

export function computePlacement(input: PlacementInput): Placement {
  const {
    anchor,
    content,
    boundary,
    side: preferredSide = "bottom",
    align = "center",
    sideOffset = 0,
    alignOffset = 0,
    avoidCollisions = true,
    sticky = "partial",
    dir = "ltr",
    arrow,
  } = input;
  const pad = normalizePadding(input.collisionPadding);
  const inner = {
    left: boundary.x + pad.left,
    top: boundary.y + pad.top,
    right: boundary.x + boundary.width - pad.right,
    bottom: boundary.y + boundary.height - pad.bottom,
  };
  const offset = sideOffset + (arrow?.height ?? 0);
  const at = (side: Side) => coordsFor(side, align, anchor, content, offset, alignOffset, dir);

  let side = preferredSide;
  let { x, y } = at(side);

  if (avoidCollisions) {
    const overflow = mainOverflow(side, { x, y }, content, inner);
    if (overflow > 0) {
      const other = OPPOSITE[side];
      const otherAt = at(other);
      if (mainOverflow(other, otherAt, content, inner) < overflow) {
        side = other;
        ({ x, y } = otherAt);
      }
    }

    // Shift along the edge. Content larger than the boundary pins to its start edge.
    if (side === "top" || side === "bottom") {
      const shifted = clamp(x, inner.left, Math.max(inner.left, inner.right - content.width));
      x =
        sticky === "partial"
          ? clamp(shifted, anchor.x - content.width, anchor.x + anchor.width)
          : shifted;
    } else {
      const shifted = clamp(y, inner.top, Math.max(inner.top, inner.bottom - content.height));
      y =
        sticky === "partial"
          ? clamp(shifted, anchor.y - content.height, anchor.y + anchor.height)
          : shifted;
    }
  }

  const horizontal = side === "top" || side === "bottom";
  const innerWidth = Math.max(0, inner.right - inner.left);
  const innerHeight = Math.max(0, inner.bottom - inner.top);
  let availableWidth = innerWidth;
  let availableHeight = innerHeight;
  if (side === "bottom") availableHeight = inner.bottom - (anchor.y + anchor.height + offset);
  else if (side === "top") availableHeight = anchor.y - offset - inner.top;
  else if (side === "right") availableWidth = inner.right - (anchor.x + anchor.width + offset);
  else availableWidth = anchor.x - offset - inner.left;

  const centerX = anchor.x + anchor.width / 2;
  const centerY = anchor.y + anchor.height / 2;
  const originX = clamp(centerX - x, 0, content.width);
  const originY = clamp(centerY - y, 0, content.height);
  const transformOrigin = horizontal
    ? `${originX}px ${side === "bottom" ? "0px" : `${content.height}px`}`
    : `${side === "right" ? "0px" : `${content.width}px`} ${originY}px`;

  let arrowResult: Placement["arrow"];
  if (arrow) {
    const edgePadding = arrow.padding ?? 0;
    if (horizontal) {
      const max = Math.max(edgePadding, content.width - arrow.width - edgePadding);
      arrowResult = {
        x: clamp(centerX - x - arrow.width / 2, edgePadding, max),
        centerOffset: centerX - x - content.width / 2,
      };
    } else {
      const max = Math.max(edgePadding, content.height - arrow.width - edgePadding);
      arrowResult = {
        y: clamp(centerY - y - arrow.width / 2, edgePadding, max),
        centerOffset: centerY - y - content.height / 2,
      };
    }
  }

  const anchorHidden =
    anchor.x + anchor.width <= boundary.x ||
    anchor.x >= boundary.x + boundary.width ||
    anchor.y + anchor.height <= boundary.y ||
    anchor.y >= boundary.y + boundary.height;

  return {
    x,
    y,
    side,
    align,
    availableWidth: Math.max(0, availableWidth),
    availableHeight: Math.max(0, availableHeight),
    transformOrigin,
    anchorHidden,
    ...(arrowResult ? { arrow: arrowResult } : {}),
  };
}
