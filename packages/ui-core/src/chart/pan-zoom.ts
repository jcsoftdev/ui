/**
 * Pan and zoom of a transformed stage: wheel, pinch, drag and keyboard. The maths is pure
 * (`zoomAround`, `fitView`, `wheelFactor`, `panZoomKey`); `attachPanZoom` wires it to an element.
 */

/** Scale `k` and translation of a pannable stage: screen = content * k + (x, y). */
export interface PanZoomView {
  k: number;
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Scales `view` by `factor` keeping the screen point `px, py` fixed; `k` stays in the zoom limits. */
export function zoomAround(
  view: PanZoomView,
  factor: number,
  px: number,
  py: number,
  minZoom: number,
  maxZoom: number,
): PanZoomView {
  const k = clamp(view.k * factor, minZoom, maxZoom);
  const ratio = k / view.k;
  return { k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/**
 * View that shows a `contentWidth` x `contentHeight` drawing centred in a `width` x `height`
 * viewport, `padding` from the edges, never enlarged past `maxFit`.
 */
export function fitView(
  contentWidth: number,
  contentHeight: number,
  width: number,
  height: number,
  { padding = 16, minZoom = 0.05, maxFit = 1 } = {},
): PanZoomView {
  const k = clamp(
    Math.min(
      (width - padding * 2) / Math.max(1, contentWidth),
      (height - padding * 2) / Math.max(1, contentHeight),
      maxFit,
    ),
    minZoom,
    Number.POSITIVE_INFINITY,
  );
  return { k, x: (width - contentWidth * k) / 2, y: (height - contentHeight * k) / 2 };
}

/** Zoom factor of one wheel event: smooth for pixel deltas, coarser for line deltas. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  return Math.exp(-deltaY * (deltaMode === 1 ? 0.05 : 0.0025));
}

/** Zoom factor of the +/- keys and buttons. */
export const ZOOM_STEP = 1.25;
/** Pixels an arrow key pans by. */
export const PAN_STEP = 48;

export interface PanZoomKeyOptions {
  /** Viewport size: zoom keys keep its centre fixed. */
  width: number;
  height: number;
  minZoom?: number;
  maxZoom?: number;
  /** Pixels per arrow press (default 48); Shift pans five times as far. */
  panStep?: number;
  zoomStep?: number;
  shift?: boolean;
}

/**
 * Keyboard meaning for a pannable stage. Arrows move the viewport over the content (so the content
 * slides the other way); `+`/`=` zoom in and `-`/`_` out around the viewport centre. Returns the
 * next view, or `null` when the key is not a pan-zoom key (`0` is the caller's reset to its fit).
 */
export function panZoomKey(
  view: PanZoomView,
  key: string,
  {
    width,
    height,
    minZoom = 0.1,
    maxZoom = 2.5,
    panStep = PAN_STEP,
    zoomStep = ZOOM_STEP,
    shift = false,
  }: PanZoomKeyOptions,
): PanZoomView | null {
  const step = shift ? panStep * 5 : panStep;
  switch (key) {
    case "ArrowLeft":
      return { ...view, x: view.x + step };
    case "ArrowRight":
      return { ...view, x: view.x - step };
    case "ArrowUp":
      return { ...view, y: view.y + step };
    case "ArrowDown":
      return { ...view, y: view.y - step };
    case "+":
    case "=":
      return zoomAround(view, zoomStep, width / 2, height / 2, minZoom, maxZoom);
    case "-":
    case "_":
      return zoomAround(view, 1 / zoomStep, width / 2, height / 2, minZoom, maxZoom);
    default:
      return null;
  }
}

export interface PanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  /**
   * Wheel zoom: `modifier` (default) only with Ctrl/Cmd or a trackpad pinch, so the page keeps
   * scrolling; `always` captures the wheel; `off` ignores it.
   */
  wheel?: "modifier" | "always" | "off";
  /** Arrow, `+`, `-` and `0` keys while the element has focus. On by default. */
  keyboard?: boolean;
  /** The view `0` returns to. Default: the identity view. */
  home?: () => PanZoomView;
  initial?: PanZoomView;
  /** Called with every new view, including keyboard and programmatic ones. */
  onChange?: (view: PanZoomView) => void;
  /** True while dragging, pinching or wheel zooming: the host switches transitions off. */
  onInteract?: (interacting: boolean) => void;
}

export interface PanZoom {
  readonly view: PanZoomView;
  /** Sets the view; `user: false` keeps `userMoved` untouched (automatic fits). */
  setView(view: PanZoomView, options?: { user?: boolean }): void;
  /** Zooms by `factor` around a point of the element (its centre by default). */
  zoomBy(factor: number, around?: { x: number; y: number }): void;
  /** Goes back to `home` and forgets the user's moves. */
  reset(): void;
  /** True once the user moved the view since the last `reset`. */
  readonly userMoved: boolean;
  /** The last pointer gesture was a drag, not a click: ignore the click that ends it. */
  wasDrag(): boolean;
  destroy(): void;
}

const DRAG_THRESHOLD = 4;
const WHEEL_IDLE = 160;
const IDENTITY: PanZoomView = { k: 1, x: 0, y: 0 };

/**
 * Pan (drag), zoom (wheel, pinch, keys) for an element that holds a transformed stage. Pointer
 * capture starts only once a drag passes a few pixels, so clicks on content inside the stage still
 * work. The element should have `touch-action: none` for touch pan and pinch.
 */
export function attachPanZoom(element: HTMLElement, options: PanZoomOptions = {}): PanZoom {
  const { minZoom = 0.1, maxZoom = 2.5, wheel = "modifier", keyboard = true } = options;
  const home = options.home ?? (() => IDENTITY);
  let view = options.initial ?? IDENTITY;
  let userMoved = false;
  let lastDrag = false;
  let interacting = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pointers = new Map<number, { x: number; y: number }>();
  const gesture = { dragged: false, startX: 0, startY: 0, distance: 0 };

  const setInteracting = (next: boolean) => {
    if (interacting === next) return;
    interacting = next;
    options.onInteract?.(next);
  };
  const setView = (next: PanZoomView, { user = true } = {}) => {
    view = next;
    if (user) userMoved = true;
    options.onChange?.(next);
  };
  const zoomBy = (factor: number, around?: { x: number; y: number }) =>
    setView(
      zoomAround(
        view,
        factor,
        around?.x ?? element.clientWidth / 2,
        around?.y ?? element.clientHeight / 2,
        minZoom,
        maxZoom,
      ),
    );
  const local = (event: PointerEvent) => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onWheel = (event: WheelEvent) => {
    if (wheel === "modifier" && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const box = element.getBoundingClientRect();
    setInteracting(true);
    clearTimeout(timer);
    timer = setTimeout(() => setInteracting(false), WHEEL_IDLE);
    zoomBy(wheelFactor(event.deltaY, event.deltaMode), {
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 1) {
      Object.assign(gesture, { dragged: false, startX: point.x, startY: point.y, distance: 0 });
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.distance = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.dragged = true;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.distance > 0) {
        setInteracting(true);
        zoomBy(distance / gesture.distance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      gesture.distance = distance;
      return;
    }
    if (!gesture.dragged) {
      if (Math.hypot(point.x - gesture.startX, point.y - gesture.startY) < DRAG_THRESHOLD) return;
      gesture.dragged = true;
      setInteracting(true);
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone (synthetic or cancelled): dragging still works.
      }
    }
    setView({ k: view.k, x: view.x + point.x - previous.x, y: view.y + point.y - previous.y });
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 0) {
      lastDrag = gesture.dragged;
      setInteracting(false);
    }
  };

  const reset = () => {
    userMoved = false;
    setView(home(), { user: false });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== element || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "0") {
      event.preventDefault();
      reset();
      return;
    }
    const next = panZoomKey(view, event.key, {
      width: element.clientWidth,
      height: element.clientHeight,
      minZoom,
      maxZoom,
      shift: event.shiftKey,
    });
    if (!next) return;
    event.preventDefault();
    setView(next);
  };

  if (wheel !== "off") element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerEnd);
  element.addEventListener("pointercancel", onPointerEnd);
  if (keyboard) element.addEventListener("keydown", onKeyDown);

  return {
    get view() {
      return view;
    },
    get userMoved() {
      return userMoved;
    },
    setView,
    zoomBy,
    reset,
    wasDrag: () => lastDrag,
    destroy() {
      clearTimeout(timer);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerEnd);
      element.removeEventListener("pointercancel", onPointerEnd);
      element.removeEventListener("keydown", onKeyDown);
    },
  };
}
