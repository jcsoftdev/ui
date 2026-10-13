/**
 * Series colors. The first series always wears the brand (`accent-word`, a
 * readable tone of the active `data-accent` palette); the rest come from the
 * categorical `chart-cat-*` tokens, tuned separately for light and dark.
 * Values are CSS `var()` references, so apply them through `style`, never as
 * SVG presentation attributes.
 */
export const CHART_PALETTE = [
  "var(--accent-word)",
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
  "var(--chart-cat-7)",
] as const;

/** Color for the series at `index`, unless the series brings its own. */
export function seriesColor(index: number, override?: string): string {
  return override ?? (CHART_PALETTE[index % CHART_PALETTE.length] as string);
}

/** Direction of change: `chart-up` and `chart-down` tokens, `chart-total` when flat or a total. */
export const DIRECTION_COLORS = {
  up: "var(--chart-up)",
  down: "var(--chart-down)",
  flat: "var(--chart-total)",
} as const;

export type ChartDirection = keyof typeof DIRECTION_COLORS;

/** `up` / `down` / `flat` for a change; changes within `epsilon` count as flat. */
export function directionOf(delta: number, epsilon = 0): ChartDirection {
  return delta > epsilon ? "up" : delta < -epsilon ? "down" : "flat";
}

export type ChartTone = "neutral" | "accent" | "danger" | "warning" | "success";

/** Stroke/text color and soft fill for annotations and status marks. */
export const TONE_COLORS: Record<ChartTone, { ink: string; soft: string }> = {
  neutral: { ink: "var(--ink-3)", soft: "var(--surface-2)" },
  accent: { ink: "var(--accent-ink)", soft: "var(--accent-soft)" },
  danger: { ink: "var(--danger)", soft: "var(--danger-soft)" },
  warning: { ink: "var(--warning)", soft: "var(--warning-soft)" },
  success: { ink: "var(--success)", soft: "var(--success-soft)" },
};

/** Base hue of a monochrome chart: the active brand accent. */
export const MONOCHROME_BASE = "var(--accent-word)";

/**
 * Shade `step` of `count` in one hue: step 0 is the full color, the last
 * step the palest tint (40%), mixed towards the surface so it works in both
 * themes. `count` of 1 gives the full color.
 */
export function monochromeShade(step: number, count: number, base = MONOCHROME_BASE): string {
  const last = Math.max(1, count - 1);
  const share = Math.round(100 - (Math.min(Math.max(step, 0), last) / last) * 60);
  return share >= 100 ? base : `color-mix(in oklab, ${base} ${share}%, var(--surface))`;
}

/**
 * Shades for `values`, darkest on the largest value, so rank reads as
 * intensity. Returns one color per input, in input order.
 */
export function monochromeByValue(values: readonly number[], base = MONOCHROME_BASE): string[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const out: string[] = new Array(values.length);
  order.forEach((entry, rank) => {
    out[entry.index] = monochromeShade(rank, values.length, base);
  });
  return out;
}
