export type TrendDirection = "up" | "down" | "flat";
export type TrendTone = "positive" | "negative" | "neutral";

/** Direction of a change; values within `epsilon` of zero are flat. */
export function trendDirection(value: number, epsilon = 0): TrendDirection {
  if (Number.isNaN(value) || Math.abs(value) <= epsilon) return "flat";
  return value > 0 ? "up" : "down";
}

/** Good/bad reading of a direction. `invert` is for metrics where lower is better. */
export function trendTone(direction: TrendDirection, invert = false): TrendTone {
  if (direction === "flat") return "neutral";
  const good = (direction === "up") !== invert;
  return good ? "positive" : "negative";
}

/** Signed percent text from a percentage value: 12.5 -> "+12.5%" (es-PE by default). */
export function formatTrend(value: number, locale = "es-PE", maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits,
  }).format(value / 100);
}
