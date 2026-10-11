import { globalSingleton } from "./global-singleton.js";

/** Ref-counted lock: `apply` runs on the first acquire, its returned `restore` on the last release. */
export function createRefCountedLock(apply: () => () => void): () => () => void {
  let count = 0;
  let restore: (() => void) | null = null;
  return () => {
    if (count === 0) restore = apply();
    count += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      count -= 1;
      if (count === 0) {
        restore?.();
        restore = null;
      }
    };
  };
}

type Axis = "x" | "y";

const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

/** Whether `element` can move further in the drag direction (`delta` > 0 pulls content toward the start). */
function canScrollFurther(element: Element, axis: Axis, delta: number): boolean {
  const style = getComputedStyle(element);
  if (axis === "y") {
    if (!SCROLLABLE_OVERFLOW.has(style.overflowY) || element.scrollHeight <= element.clientHeight) {
      return false;
    }
    return delta > 0
      ? element.scrollTop > 0
      : element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
  if (!SCROLLABLE_OVERFLOW.has(style.overflowX) || element.scrollWidth <= element.clientWidth) {
    return false;
  }
  // `scrollLeft` is negative in RTL, so compare magnitudes.
  const offset = Math.abs(element.scrollLeft);
  return delta > 0 ? offset > 0 : offset + element.clientWidth < element.scrollWidth - 1;
}

/** Controls that handle their own touch drag (sliders, text areas) and must never be cancelled. */
const OWN_DRAG =
  'input[type="range"], textarea, select, [contenteditable]:not([contenteditable="false"])';

let touchStart: { x: number; y: number } | null = null;

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  touchStart = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * iOS Safari ignores `overflow: hidden` on body for touch drags. Cancel drags that
 * cannot move anything: allowed are form controls that drag on their own and any
 * ancestor that can still scroll along the drag axis (vertical or horizontal);
 * at a scroll edge the drag falls through to the page and is cancelled.
 */
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (event.touches.length > 1 || !event.cancelable || !touch || !touchStart) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const axis: Axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  const delta = axis === "x" ? dx : dy;
  const target = event.target;
  if (target instanceof Element && target.closest(OWN_DRAG)) return;
  for (let node = target as Element | null; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    if (canScrollFurther(node, axis, delta)) return;
  }
  event.preventDefault();
}

function applyBodyScrollLock(): () => void {
  const { body, documentElement: root } = document;
  const previous = {
    bodyOverflow: body.style.overflow,
    rootOverflow: root.style.overflow,
    paddingRight: body.style.paddingRight,
  };
  const before = root.clientWidth;
  const rootExplicit = getComputedStyle(root).overflowY !== "visible";
  const basePadding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.overflow = "hidden";
  // An explicit `overflow` on <html> (e.g. `overflow-y: scroll`) stops body's value propagating to the viewport.
  if (rootExplicit) root.style.overflow = "hidden";
  // Pad only for width actually lost: with `scrollbar-gutter: stable` the gutter stays and nothing shifts.
  const lost = Math.max(0, root.clientWidth - before);
  if (lost > 0) body.style.paddingRight = `${basePadding + lost}px`;
  body.setAttribute("data-scroll-locked", "");
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  return () => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    touchStart = null;
    body.style.overflow = previous.bodyOverflow;
    root.style.overflow = previous.rootOverflow;
    body.style.paddingRight = previous.paddingRight;
    body.removeAttribute("data-scroll-locked");
  };
}

/** Locks page scroll, compensating for the scrollbar gap; returns the release function. */
export function lockBodyScroll(): () => void {
  return globalSingleton("@jcsoftdev/ui/body-scroll-lock", () =>
    createRefCountedLock(applyBodyScrollLock),
  )();
}
