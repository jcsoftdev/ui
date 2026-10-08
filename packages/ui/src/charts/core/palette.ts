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
