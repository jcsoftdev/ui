/**
 * SVG pattern fills for colour-blind friendly charts. A pattern is a square
 * tile of strokes and fills drawn in the series colour over a soft backdrop of
 * the same colour, so the token (and therefore the theme) still decides the hue.
 * Pure data here; `ChartPatternDefs` (pattern-defs.tsx) turns it into `<pattern>`s.
 */

export type PatternShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width?: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "path"; d: string; width?: number; filled?: boolean };

/** A tile of `size` x `size` pixels repeated across the mark. */
export interface PatternTile {
  size: number;
  shapes: readonly PatternShape[];
  /** Opacity of the colour backdrop under the shapes (0.2 by default). */
  backdrop?: number;
}

export const PATTERN_NAMES = [
  "stripes",
  "stripes-reverse",
  "dots",
  "crosshatch",
  "grid",
  "zigzag",
  "checks",
  "diamonds",
  "waves",
] as const;

export type PatternName = (typeof PATTERN_NAMES)[number];

/** A named design, or your own tile. */
export type ChartPattern = PatternName | PatternTile;

const BUILT_IN: Record<PatternName, PatternTile> = {
  stripes: {
    size: 8,
    shapes: [
      { type: "line", x1: 0, y1: 8, x2: 8, y2: 0, width: 2 },
      { type: "line", x1: -2, y1: 2, x2: 2, y2: -2, width: 2 },
      { type: "line", x1: 6, y1: 10, x2: 10, y2: 6, width: 2 },
    ],
  },
  "stripes-reverse": {
    size: 8,
    shapes: [
      { type: "line", x1: 0, y1: 0, x2: 8, y2: 8, width: 2 },
      { type: "line", x1: -2, y1: 6, x2: 2, y2: 10, width: 2 },
      { type: "line", x1: 6, y1: -2, x2: 10, y2: 2, width: 2 },
    ],
  },
  dots: {
    size: 8,
    shapes: [
      { type: "circle", cx: 2, cy: 2, r: 1.5 },
      { type: "circle", cx: 6, cy: 6, r: 1.5 },
    ],
  },
  crosshatch: {
    size: 8,
    shapes: [
      { type: "line", x1: 0, y1: 8, x2: 8, y2: 0, width: 1.4 },
      { type: "line", x1: 0, y1: 0, x2: 8, y2: 8, width: 1.4 },
      { type: "line", x1: -2, y1: 2, x2: 2, y2: -2, width: 1.4 },
      { type: "line", x1: 6, y1: 10, x2: 10, y2: 6, width: 1.4 },
      { type: "line", x1: -2, y1: 6, x2: 2, y2: 10, width: 1.4 },
      { type: "line", x1: 6, y1: -2, x2: 10, y2: 2, width: 1.4 },
    ],
  },
  grid: {
    size: 8,
    shapes: [
      { type: "line", x1: 0, y1: 0, x2: 8, y2: 0, width: 1.4 },
      { type: "line", x1: 0, y1: 0, x2: 0, y2: 8, width: 1.4 },
    ],
  },
  zigzag: {
    size: 8,
    shapes: [{ type: "path", d: "M0 6 L2 2 L4 6 L6 2 L8 6", width: 1.4 }],
  },
  checks: {
    size: 8,
    shapes: [
      { type: "rect", x: 0, y: 0, width: 4, height: 4 },
      { type: "rect", x: 4, y: 4, width: 4, height: 4 },
    ],
  },
  diamonds: {
    size: 8,
    shapes: [{ type: "path", d: "M4 0.8 L7.2 4 L4 7.2 L0.8 4 Z", width: 1.3 }],
  },
  waves: {
    size: 8,
    shapes: [{ type: "path", d: "M0 4 Q2 0.5 4 4 T8 4", width: 1.4 }],
  },
};

/** The tile of a named design or of a custom pattern (custom tiles are clamped to a sane size). */
export function resolvePattern(pattern: ChartPattern): PatternTile {
  if (typeof pattern === "string") return BUILT_IN[pattern] ?? BUILT_IN.stripes;
  return { ...pattern, size: Math.min(48, Math.max(2, pattern.size)) };
}

/** Id safe for `url(#id)`: letters, digits, dashes and underscores only. */
export function patternId(scope: string, key: string): string {
  return `${scope.replace(/[^a-zA-Z0-9_-]/g, "")}-p-${key.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Paint value that fills a mark with the pattern of `id`. */
export function patternFill(id: string): string {
  return `url(#${id})`;
}

/** Cycles the built-in designs, handy for "one pattern per series" charts. */
export function patternAt(index: number): PatternName {
  return PATTERN_NAMES[index % PATTERN_NAMES.length] as PatternName;
}
