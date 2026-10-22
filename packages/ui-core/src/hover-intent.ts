export interface Point {
  x: number;
  y: number;
}
export interface BoxEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Triangle-like area between the pointer leaving a trigger and the content on `side` of it (a
 * submenu, a hover card), so the pointer can cross other items on its way without closing it.
 * `left` and `right` are the React kit's submenu area; `top` and `bottom` are the same shape
 * turned a quarter, for content placed above or below the trigger.
 */
export function graceArea(
  exit: Point,
  side: "left" | "right" | "top" | "bottom",
  box: BoxEdges,
): Point[] {
  if (side === "top" || side === "bottom") {
    const below = side === "bottom";
    const bleed = below ? -5 : 5;
    const near = below ? box.top : box.bottom;
    const far = below ? box.bottom : box.top;
    return [
      { x: exit.x, y: exit.y + bleed },
      { x: box.left, y: near },
      { x: box.left, y: far },
      { x: box.right, y: far },
      { x: box.right, y: near },
    ];
  }
  const rightSide = side === "right";
  const bleed = rightSide ? -5 : 5;
  const near = rightSide ? box.left : box.right;
  const far = rightSide ? box.right : box.left;
  return [
    { x: exit.x + bleed, y: exit.y },
    { x: near, y: box.top },
    { x: far, y: box.top },
    { x: far, y: box.bottom },
    { x: near, y: box.bottom },
  ];
}

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface GraceTracker {
  /** Feed every pointer move inside the menu so the travel direction is known. */
  track(clientX: number): void;
  /** The pointer left a trigger toward a submenu: hold the area for `ms`. */
  start(exit: Point, side: "left" | "right", box: BoxEdges): void;
  /** Whether `point` is inside the held area and the pointer travels toward the submenu. */
  isMovingToward(point: Point): boolean;
  clear(): void;
}

/** Submenu grace area with the React menu's travel-direction check and 300 ms hold. */
export function createGraceTracker(ms = 300): GraceTracker {
  let intent: { area: Point[]; side: "left" | "right" } | null = null;
  let direction: "left" | "right" = "right";
  let lastX = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    track(clientX) {
      if (lastX === clientX) return;
      direction = clientX > lastX ? "right" : "left";
      lastX = clientX;
    },
    start(exit, side, box) {
      intent = { area: graceArea(exit, side, box), side };
      clearTimeout(timer);
      timer = setTimeout(() => {
        intent = null;
      }, ms);
    },
    isMovingToward: (point) =>
      intent !== null && direction === intent.side && isPointInPolygon(point, intent.area),
    clear() {
      clearTimeout(timer);
      intent = null;
    },
  };
}

/**
 * Tracks when an overlay last closed, so the next one in the same group opens at once (the skip
 * window of a tooltip group). One tracker per group; {@link sharedSkipWindow} is the page default.
 */
export interface SkipWindow {
  markClosed(): void;
  /** Whether a close happened less than the window ago. */
  active(): boolean;
}

export function createSkipWindow(ms = 300, now: () => number = Date.now): SkipWindow {
  let closedAt = Number.NEGATIVE_INFINITY;
  return {
    markClosed() {
      closedAt = now();
    },
    active: () => now() - closedAt < ms,
  };
}

let shared: SkipWindow | undefined;
/** The page-wide skip window every intent joins unless given its own. */
export const sharedSkipWindow = (): SkipWindow => {
  shared ??= createSkipWindow();
  return shared;
};

export interface HoverIntentOptions {
  /** Called when the intent settles on open (`true`) or closed (`false`). */
  onChange: (open: boolean) => void;
  /** ms before opening on hover. Default 700. A function is read at every hover. */
  openDelay?: number | (() => number);
  /** ms before closing on leave, so the pointer can travel into the content. Default 100. */
  closeDelay?: number | (() => number);
  /** Open at once when another overlay of this group closed within its window. `false` disables. */
  skip?: SkipWindow | false;
}

export interface HoverIntent {
  /** Pointer entered the trigger. Touch pointers are ignored. */
  enter(event?: { pointerType?: string }): void;
  /** Pointer left the trigger. Touch pointers are ignored. */
  leave(event?: { pointerType?: string }): void;
  /** Pointer entered the content: cancel any pending close (hoverable content, WCAG 1.4.13). */
  hold(): void;
  /** Keyboard focus opens at once. */
  focus(): void;
  /** Blur, press or Escape closes at once. */
  close(): void;
  /** Cancel a pending open or close. */
  cancel(): void;
  /** Record the open state the owner reached by other means (so the skip window is marked). */
  settled(open: boolean): void;
}

/**
 * Open/close delays for hover-driven overlays (tooltip, hover card): a hover opens after
 * `openDelay` (immediately inside the skip window), leaving closes after `closeDelay`, and focus
 * opens at once. Pure timing; the owner applies `onChange`.
 */
export function createHoverIntent(options: HoverIntentOptions): HoverIntent {
  const read = (value: number | (() => number) | undefined, fallback: number) => {
    const resolved = typeof value === "function" ? value() : value;
    return typeof resolved === "number" && Number.isFinite(resolved) ? resolved : fallback;
  };
  const skip = options.skip === false ? undefined : (options.skip ?? sharedSkipWindow());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (open: boolean, delay: number) => {
    clearTimeout(timer);
    if (delay <= 0) options.onChange(open);
    else timer = setTimeout(() => options.onChange(open), delay);
  };
  const touch = (event?: { pointerType?: string }) => event?.pointerType === "touch";
  return {
    enter(event) {
      if (touch(event)) return;
      schedule(true, skip?.active() ? 0 : read(options.openDelay, 700));
    },
    leave(event) {
      if (touch(event)) return;
      schedule(false, read(options.closeDelay, 100));
    },
    hold: () => clearTimeout(timer),
    focus: () => schedule(true, 0),
    close: () => schedule(false, 0),
    cancel: () => clearTimeout(timer),
    settled(open) {
      if (!open) skip?.markClosed();
    },
  };
}
