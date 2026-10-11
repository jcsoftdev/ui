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

function applyBodyScrollLock(): () => void {
  const { body, documentElement } = document;
  const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  const gap = Math.max(0, window.innerWidth - documentElement.clientWidth);
  const basePadding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${basePadding + gap}px`;
  body.setAttribute("data-scroll-locked", "");
  return () => {
    body.style.overflow = previous.overflow;
    body.style.paddingRight = previous.paddingRight;
    body.removeAttribute("data-scroll-locked");
  };
}

let lockBody: (() => () => void) | undefined;

/** Locks page scroll, compensating for the scrollbar gap; returns the release function. */
export function lockBodyScroll(): () => void {
  lockBody ??= createRefCountedLock(applyBodyScrollLock);
  return lockBody();
}
