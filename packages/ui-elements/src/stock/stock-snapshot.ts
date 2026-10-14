import type { ChartSnapshot } from "../internal/chart-base.js";
import type { OverlayLine, StockBar, StockComparison } from "../internal/e23-stock.js";
import type { StockTexts } from "./stock.js";

export interface SnapshotInput {
  bars: readonly StockBar[];
  lines: readonly OverlayLine[];
  comparisons: readonly StockComparison[];
  name: string;
  texts: StockTexts;
  longDate: Intl.DateTimeFormat;
  fmt: (value: number) => string;
  color: (index: number, override?: string) => string;
}

// The data table behind the chart, built lazily: a plain chart fetches this module only when the
// table is read, shortly after the first paint.
export function snapshotOf(input: SnapshotInput): ChartSnapshot {
  const { bars, lines, comparisons, name, texts, longDate, fmt, color } = input;
  const column = (
    id: string,
    label: string,
    tone: string,
    get: (bar: StockBar, i: number) => number | null | undefined,
  ) => {
    const values = bars.map((bar, i) => get(bar, i) ?? null);
    return {
      id,
      name: label,
      color: tone,
      values,
      text: values.map((v) => (v == null ? "" : fmt(v))),
    };
  };
  const series = [
    column("open", texts.open, "var(--ink-3)", (b) => b.open),
    column("high", texts.high, "var(--ink-3)", (b) => b.high),
    column("low", texts.low, "var(--ink-3)", (b) => b.low),
    column("close", texts.close, color(0), (b) => b.close),
    column("volume", texts.volume, "var(--ink-3)", (b) => b.volume),
    ...lines.map((line) => column(line.id, line.name, line.color, (_, i) => line.values[i])),
    ...comparisons.map((c, k) =>
      column(c.id, c.name, color(k + 1, c.color), (_, i) => c.values[i]),
    ),
  ];
  return {
    title: name,
    categoryHeader: texts.date,
    categories: bars.map((bar) => longDate.format(bar.date)),
    categoryValues: bars.map((bar) => bar.date),
    series,
    legend: [
      ...lines.map((line) => ({
        id: line.id,
        name: line.name,
        color: line.color,
        shape: "line" as const,
      })),
      ...comparisons.map((c, k) => ({
        id: c.id,
        name: c.name,
        color: color(k + 1, c.color),
        shape: "line" as const,
      })),
    ],
  };
}
