import type { XValue } from "@jcsoftdev/ui-core/chart/category-axis-time";
import type { Candle } from "../candlestick/candlestick.js";

/** A candle in view: several source candles merge into one when there are more than pixels. */
export interface Bar extends Candle {
  until?: XValue;
}

/** `n` buckets of consecutive candles merged into open-high-low-close-volume bars. */
export function merge(view: readonly Candle[], buckets: number): Bar[] {
  if (view.length <= buckets) return view as Bar[];
  const size = Math.ceil(view.length / buckets);
  const out: Bar[] = [];
  for (let at = 0; at < view.length; at += size) {
    const group = view.slice(at, at + size);
    const first = group[0] as Candle;
    const last = group[group.length - 1] as Candle;
    let volume: number | undefined;
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      if (c.volume != null) volume = (volume ?? 0) + c.volume;
    }
    out.push({
      date: first.date,
      until: group.length > 1 ? last.date : undefined,
      open: first.open,
      close: last.close,
      high,
      low,
      volume,
    });
  }
  return out;
}
