/**
 * Brushes. The rectangular brush drags corners into a rectangle in data units, turns it into one
 * range filter per axis (and back) and moves or resizes it from the keyboard. The index brush is
 * the overview window of a stock-style navigator: drag it, resize its handles, draw a new one.
 * The maths is pure; `attachBrush` and `attachIndexBrush` wire it to an element.
 */

export interface BrushPoint {
  x: number;
  y: number;
}

/** Normalized rectangle in data units (x0 <= x1, y0 <= y1). An infinite edge means "unbounded". */
export interface BrushRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type BrushRange = readonly [number, number];

export interface BrushRanges {
  x: BrushRange | null;
  y: BrushRange | null;
}

export type BrushKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** Rectangle spanned by two corners, whatever the drag direction. */
export function rectFromCorners(a: BrushPoint, b: BrushPoint): BrushRect {
  return {
    x0: Math.min(a.x, b.x),
    x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y),
    y1: Math.max(a.y, b.y),
  };
}

/** Keeps the rectangle inside the plot domains. */
export function clampRect(rect: BrushRect, xDomain: BrushRange, yDomain: BrushRange): BrushRect {
  const [xLo, xHi] = [Math.min(...xDomain), Math.max(...xDomain)];
  const [yLo, yHi] = [Math.min(...yDomain), Math.max(...yDomain)];
  return {
    x0: clamp(rect.x0, xLo, xHi),
    x1: clamp(rect.x1, xLo, xHi),
    y0: clamp(rect.y0, yLo, yHi),
    y1: clamp(rect.y1, yLo, yHi),
  };
}

export { rangesToRect, rectToRanges } from "./brush-rect.js";

export function rectContains(rect: BrushRect, x: number, y: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

/** True when the drag moved less than `min` pixels in both axes: it was a click. */
export function isClick(a: BrushPoint, b: BrushPoint, min = 4): boolean {
  return Math.abs(a.x - b.x) < min && Math.abs(a.y - b.y) < min;
}

/** Brush that keyboard users start from: the middle half of both domains. */
export function defaultBrush(xDomain: BrushRange, yDomain: BrushRange): BrushRect {
  const middle = (domain: BrushRange): [number, number] => {
    const lo = Math.min(...domain);
    const span = Math.max(...domain) - lo;
    return [lo + span * 0.25, lo + span * 0.75];
  };
  const [x0, x1] = middle(xDomain);
  const [y0, y1] = middle(yDomain);
  return { x0, x1, y0, y1 };
}

const STEP = 0.05;

function shift(lo: number, hi: number, delta: number, dLo: number, dHi: number): [number, number] {
  const size = hi - lo;
  const start = clamp(lo + delta, dLo, dHi - size);
  return [start, start + size];
}

function resize(lo: number, hi: number, delta: number, min: number, dHi: number): [number, number] {
  return [lo, clamp(hi + delta, Math.min(dHi, lo + min), dHi)];
}

/**
 * Keyboard step. Arrows move the rectangle by 5 % of the domain; with `grow` they resize it
 * instead (right and up make it larger, left and down smaller). It never leaves the domains and
 * never collapses below one step.
 */
export function stepBrush(
  rect: BrushRect,
  key: BrushKey,
  grow: boolean,
  xDomain: BrushRange,
  yDomain: BrushRange,
  fraction = STEP,
): BrushRect {
  const [xLo, xHi] = [Math.min(...xDomain), Math.max(...xDomain)];
  const [yLo, yHi] = [Math.min(...yDomain), Math.max(...yDomain)];
  const dx = (xHi - xLo) * fraction;
  const dy = (yHi - yLo) * fraction;
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const sign = key === "ArrowRight" || key === "ArrowUp" ? 1 : -1;
  if (horizontal) {
    const [x0, x1] = grow
      ? resize(rect.x0, rect.x1, sign * dx, dx, xHi)
      : shift(rect.x0, rect.x1, sign * dx, xLo, xHi);
    return { ...rect, x0, x1 };
  }
  const [y0, y1] = grow
    ? resize(rect.y0, rect.y1, sign * dy, dy, yHi)
    : shift(rect.y0, rect.y1, sign * dy, yLo, yHi);
  return { ...rect, y0, y1 };
}

export const TOUCH_BRUSH_DELAY = 350;
const TOUCH_SLOP = 10;

export type TouchIntent = "wait" | "brush" | "scroll";

/**
 * What a touch that went down at `from` means once it is at `to` after `elapsed` ms. Moving more
 * than a few pixels before the long-press delay is a scroll (the brush never starts); holding
 * still past the delay arms the brush, and from then on every move is part of it.
 */
export function touchIntent(
  from: BrushPoint,
  to: BrushPoint,
  elapsed: number,
  delay = TOUCH_BRUSH_DELAY,
  slop = TOUCH_SLOP,
): TouchIntent {
  if (elapsed >= delay) return "brush";
  return Math.hypot(to.x - from.x, to.y - from.y) > slop ? "scroll" : "wait";
}

/* ---------------------------------- index window (1D) ---------------------------------- */

/** Inclusive window over category indices. */
export type IndexRange = readonly [number, number];

export type IndexDrag =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "move"; offset: number }
  | { kind: "new"; anchor: number };

const MIN_SPAN = 1;

/** Orders and clamps a window to `0..count-1`, never narrower than one step. */
export function clampIndexRange(a: number, b: number, count: number): IndexRange {
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(count - 1, Math.max(a, b));
  if (hi - lo >= MIN_SPAN) return [lo, hi];
  return lo + MIN_SPAN <= count - 1 ? [lo, lo + MIN_SPAN] : [Math.max(0, hi - MIN_SPAN), hi];
}

/**
 * What a pointer press at pixel `x` grabs: the start or end handle (within `slop` pixels), the
 * window body, or empty track (draws a new window). `x0` and `x1` are the handle pixels.
 */
export function pickIndexDrag(
  x: number,
  x0: number,
  x1: number,
  indexAt: (pixel: number) => number,
  start: number,
  slop = 10,
): IndexDrag {
  if (Math.abs(x - x0) <= slop) return { kind: "start" };
  if (Math.abs(x - x1) <= slop) return { kind: "end" };
  if (x > x0 && x < x1) return { kind: "move", offset: indexAt(x) - start };
  return { kind: "new", anchor: indexAt(x) };
}

/** The window after dragging `mode` to `index`, or `null` when it did not change. */
export function dragIndexRange(
  mode: IndexDrag,
  index: number,
  [start, end]: IndexRange,
  count: number,
): IndexRange | null {
  if (mode.kind === "start") return clampIndexRange(Math.min(index, end - MIN_SPAN), end, count);
  if (mode.kind === "end") return clampIndexRange(start, Math.max(index, start + MIN_SPAN), count);
  if (mode.kind === "new") return clampIndexRange(mode.anchor, index, count);
  const span = end - start;
  const lo = Math.min(Math.max(0, index - mode.offset), count - 1 - span);
  return lo === start ? null : [lo, lo + span];
}

/**
 * Keyboard step: arrows pan the window by one index, Shift+arrows resize its end, Home and End
 * jump it to the ends. Returns `null` for any other key.
 */
export function stepIndexRange(
  [from, to]: IndexRange,
  key: string,
  grow: boolean,
  count: number,
): IndexRange | null {
  const span = to - from;
  const by = (delta: number): IndexRange => {
    if (grow) return clampIndexRange(from, Math.max(from + MIN_SPAN, to + delta), count);
    const lo = Math.min(Math.max(0, from + delta), count - 1 - span);
    return [lo, lo + span];
  };
  if (key === "ArrowRight" || key === "ArrowUp") return by(1);
  if (key === "ArrowLeft" || key === "ArrowDown") return by(-1);
  if (key === "Home") return [0, span];
  if (key === "End") return [count - 1 - span, count - 1];
  return null;
}

/* ------------------------------------ DOM wiring ------------------------------------ */

export interface BrushPlot {
  /** Plot box in pixels, relative to the element's top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrushOptions {
  xDomain: BrushRange;
  yDomain: BrushRange;
  /** Plot box inside the element (its margins); the whole element when omitted. */
  plot?: () => BrushPlot;
  /** Plot pixel to data. Default: linear over the domains, y growing upwards. */
  invert?: (point: BrushPoint) => BrushPoint;
  /** Committed selection (controlled); `null` for none. */
  value?: BrushRect | null;
  /** The selection was committed (drag end, Enter) or cleared (`null`: click or Escape). */
  onChange?: (rect: BrushRect | null) => void;
  /** The rectangle being drawn or moved by keys, before it is committed; `null` when it ends. */
  onDraft?: (rect: BrushRect | null) => void;
  /** Hold time before a touch starts brushing; 0 brushes at once. Default 350 ms. */
  touchDelay?: number;
  /** Element that takes the keys (arrows, Shift to resize, Enter, Escape). Default: the element. */
  keyTarget?: HTMLElement;
}

export interface Brush {
  update(patch: Partial<BrushOptions>): void;
  /** The uncommitted rectangle, if any. */
  readonly draft: BrushRect | null;
  destroy(): void;
}

function capture(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The pointer is already gone (synthetic or cancelled): the drag still tracks the element.
  }
}

/**
 * Rectangular brush over an element: drag draws a rectangle, a click clears it, a touch must be
 * held for `touchDelay` first so a swipe still scrolls. From the keyboard, arrows start and move a
 * draft, Shift+arrows resize it, Enter commits it and Escape clears.
 */
export function attachBrush(element: HTMLElement, initial: BrushOptions): Brush {
  let options = initial;
  let draft: BrushRect | null = null;
  let from: BrushPoint | null = null;
  let touch: {
    from: BrushPoint;
    since: number;
    armed: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const plot = (): BrushPlot =>
    options.plot?.() ?? { x: 0, y: 0, width: element.clientWidth, height: element.clientHeight };
  const invert = (point: BrushPoint): BrushPoint => {
    if (options.invert) return options.invert(point);
    const { width, height } = plot();
    const [x0, x1] = options.xDomain;
    const [y0, y1] = options.yDomain;
    return {
      x: x0 + (width ? point.x / width : 0) * (x1 - x0),
      y: y1 - (height ? point.y / height : 0) * (y1 - y0),
    };
  };
  const setDraft = (next: BrushRect | null) => {
    draft = next;
    options.onDraft?.(next);
  };
  const applied = () =>
    options.value ? clampRect(options.value, options.xDomain, options.yDomain) : null;
  const rectAt = (a: BrushPoint, b: BrushPoint) =>
    clampRect(rectFromCorners(invert(a), invert(b)), options.xDomain, options.yDomain);
  const inside = (event: PointerEvent): BrushPoint | null => {
    const box = element.getBoundingClientRect();
    const area = plot();
    const x = event.clientX - box.left - area.x;
    const y = event.clientY - box.top - area.y;
    return x < 0 || y < 0 || x > area.width || y > area.height ? null : { x, y };
  };
  const clampedPoint = (event: PointerEvent): BrushPoint => {
    const box = element.getBoundingClientRect();
    const area = plot();
    return {
      x: clamp(event.clientX - box.left - area.x, 0, area.width),
      y: clamp(event.clientY - box.top - area.y, 0, area.height),
    };
  };
  const cancelTouch = () => {
    if (touch) clearTimeout(touch.timer);
    touch = null;
  };
  const touchDelay = () => options.touchDelay ?? TOUCH_BRUSH_DELAY;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const start = inside(event);
    if (!start) return;
    if (event.pointerType === "touch" && touchDelay() > 0) {
      cancelTouch();
      const pointerId = event.pointerId;
      touch = {
        from: start,
        since: event.timeStamp,
        armed: false,
        timer: setTimeout(() => {
          if (!touch) return;
          touch.armed = true;
          from = start;
          capture(element, pointerId);
          if (typeof navigator !== "undefined") navigator.vibrate?.(8);
        }, touchDelay()),
      };
      return;
    }
    capture(element, event.pointerId);
    from = start;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (touch && !touch.armed) {
      const intent = touchIntent(
        touch.from,
        clampedPoint(event),
        event.timeStamp - touch.since,
        touchDelay(),
      );
      if (intent === "scroll") cancelTouch();
      return;
    }
    if (!from) return;
    const to = clampedPoint(event);
    if (!isClick(from, to)) setDraft(rectAt(from, to));
  };

  const onPointerUp = (event: PointerEvent) => {
    if (touch && !touch.armed) {
      cancelTouch();
      if (options.value) options.onChange?.(null);
      return;
    }
    cancelTouch();
    if (!from) return;
    const start = from;
    from = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    const to = clampedPoint(event);
    setDraft(null);
    if (isClick(start, to)) {
      if (options.value) options.onChange?.(null);
      return;
    }
    options.onChange?.(rectAt(start, to));
  };

  const onPointerCancel = () => {
    cancelTouch();
    from = null;
    setDraft(null);
  };

  // Once a long press armed the brush, the browser must not turn the drag into a page scroll.
  const onTouchMove = (event: TouchEvent) => {
    if (touch?.armed && event.cancelable) event.preventDefault();
  };
  const onContextMenu = (event: Event) => {
    if (touch) event.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      if (options.value) options.onChange?.(null);
      return;
    }
    if (event.key === "Enter") {
      if (!draft) return;
      event.preventDefault();
      const done = draft;
      setDraft(null);
      options.onChange?.(done);
      return;
    }
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown"
    ) {
      return;
    }
    event.preventDefault();
    const base = draft ?? applied() ?? defaultBrush(options.xDomain, options.yDomain);
    setDraft(stepBrush(base, event.key, event.shiftKey, options.xDomain, options.yDomain));
  };

  const keys = options.keyTarget ?? element;
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerCancel);
  element.addEventListener("contextmenu", onContextMenu);
  element.addEventListener("touchmove", onTouchMove, { passive: false });
  keys.addEventListener("keydown", onKeyDown);

  return {
    update(patch) {
      options = { ...options, ...patch };
    },
    get draft() {
      return draft;
    },
    destroy() {
      cancelTouch();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      element.removeEventListener("contextmenu", onContextMenu);
      element.removeEventListener("touchmove", onTouchMove);
      keys.removeEventListener("keydown", onKeyDown);
    },
  };
}

export interface IndexBrushOptions {
  /** Number of categories of the full, un-zoomed data. */
  count: number;
  /** Selected window, inclusive indices. */
  range: IndexRange;
  onChange: (range: IndexRange) => void;
  /** Category index under a pixel measured from the track's left edge. */
  indexAt: (pixel: number) => number;
  /** Pixel of the centre of category `index`, from the track's left edge. */
  position: (index: number) => number;
  /** Distance from the element's left edge to the track (the plot margin). Default 0. */
  offset?: number;
  /** Pixels around a handle that still grab it. Default 10. */
  slop?: number;
}

export interface IndexBrush {
  update(patch: Partial<IndexBrushOptions>): void;
  destroy(): void;
}

/**
 * Index window over an element. Drag the window to pan, its handles to resize, or anywhere outside
 * to draw a new window. Keys on the element: arrows pan, Shift+arrows resize the end, Home/End jump.
 * Give the element `role="slider"` and a `tabindex` for the keys to reach it.
 */
export function attachIndexBrush(element: HTMLElement, initial: IndexBrushOptions): IndexBrush {
  let options = initial;
  let latest = initial.range;
  let drag: IndexDrag | null = null;

  const localX = (event: PointerEvent) =>
    event.clientX - element.getBoundingClientRect().left - (options.offset ?? 0);
  const emit = (next: IndexRange) => {
    latest = next;
    options.onChange(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const [start, end] = latest;
    drag = pickIndexDrag(
      localX(event),
      options.position(start),
      options.position(end),
      options.indexAt,
      start,
      options.slop,
    );
    capture(element, event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    const next = dragIndexRange(drag, options.indexAt(localX(event)), latest, options.count);
    if (next) emit(next);
  };
  const onPointerUp = (event: PointerEvent) => {
    drag = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // Read the latest window: key repeats can arrive before the host re-renders.
    const next = stepIndexRange(latest, event.key, event.shiftKey, options.count);
    if (!next) return;
    event.preventDefault();
    emit(next);
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  element.addEventListener("keydown", onKeyDown);

  return {
    update(patch) {
      options = { ...options, ...patch };
      if (patch.range) latest = patch.range;
    },
    destroy() {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("keydown", onKeyDown);
    },
  };
}
