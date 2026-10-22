/**
 * Anchored positioning: pure placement maths (`computePlacement`, no DOM, runs in Node) and
 * `autoPosition`, which keeps a floating element placed against its anchor. All rectangles share
 * one coordinate space (the viewport). The maths is the React kit's, unchanged.
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
  arrow?: { x?: number; y?: number; centerOffset: number; shouldHide: boolean };
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
  // A centred content has no edge to offset from.
  if (align === "center") alignOffset = 0;
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
    const length = horizontal ? content.width : content.height;
    const wanted = (horizontal ? centerX - x : centerY - y) - arrow.width / 2;
    const max = Math.max(edgePadding, length - arrow.width - edgePadding);
    const placed = clamp(wanted, edgePadding, max);
    arrowResult = {
      ...(horizontal ? { x: placed } : { y: placed }),
      centerOffset: (horizontal ? centerX - x : centerY - y) - length / 2,
      // The arrow cannot point at the anchor centre (clamped to a corner or content too short).
      shouldHide: placed !== wanted || length < arrow.width + 2 * edgePadding,
    };
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
    availableWidth,
    availableHeight,
    transformOrigin,
    anchorHidden,
    ...(arrowResult ? { arrow: arrowResult } : {}),
  };
}

export interface AutoPositionOptions
  extends Omit<PlacementInput, "anchor" | "content" | "boundary" | "arrow"> {
  /** Element(s) the content must stay inside, intersected with the viewport. */
  boundary?: Element | null | Array<Element | null>;
  /** Arrow element inside the floating element; it is placed along the edge facing the anchor. */
  arrow?: HTMLElement | null;
  /** Arrow box size (base length, protrusion). Default 10 x 5. */
  arrowSize?: { width: number; height: number };
  arrowPadding?: number;
  /** Hide the content while the anchor is scrolled out of the boundary. */
  hideWhenDetached?: boolean;
  /** Called after each placement. */
  onPlaced?: (placement: Placement) => void;
}

function viewportRect(boundary: AutoPositionOptions["boundary"]): Rect {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const rects: Rect[] = [
    viewport
      ? {
          x: viewport.offsetLeft,
          y: viewport.offsetTop,
          width: viewport.width,
          height: viewport.height,
        }
      : { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight },
  ];
  for (const element of [boundary].flat()) {
    if (!element) continue;
    const { left, top, width, height } = element.getBoundingClientRect();
    rects.push({ x: left, y: top, width, height });
  }
  return intersectRects(rects);
}

/** `matches` that treats a selector the engine does not know as no match. */
function matchesSafe(node: Element, selector: string): boolean {
  try {
    return node.matches(selector);
  } catch {
    return false;
  }
}

/**
 * Top-left of the closest ancestor that is the containing block of fixed descendants (transform,
 * filter, contain...), in viewport coordinates. Top-layer elements (an open popover or dialog)
 * have none.
 */
function containingBlockOrigin(node: HTMLElement): { x: number; y: number } {
  if (matchesSafe(node, ":popover-open") || matchesSafe(node, ":modal")) return { x: 0, y: 0 };
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const creates =
      style.transform !== "none" ||
      style.perspective !== "none" ||
      style.filter !== "none" ||
      (style.backdropFilter !== undefined && style.backdropFilter !== "none") ||
      /paint|layout|strict|content/.test(style.contain) ||
      /transform|perspective|filter/.test(style.willChange) ||
      (style.containerType !== undefined && !["", "normal"].includes(style.containerType));
    if (creates) {
      const box = parent.getBoundingClientRect();
      return {
        x: box.left + parent.clientLeft - parent.scrollLeft,
        y: box.top + parent.clientTop - parent.scrollTop,
      };
    }
  }
  return { x: 0, y: 0 };
}

const BASE_SIDE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/**
 * Keeps `floating` placed against `anchor` (position: fixed, a `translate3d`), following scroll,
 * resize and size changes of both. Publishes `data-side`/`data-align` and the
 * `--ui-popper-available-width|height`, `--ui-popper-anchor-width|height` and
 * `--ui-popper-transform-origin` variables on `floating`, like the React `Popper`. Returns the cleanup.
 */
export function autoPosition(
  anchor: Element,
  floating: HTMLElement,
  options: AutoPositionOptions = {},
): () => void {
  const {
    arrow,
    arrowSize = { width: 10, height: 5 },
    arrowPadding = 0,
    hideWhenDetached = false,
    boundary: boundaryElements,
    onPlaced,
    ...placementOptions
  } = options;
  let frame = 0;
  const style = floating.style;
  style.position = "fixed";
  style.left = "0px";
  style.top = "0px";
  style.margin = "0px";

  const update = () => {
    const box = anchor.getBoundingClientRect();
    const anchorRect: Rect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const dir = options.dir ?? (getComputedStyle(anchor).direction === "rtl" ? "rtl" : "ltr");
    const boundary = viewportRect(boundaryElements);
    const place = () =>
      computePlacement({
        ...placementOptions,
        anchor: anchorRect,
        content: { width: floating.offsetWidth, height: floating.offsetHeight },
        boundary,
        dir,
        ...(arrow ? { arrow: { ...arrowSize, padding: arrowPadding } } : {}),
      });
    const publish = (placement: Placement) => {
      style.setProperty("--ui-popper-available-width", `${placement.availableWidth}px`);
      style.setProperty("--ui-popper-available-height", `${placement.availableHeight}px`);
      style.setProperty("--ui-popper-anchor-width", `${anchorRect.width}px`);
      style.setProperty("--ui-popper-anchor-height", `${anchorRect.height}px`);
      style.setProperty("--ui-popper-transform-origin", placement.transformOrigin);
    };
    let result = place();
    publish(result);
    // The available-size variables usually drive max-height: measure again with them applied.
    for (let pass = 0; pass < 2; pass++) {
      const again = place();
      if (again.x === result.x && again.y === result.y && again.side === result.side) break;
      result = again;
      publish(result);
    }
    const ratio = window.devicePixelRatio || 1;
    const snap = (value: number) => Math.round(value * ratio) / ratio;
    const origin = containingBlockOrigin(floating);
    style.transform = `translate3d(${snap(result.x - origin.x)}px, ${snap(result.y - origin.y)}px, 0)`;
    floating.dataset.side = result.side;
    floating.dataset.align = result.align;
    const hidden = hideWhenDetached && result.anchorHidden;
    style.visibility = hidden ? "hidden" : "";
    if (arrow) {
      const base = BASE_SIDE[result.side];
      arrow.dataset.side = result.side;
      arrow.style.position = "absolute";
      for (const side of ["top", "right", "bottom", "left"] as const)
        arrow.style[side] = side === base ? "0px" : "";
      if (result.arrow?.x !== undefined) arrow.style.left = `${result.arrow.x}px`;
      if (result.arrow?.y !== undefined) arrow.style.top = `${result.arrow.y}px`;
      arrow.style.visibility = result.arrow?.shouldHide ? "hidden" : "";
    }
    onPlaced?.(result);
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  update();
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(anchor);
  observer?.observe(floating);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    observer?.disconnect();
  };
}
