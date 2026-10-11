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

function canScroll(element: Element): boolean {
  const { overflowY } = getComputedStyle(element);
  return (
    (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight
  );
}

/** iOS Safari ignores `overflow: hidden` on body for touch drags; stop drags that cannot scroll anything. */
function onTouchMove(event: TouchEvent) {
  if (event.touches.length > 1 || !event.cancelable) return;
  for (let node = event.target as Element | null; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    if (canScroll(node)) return;
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
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  return () => {
    document.removeEventListener("touchmove", onTouchMove);
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
