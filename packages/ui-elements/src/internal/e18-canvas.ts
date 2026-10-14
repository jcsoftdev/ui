// Shared by the E18 charts that switch to the canvas layer for thousands of marks. Only the two
// constants and the loader live here (eager); the painting code of each chart is a lazy `big.ts`.

/** Marks above this count are painted on the canvas layer instead of one SVG node each. */
export const CANVAS_MARKS = 5000;

/** Height (px) a canvas-layer chart grows to when its natural height would be thousands of pixels. */
export const CANVAS_HEIGHT = 640;

/**
 * Loads a chart's canvas module once per page. `get()` is the module when it has arrived;
 * `ensure(redraw)` starts the load and calls `redraw` when it resolves.
 */
export function lazyModule<T>(load: () => Promise<T>) {
  let loaded: T | undefined;
  let pending: Promise<T> | undefined;
  return {
    get: () => loaded,
    ensure(redraw: () => void): void {
      pending ??= load().then((module) => {
        loaded = module;
        return module;
      });
      pending.then(redraw);
    },
  };
}
