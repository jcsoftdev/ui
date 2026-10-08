"use client";

import { useCallback, useState } from "react";
import type { StockBar } from "./stock-model.js";
import { appendBars } from "./stock-stats.js";

export interface StockStreamOptions {
  /** Keep only the newest bars; unbounded by default. */
  maxBars?: number;
}

/**
 * State for a live price series. `appendData` takes one bar or several: a bar
 * with the date of the last one replaces it (the candle still forming), a
 * newer one is appended. A StockChart whose window ends at the last bar
 * follows the new bars on its own.
 */
export function useStockStream(initial: readonly StockBar[], options: StockStreamOptions = {}) {
  const { maxBars } = options;
  const [data, setData] = useState<readonly StockBar[]>(initial);
  const appendData = useCallback(
    (incoming: StockBar | readonly StockBar[]) =>
      setData((current) => appendBars(current, incoming, maxBars)),
    [maxBars],
  );
  const reset = useCallback((next: readonly StockBar[]) => setData(next), []);
  return { data, appendData, reset };
}
