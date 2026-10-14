// Shared by the unit charts (waffle, pictogram, isotype rows, progress units): the glyph, the entry
// animation, a gap-free lattice hit test and 2D keyboard navigation over the categories.
import type { NavIntent } from "./chart-base.js";
import { svg } from "./chart-dom.js";
import type { ResolvedUnitShape } from "./e22-unit-icons.js";

const EASE_OUT = "cubic-bezier(.22,1,.36,1)";

/**
 * One icon of a unit chart, centered in a square cell. A partial unit draws the track silhouette
 * and clips the colored copy, so 0.6 of a person is exactly 60% of its width. The outer group
 * carries `data-unit`, so the entry animation can scale it in place.
 */
export function glyph(
  shape: ResolvedUnitShape,
  x: number,
  y: number,
  size: number,
  fill: number,
  color: string,
  clipId: string,
  { track = true, direction = "right" }: { track?: boolean; direction?: "right" | "up" } = {},
): SVGGElement {
  const scale = size / Math.max(shape.width, shape.height);
  const dx = x + (size - shape.width * scale) / 2;
  const dy = y + (size - shape.height * scale) / 2;
  const amount = Math.min(1, Math.max(0, fill));
  const partial = amount > 0 && amount < 1;
  const inner = svg("g", { transform: `translate(${dx} ${dy}) scale(${scale})` });
  if (partial)
    inner.append(
      svg(
        "clipPath",
        { id: clipId },
        direction === "up"
          ? svg("rect", {
              x: 0,
              y: shape.height * (1 - amount),
              width: shape.width,
              height: shape.height * amount,
            })
          : svg("rect", { x: 0, y: 0, width: shape.width * amount, height: shape.height }),
      ),
    );
  if (track && amount < 1)
    inner.append(
      svg("path", { d: shape.path, style: `fill:var(--track);fill-rule:${shape.fillRule}` }),
    );
  if (amount > 0)
    inner.append(
      svg("path", {
        d: shape.path,
        "clip-path": partial ? `url(#${clipId})` : undefined,
        style: `fill:${color};fill-rule:${shape.fillRule}`,
      }),
    );
  return svg(
    "g",
    { "data-unit": "", style: "transform-box:fill-box;transform-origin:center" },
    inner,
  );
}

/** Pops every `[data-unit]` in document order: a short scale-and-fade, the whole sequence under ~1s. */
export function popUnits(root: Element, { duration = 420, budget = 900 } = {}): void {
  const units = root.querySelectorAll("[data-unit]");
  const step = units.length > 1 ? Math.min(28, budget / units.length) : 0;
  units.forEach((unit, index) => {
    unit.animate(
      [
        { transform: "scale(0.3)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration, delay: index * step, easing: EASE_OUT, fill: "backwards" },
    );
  });
}

/** A lattice of equal cells: `owners[row * columns + column]` is a mark index, or -1 for an empty cell. */
export interface Lattice {
  /** Top-left corner of the first cell. */
  x: number;
  y: number;
  /** Distance between cell origins (cell side plus gap). */
  pitch: number;
  /** Side of one cell; `pitch - size` is the gutter. */
  size: number;
  columns: number;
  rows: number;
  owners: ArrayLike<number>;
}

/** Result of `latticeCell` for a point outside the lattice. */
export const OUTSIDE = -2;

/**
 * Mark owning the cell under (`px`, `py`). The gutters belong to the cell they border (the lattice
 * is cut at the middle of each gutter), so there are no holes between the units of a category.
 * Returns -1 for an empty cell and `OUTSIDE` beyond the lattice.
 */
export function latticeCell(lattice: Lattice, px: number, py: number): number {
  const half = (lattice.pitch - lattice.size) / 2;
  const column = Math.floor((px - lattice.x + half) / lattice.pitch);
  const row = Math.floor((py - lattice.y + half) / lattice.pitch);
  if (column < 0 || row < 0 || column >= lattice.columns || row >= lattice.rows) return OUTSIDE;
  return lattice.owners[row * lattice.columns + column] ?? -1;
}

/**
 * A gap-free `hit` over a lattice. Over a unit it answers that unit's mark; over a cell that
 * belongs to nobody (an empty slot, a hidden category) it keeps the mark already shown, so the
 * hover clears only when the pointer reaches another mark or leaves the lattice. `shown` is the
 * mark whose details are on screen when the pointer arrives (`DrawContext.hover`).
 */
export function latticeHit(
  lattice: Lattice,
  shown: number | null,
): (x: number, y: number) => number {
  let held = shown ?? -1;
  return (x, y) => {
    const owner = latticeCell(lattice, x, y);
    if (owner === OUTSIDE) {
      held = -1;
      return -1;
    }
    if (owner >= 0) held = owner;
    return held;
  };
}

/**
 * 2D keyboard navigation over marks laid out on a plane. Left and right walk the marks in reading
 * order; up and down go to the nearest mark in the next row above or below (then the closest
 * column), and stay when there is none. Home and End jump to the first and the last.
 */
export function navigate(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  index: number,
  intent: NavIntent,
): number {
  const last = anchors.length - 1;
  switch (intent) {
    case "left":
      return Math.max(0, index - 1);
    case "right":
      return Math.min(last, index + 1);
    case "home":
      return 0;
    case "end":
      return last;
    case "up":
    case "down": {
      const from = anchors[index];
      if (!from) return index;
      const sign = intent === "down" ? 1 : -1;
      let best = index;
      let rise = Number.POSITIVE_INFINITY;
      let drift = Number.POSITIVE_INFINITY;
      anchors.forEach((to, i) => {
        const dy = (to.y - from.y) * sign;
        if (i === index || dy < 1) return;
        const dx = Math.abs(to.x - from.x);
        if (dy < rise - 1 || (Math.abs(dy - rise) <= 1 && dx < drift)) {
          best = i;
          rise = dy;
          drift = dx;
        }
      });
      return best;
    }
    default:
      return index;
  }
}

/** The "icon = 5 clients" line under a unit chart; `null` removes it. */
export function setUnitKey(
  host: HTMLElement,
  key: { shape: ResolvedUnitShape; text: string } | null,
): void {
  let line = host.querySelector<HTMLElement>(":scope > [data-ui-part='unit-key']");
  if (!key) {
    line?.remove();
    return;
  }
  if (!line) {
    line = document.createElement("p");
    line.dataset.uiPart = "unit-key";
    host.append(line);
  }
  const mark = svg(
    "svg",
    { "aria-hidden": "true", width: 14, height: 14, viewBox: "0 0 24 24" },
    svg("path", { d: key.shape.path, style: `fill:var(--ink-3);fill-rule:${key.shape.fillRule}` }),
  );
  const text = document.createElement("span");
  text.textContent = key.text;
  line.replaceChildren(mark, text);
}

/** Neutral key mark when categories wear different icons. */
export const MIXED_KEY = "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z";

/** Approximate rendered width of a label (tabular figures). */
export const textWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.58;

/** Shortens `text` with an ellipsis so it fits `width` pixels at `fontSize`. */
export function fitText(text: string, width: number, fontSize: number): string {
  const room = Math.max(1, Math.floor(width / (fontSize * 0.58)));
  return text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1))}…`;
}
