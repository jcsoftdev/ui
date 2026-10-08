// Framework-free step picking of the scrollytelling container.

export interface StepRect {
  top: number;
  bottom: number;
}

/**
 * The step a reader is on: the one that contains the trigger `line` (a y coordinate). In a gap
 * between steps the previous one stays active; above the first step it is the first, below the
 * last one it is the last. `-1` only when there are no steps.
 */
export function pickActiveStep(rects: readonly StepRect[], line: number): number {
  if (rects.length === 0) return -1;
  let active = 0;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i] as StepRect;
    if (rect.top <= line) active = i;
    if (line >= rect.top && line < rect.bottom) return i;
  }
  return active;
}

/** Viewport coordinate of the trigger line: `offset` is its fraction (0 top, 1 bottom) of the scroll area. */
export function triggerLine(areaTop: number, areaHeight: number, offset: number): number {
  return areaTop + areaHeight * Math.min(1, Math.max(0, offset));
}

/** Scroll progress through a step, 0 when its top meets the line and 1 when its bottom does. */
export function stepProgress(rect: StepRect, line: number): number {
  const height = rect.bottom - rect.top;
  if (height <= 0) return line >= rect.top ? 1 : 0;
  return Math.min(1, Math.max(0, (line - rect.top) / height));
}

/** The `rootMargin` that shrinks the observed area to a thin band at `offset`, to wake up when a step crosses the line. */
export function lineRootMargin(offset: number): string {
  const clamped = Math.min(1, Math.max(0, offset));
  const top = Math.round(clamped * 100);
  return `-${top}% 0px -${100 - top}% 0px`;
}
