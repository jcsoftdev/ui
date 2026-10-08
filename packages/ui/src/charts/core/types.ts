import type { ValueFormat } from "./format.js";
import type { ChartTone } from "./palette.js";

/** A category or time stamp on the category axis. */
export type XValue = string | number | Date;

export interface ChartSeries {
  /** Stable identity, used for keys and legend toggling. */
  id: string;
  /** Visible name in the legend, tooltip and data table. */
  name: string;
  /** One value per category; `null` leaves a gap. */
  data: ReadonlyArray<number | null>;
  /** CSS color, e.g. `var(--chart-cat-3)`. Defaults to the palette slot of the series. */
  color?: string;
  /** Dashed stroke (lines) or hatched look, e.g. for a forecast or last year. */
  dashed?: boolean;
  /** Overrides the chart `valueFormat` for this series. */
  format?: ValueFormat;
}

/** Visible strings. English defaults; pass Spanish (or any language) from the app. */
export interface ChartLabels {
  empty: string;
  loading: string;
  resetZoom: string;
  total: string;
  /** Accessible name of the keyboard-explorable plot. */
  explore: string;
  /** Accessible name of the brush (range selector). */
  brush: string;
  /** Header of the category column in the hidden data table. */
  category: string;
  /** Header of the value column in the hidden data table (single-series charts). */
  value: string;
  /** Header and tooltip label of a share of the total. */
  share: string;
}

export const DEFAULT_LABELS: ChartLabels = {
  empty: "No data to show",
  loading: "Loading chart",
  resetZoom: "Reset zoom",
  total: "Total",
  explore: "Data points. Use the arrow keys to move between them.",
  brush: "Visible range",
  category: "Category",
  value: "Value",
  share: "Share",
};

export function resolveLabels(labels?: Partial<ChartLabels>): ChartLabels {
  return labels ? { ...DEFAULT_LABELS, ...labels } : DEFAULT_LABELS;
}

interface AnnotationBase {
  label?: string;
  /** Color family, `neutral` by default. */
  tone?: ChartTone;
}

/**
 * Reference marks. `axis: "y"` is the value axis (a threshold such as a daily
 * goal); `axis: "x"` is the category axis (a date or a category). In horizontal
 * bar charts the value axis runs left to right, so "y" lines are drawn vertical.
 */
export type ChartAnnotation =
  | (AnnotationBase & { type: "line"; axis: "y"; value: number; yAxis?: "left" | "right" })
  | (AnnotationBase & {
      type: "range";
      axis: "y";
      from: number;
      to: number;
      yAxis?: "left" | "right";
    })
  | (AnnotationBase & { type: "line"; axis: "x"; value: XValue })
  | (AnnotationBase & { type: "range"; axis: "x"; from: XValue; to: XValue });

export interface ValueAxisOptions {
  /** Fixed lower bound; by default the data decides (bars and areas start at 0). */
  min?: number;
  /** Fixed upper bound. */
  max?: number;
  /** Approximate number of ticks; derived from the height by default. */
  tickCount?: number;
  /** Tick format; defaults to a short form of the chart `valueFormat`. */
  format?: ValueFormat;
  /** Short axis title drawn above the ticks, e.g. "S/" or "Citas". */
  title?: string;
  /** Logarithmic scale (line charts only, positive values). */
  scale?: "linear" | "log";
  /** Force zero into the domain (lines default to "auto": only when data sits near zero). */
  zero?: boolean;
}
