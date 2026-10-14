// Loaded on demand by charts that draw on a canvas or cache resolved colors: the canvas layer, and one
// MutationObserver plus one media listener for the theme, shared by every chart and ref-counted.
const ATTRIBUTES = ["data-theme", "class", "style"];
const watched = new Map<Element, Set<() => void>>();
let observer: MutationObserver | undefined;
let media: MediaQueryList | undefined;
let count = 0;

const notify = (callbacks: Iterable<() => void>) => {
  for (const callback of [...callbacks]) callback();
};
const onMedia = () => notify(new Set([...watched.values()].flatMap((set) => [...set])));

const handle = (records: MutationRecord[]) => {
  const hit = new Set<() => void>();
  for (const record of records)
    for (const callback of watched.get(record.target as Element) ?? []) hit.add(callback);
  notify(hit);
};
const options = { attributes: true, attributeFilter: ATTRIBUTES };

/** Calls `callback` when the page theme changes (`data-theme`, `class`, `style` on the root or the nearest themed ancestor, or `prefers-color-scheme`). Returns the unsubscribe. */
function watchTheme(element: Element, callback: () => void): () => void {
  const nodes = new Set<Element>([document.documentElement]);
  const themed = element.closest("[data-theme]");
  if (themed) nodes.add(themed);
  for (const node of nodes) {
    const set = watched.get(node) ?? new Set();
    set.add(callback);
    watched.set(node, set);
  }
  if (count++ === 0) {
    media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onMedia);
  }
  observer ??= new MutationObserver(handle);
  for (const node of nodes) observer.observe(node, options);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const node of nodes) {
      const set = watched.get(node);
      set?.delete(callback);
      if (set && !set.size) watched.delete(node);
    }
    if (--count === 0) {
      media?.removeEventListener("change", onMedia);
      media = undefined;
      observer?.disconnect();
      observer = undefined;
    } else if (observer) {
      // A node nobody watches any more: re-observe the rest, and deliver what was pending.
      const pending = observer.takeRecords();
      observer.disconnect();
      for (const node of watched.keys()) observer.observe(node, options);
      handle(pending);
    }
  };
}

/** Live subscriptions, for tests. */
export const themeWatchers = () => count;

const bound = new WeakMap<Element, () => void>();
const signature = (element: Element) => {
  const style = getComputedStyle(element);
  return ["color-scheme", "--ink", "--ink-2", "--surface", "--bg"]
    .map((name) => style.getPropertyValue(name))
    .join("|");
};

/** Calls `bump` when the theme changed in a way a chart can see (the color scheme or a core token), not on every class or style write. */
export function bindTheme(element: HTMLElement, bump: () => void): () => void {
  bound.get(element)?.();
  if (!element.isConnected) return () => {};
  let last = signature(element);
  const stop = watchTheme(element, () => {
    const now = signature(element);
    if (now === last) return;
    last = now;
    bump();
  });
  const release = () => {
    stop();
    if (bound.get(element) === release) bound.delete(element);
  };
  bound.set(element, release);
  return release;
}

/** Sizes, clears and mounts the canvas layer under the SVG and returns it with a 2D context in CSS pixels. */
export function layer(
  drawing: HTMLElement,
  existing: HTMLCanvasElement | undefined,
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = existing ?? document.createElement("canvas");
  canvas.dataset.uiPart = "canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  const scale = devicePixelRatio || 1;
  // Assigning the size clears the bitmap.
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  if (!canvas.isConnected) drawing.prepend(canvas);
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return [canvas, context];
}

/** A window dragged to a screen with another pixel ratio, or a browser zoom, redraws the canvas layer sharp. */
export function watchDpr(chart: { requestDraw(kind: "size"): void }): AbortController {
  const stop = new AbortController();
  const arm = () => {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        if (stop.signal.aborted) return;
        chart.requestDraw("size");
        arm();
      },
      { once: true, signal: stop.signal },
    );
  };
  arm();
  return stop;
}
