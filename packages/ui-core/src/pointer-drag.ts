/** Where a drag is, in client pixels and as ratios (0..1) of the bounds element. */
export interface DragPoint {
  clientX: number;
  clientY: number;
  /** Distance from where the drag started. */
  dx: number;
  dy: number;
  /** Position inside the bounds, clamped to 0..1. `0` when the bounds have no size. */
  ratioX: number;
  ratioY: number;
}

export interface PointerDragOptions {
  /** A disabled drag ignores presses. */
  disabled?: () => boolean;
  /** Element the ratios are measured against. Default: the target. */
  bounds?: () => Element | null | undefined;
  /** Mouse button that starts a drag. Default 0 (primary). Touch and pen always start. */
  button?: number;
  /** Return `false` to refuse the press. */
  onStart?: (point: DragPoint, event: PointerEvent) => boolean | undefined;
  onMove?: (point: DragPoint, event: PointerEvent) => void;
  /**
   * Distance in px the pointer must travel before the press becomes a drag. Until then nothing is
   * captured and no move or end is reported, so a tap or click on a child still reaches it.
   * Default 0 (capture on press).
   */
  slop?: number;
  /** `cancelled` is true for `pointercancel` and for {@link PointerDrag.cancel}. */
  onEnd?: (point: DragPoint, cancelled: boolean) => void;
}

export interface PointerDrag {
  readonly dragging: boolean;
  /** Ends the current drag as cancelled. */
  cancel(): void;
  destroy(): void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Pointer drag with capture: the press captures the pointer so the drag keeps tracking outside the
 * element, and `pointerup`, `pointercancel` and a lost capture all end it. Emits client deltas and
 * 0..1 ratios of a bounds element, which is what a slider, a resizer or a swipe needs. Add
 * keyboard parity with {@link keyboardValue}. Returns a controller; `destroy()` removes everything.
 */
export function createPointerDrag(
  target: HTMLElement,
  options: PointerDragOptions = {},
): PointerDrag {
  let pointerId: number | undefined;
  let originX = 0;
  let originY = 0;
  let last: DragPoint | undefined;
  let pending = false;

  const point = (event: PointerEvent): DragPoint => {
    const rect = (options.bounds?.() ?? target).getBoundingClientRect();
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      dx: event.clientX - originX,
      dy: event.clientY - originY,
      ratioX: rect.width > 0 ? clamp01((event.clientX - rect.left) / rect.width) : 0,
      ratioY: rect.height > 0 ? clamp01((event.clientY - rect.top) / rect.height) : 0,
    };
  };

  const finish = (cancelled: boolean) => {
    if (pointerId === undefined) return;
    const id = pointerId;
    pointerId = undefined;
    if (pending) {
      pending = false;
      last = undefined;
      return;
    }
    try {
      if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    } catch {}
    if (last) options.onEnd?.(last, cancelled);
    last = undefined;
  };

  const onDown = (event: PointerEvent) => {
    if (pointerId !== undefined || options.disabled?.()) return;
    if (event.pointerType === "mouse" && event.button !== (options.button ?? 0)) return;
    originX = event.clientX;
    originY = event.clientY;
    const start = point(event);
    if (options.onStart?.(start, event) === false) return;
    pointerId = event.pointerId;
    last = start;
    if ((options.slop ?? 0) > 0) pending = true;
    else capture(event.pointerId);
  };
  const capture = (id: number) => {
    try {
      target.setPointerCapture(id);
    } catch {
      // A synthetic or already ended pointer cannot be captured; the drag still tracks the target.
    }
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    last = point(event);
    if (pending) {
      if (Math.hypot(last.dx, last.dy) < (options.slop ?? 0)) return;
      pending = false;
      capture(event.pointerId);
    }
    options.onMove?.(last, event);
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    last = point(event);
    finish(event.type === "pointercancel");
  };
  const onLost = (event: PointerEvent) => {
    if (event.pointerId === pointerId) finish(true);
  };

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);
  target.addEventListener("lostpointercapture", onLost);
  return {
    get dragging() {
      return pointerId !== undefined;
    },
    cancel: () => finish(true),
    destroy() {
      finish(true);
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      target.removeEventListener("lostpointercapture", onLost);
    },
  };
}

export type RangeValue = [number, number];

function decimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Snaps to the nearest multiple of `step` counted from `min` (or from 0 when `min` is not
 * finite), kept inside [min, max]. Either bound may be infinite. Same maths as the React kit.
 */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clampValue(value, min, max);
  const base = Number.isFinite(min) ? min : 0;
  const places = Math.max(decimals(step), decimals(base));
  const snapped = Number((base + Math.round((value - base) / step) * step).toFixed(places));
  if (snapped > max) {
    // The last step may not land on `max`; fall back to the largest valid multiple.
    return Number((base + Math.floor((max - base) / step) * step).toFixed(places));
  }
  return clampValue(snapped, min, max);
}

/** Position of a value along the track, 0..1. */
export function ratioOf(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clampValue((value - min) / (max - min), 0, 1);
}

export function valueFromRatio(ratio: number, min: number, max: number, step: number): number {
  return snapToStep(min + clampValue(ratio, 0, 1) * (max - min), min, max, step);
}

/** Moves one thumb of a range, never crossing the other one and keeping `minGap` between them. */
export function setRangeThumb(
  values: RangeValue,
  index: 0 | 1,
  next: number,
  min: number,
  max: number,
  step: number,
  minGap = 0,
): RangeValue {
  const snapped = snapToStep(next, min, max, step);
  if (index === 0) return [Math.min(snapped, values[1] - minGap), values[1]];
  return [values[0], Math.max(snapped, values[0] + minGap)];
}

/** Thumb a pointer press should grab: the closest one; on a tie, the one the press is outside of. */
export function nearestThumb(values: RangeValue, target: number): 0 | 1 {
  const d0 = Math.abs(values[0] - target);
  const d1 = Math.abs(values[1] - target);
  if (d0 === d1) return target < values[0] ? 0 : 1;
  return d0 < d1 ? 0 : 1;
}

/**
 * Next value for a slider key, or null when the key is not handled. `dir: "rtl"` mirrors
 * ArrowLeft/ArrowRight (the React kit does not; the default `ltr` is identical to it).
 */
export function keyboardValue(
  key: string,
  current: number,
  min: number,
  max: number,
  step: number,
  page: number,
  dir: "ltr" | "rtl" = "ltr",
): number | null {
  switch (key) {
    case "ArrowRight":
      return dir === "rtl" ? current - step : current + step;
    case "ArrowUp":
      return current + step;
    case "ArrowLeft":
      return dir === "rtl" ? current + step : current - step;
    case "ArrowDown":
      return current - step;
    case "PageUp":
      return current + page;
    case "PageDown":
      return current - page;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}
