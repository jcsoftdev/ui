/**
 * Canvas painting for long price series. A canvas cannot read CSS variables, so colors are resolved
 * through a probe element; bars are painted in two passes (up, then down) so the fill style changes
 * twice instead of once per bar.
 */
import type { StockBar } from "./e23-stock.js";

/** Resolves CSS colors (`var(--x)`, `color-mix(...)`) to what a canvas accepts, once per draw. */
export function colorResolver(host: HTMLElement): { color(value: string): string; done(): void } {
  const probe = document.createElement("i");
  probe.style.cssText = "display:none";
  host.append(probe);
  const cache = new Map<string, string>();
  return {
    color(value) {
      let known = cache.get(value);
      if (known === undefined) {
        probe.style.color = "";
        probe.style.color = value;
        known = getComputedStyle(probe).color || value;
        cache.set(value, known);
      }
      return known;
    },
    done: () => probe.remove(),
  };
}

/** One painted column: the bars that fall on the same pixel, merged into one. */
export interface Column {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * The bars of `view` as columns. When there are more bars than pixels, bars that share a pixel
 * merge (first open, last close, extreme high and low, summed volume), so painting costs at most
 * one column per pixel however long the series is.
 */
export function columns(
  view: readonly StockBar[],
  positions: readonly number[],
  merge: boolean,
): Column[] {
  const out: Column[] = [];
  let slot = Number.NaN;
  let current: Column | undefined;
  for (let i = 0; i < view.length; i += 1) {
    const bar = view[i] as StockBar;
    const x = positions[i] as number;
    const key = merge ? Math.round(x) : i;
    if (current && key === slot) {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume ?? 0;
      continue;
    }
    slot = key;
    current = {
      x: merge ? key : x,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? 0,
    };
    out.push(current);
  }
  return out;
}

export interface BarPaint {
  g: CanvasRenderingContext2D;
  up: string;
  down: string;
  y(value: number): number;
  width: number;
}

/** Candles (`ohlc` false) or OHLC ticks. */
export function paintCandles(paint: BarPaint, list: readonly Column[], ohlc: boolean): void {
  const { g, y, width } = paint;
  for (const [color, rising] of [
    [paint.up, true],
    [paint.down, false],
  ] as const) {
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = ohlc ? 1.5 : 1.25;
    g.beginPath();
    for (const c of list) {
      if (c.close >= c.open !== rising) continue;
      g.moveTo(c.x, y(c.high));
      g.lineTo(c.x, y(c.low));
      if (ohlc) {
        const tick = Math.max(2, width / 2);
        g.moveTo(c.x - tick, y(c.open));
        g.lineTo(c.x, y(c.open));
        g.moveTo(c.x, y(c.close));
        g.lineTo(c.x + tick, y(c.close));
      }
    }
    g.stroke();
    if (ohlc) continue;
    for (const c of list) {
      if (c.close >= c.open !== rising) continue;
      const top = y(Math.max(c.open, c.close));
      const bottom = y(Math.min(c.open, c.close));
      g.fillRect(c.x - width / 2, top, width, Math.max(1.25, bottom - top));
    }
  }
}

/** Closing-price columns from `base`, colored by the direction against the previous close. */
export function paintColumns(
  paint: BarPaint,
  list: readonly Column[],
  base: number,
  before: number | undefined,
): void {
  const { g, y, width } = paint;
  let previous = before;
  const up: Column[] = [];
  const down: Column[] = [];
  for (const c of list) {
    (c.close >= (previous ?? c.open) ? up : down).push(c);
    previous = c.close;
  }
  g.globalAlpha = 0.8;
  for (const [color, group] of [
    [paint.up, up],
    [paint.down, down],
  ] as const) {
    g.fillStyle = color;
    for (const c of group) {
      const top = y(c.close);
      g.fillRect(c.x - width / 2, top, width, Math.max(1, base - top));
    }
  }
  g.globalAlpha = 1;
}

/** Volume bars along the bottom of the price pane, `height` tall for the largest. */
export function paintVolume(
  paint: BarPaint,
  list: readonly Column[],
  maxVolume: number,
  bottom: number,
  height: number,
): void {
  const { g, width } = paint;
  if (maxVolume <= 0) return;
  g.globalAlpha = 0.22;
  for (const [color, rising] of [
    [paint.up, true],
    [paint.down, false],
  ] as const) {
    g.fillStyle = color;
    for (const c of list) {
      if (c.close >= c.open !== rising || c.volume <= 0) continue;
      const h = Math.max(1, (c.volume / maxVolume) * height);
      g.fillRect(c.x - width / 2, bottom - h, width, h);
    }
  }
  g.globalAlpha = 1;
}
