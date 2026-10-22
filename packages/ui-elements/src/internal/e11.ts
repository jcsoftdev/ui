/**
 * Shared by the E11 containers (carousel, resizable, file-tree, kanban, scrolly): direction and
 * motion probes, the carousel and resizable maths (ported value for value from the React kit), and
 * the small icon set. Pure parts take plain numbers so they run without a DOM.
 */

export const isRtl = (element: Element): boolean => getComputedStyle(element).direction === "rtl";

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `format("{n} of {count}", { n: 1, count: 3 })` is `"1 of 3"`. */
export const format = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** An element that is a direct part of `owner` (not of a nested container of the same kind). */
export const ownParts = (owner: Element, selector: string): HTMLElement[] =>
  [...owner.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => element.parentElement?.closest("[data-ui]") === owner,
  );

const svg = (path: string) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;

export const ICONS = {
  chevron: svg('<path d="M6 3.5 10.5 8 6 12.5"/>'),
  pause: svg('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
  play: svg('<path d="M5 3.5 12 8l-7 4.5z" fill="currentColor"/>'),
  folder: svg(
    '<path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z"/>',
  ),
  folderOpen: svg(
    '<path d="M2 11.5V4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v1M2 11.5 3.6 8h10.4l-1.6 5H3.5A1.5 1.5 0 0 1 2 11.5z"/>',
  ),
  file: svg('<path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3"/>'),
  fileCode: svg('<path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6.5 8.5 5.5 9.5l1 1M9.5 8.5l1 1-1 1"/>'),
  fileImage: svg('<path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M5.5 12l2-2.5L9 11l1-1 1.5 2"/>'),
  fileText: svg('<path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 10.5h4"/>'),
  grip: svg(
    '<circle cx="6" cy="4" r=".6" fill="currentColor"/><circle cx="10" cy="4" r=".6" fill="currentColor"/><circle cx="6" cy="8" r=".6" fill="currentColor"/><circle cx="10" cy="8" r=".6" fill="currentColor"/><circle cx="6" cy="12" r=".6" fill="currentColor"/><circle cx="10" cy="12" r=".6" fill="currentColor"/>',
  ),
};

/** Next slide index; wraps when `loop`, otherwise stays at the ends. */
export function stepIndex(index: number, count: number, direction: 1 | -1, loop: boolean): number {
  if (count <= 0) return 0;
  const next = index + direction;
  if (loop) return (next + count) % count;
  return Math.min(count - 1, Math.max(0, next));
}

/** Index of the slide whose start edge is closest to `position`. */
export function nearestIndex(position: number, offsets: readonly number[]): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  offsets.forEach((offset, i) => {
    const d = Math.abs(offset - position);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}

export interface PanelConstraint {
  /** Percent of the group. */
  min: number;
  max: number;
}

const EPSILON = 1e-9;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Initial layout in percent summing to 100. Panels without a default share what the others
 * leave; every panel is then clamped to its constraint and the difference is spread over the
 * panels that still have room.
 */
export function normalizeSizes(
  defaults: Array<number | undefined>,
  constraints: PanelConstraint[],
): number[] {
  const count = defaults.length;
  if (count === 0) return [];
  const defined = defaults.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const open = defaults.filter((size) => size === undefined).length;
  const share = open > 0 ? Math.max(0, 100 - defined) / open : 0;
  const raw = defaults.map((size) => size ?? share);
  const total = raw.reduce((sum, size) => sum + size, 0) || 1;
  const sizes = raw.map((size, i) => {
    const c = constraints[i] ?? { min: 0, max: 100 };
    return clamp((size / total) * 100, c.min, c.max);
  });
  for (let pass = 0; pass < count; pass += 1) {
    const diff = 100 - sizes.reduce((sum, size) => sum + size, 0);
    if (Math.abs(diff) < EPSILON) break;
    const room = sizes.map((size, i) => {
      const c = constraints[i] ?? { min: 0, max: 100 };
      return diff > 0 ? c.max - size : size - c.min;
    });
    const roomSum = room.reduce((sum, r) => sum + Math.max(0, r), 0);
    if (roomSum < EPSILON) break;
    const apply = Math.min(Math.abs(diff), roomSum);
    for (let i = 0; i < count; i += 1) {
      const portion = (Math.max(0, room[i] ?? 0) / roomSum) * apply;
      sizes[i] = (sizes[i] ?? 0) + (diff > 0 ? portion : -portion);
    }
  }
  return sizes;
}

/** The range panel `index` can take while its neighbour absorbs the difference. */
export function pairRange(
  sizes: readonly number[],
  constraints: readonly PanelConstraint[],
  index: number,
): { low: number; high: number } | null {
  const a = sizes[index];
  const b = sizes[index + 1];
  const ca = constraints[index];
  const cb = constraints[index + 1];
  if (a === undefined || b === undefined || !ca || !cb) return null;
  const total = a + b;
  return { low: Math.max(ca.min, total - cb.max), high: Math.min(ca.max, total - cb.min) };
}

/**
 * Moves the boundary between panel `index` and `index + 1` by `delta` percent. The pair keeps its
 * combined size and both panels stay inside their min/max; other panels are untouched.
 */
export function resizePair(
  sizes: number[],
  constraints: PanelConstraint[],
  index: number,
  delta: number,
): number[] {
  const range = pairRange(sizes, constraints, index);
  const a = sizes[index];
  const b = sizes[index + 1];
  if (!range || a === undefined || b === undefined || range.low > range.high) return sizes;
  const nextA = clamp(a + delta, range.low, range.high);
  if (Math.abs(nextA - a) < EPSILON) return sizes;
  const next = sizes.slice();
  next[index] = nextA;
  next[index + 1] = a + b - nextA;
  return next;
}

/**
 * Keyboard step in percent for a separator key, or null when the key is not handled. In a
 * right-to-left row ArrowLeft grows the first panel (the React kit has no RTL; `ltr` matches it).
 */
export function keyboardDelta(
  key: string,
  orientation: "horizontal" | "vertical",
  shift = false,
  step = 5,
  dir: "ltr" | "rtl" = "ltr",
): number | null {
  const amount = shift ? step * 2 : step;
  const [less, more] =
    orientation === "horizontal" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  const flip = orientation === "horizontal" && dir === "rtl";
  if (key === less) return flip ? amount : -amount;
  if (key === more) return flip ? -amount : amount;
  return null;
}
