import { TONE_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { svg } from "../internal/chart-base.js";
import {
  bollingerMiddle,
  heikinAshi,
  type IndicatorSeries,
  type OscillatorModel,
  oscillatorModel,
  overlayLines,
  renko,
  type StockBar,
  type StockFlag,
  sameDay,
} from "../internal/e23-stock.js";
import css from "./stock-extras.css.js";

// Optional parts of <ui-stock>, loaded only when the chart uses them: overlay indicators, the
// oscillator pane, the Heikin-Ashi and Renko transforms and event flags. A plain candle chart
// never fetches this module.

/** The styles of these parts, adopted by the chart when this module loads. */
export const styles = css;

export { bollingerMiddle, heikinAshi, oscillatorModel, overlayLines, renko };

export function paintOscillator(
  model: OscillatorModel,
  lo: number,
  hi: number,
  xOf: (i: number) => number,
  top: number,
  bottom: number,
  innerW: number,
  step: number,
  axis: SVGElement[],
  linePath: (points: ReadonlyArray<{ x: number; y: number } | null>) => string,
): SVGElement[] {
  const out: SVGElement[] = [];
  const values = (series: IndicatorSeries | undefined) => {
    const list: Array<number | null> = [];
    if (series) for (let i = lo; i <= hi; i += 1) list.push(series[i] ?? null);
    return list;
  };
  const main = values(model.main);
  let min = 0;
  let max = 100;
  if (model.type === "macd") {
    max = 0;
    for (const list of [main, values(model.signal), values(model.histogram)])
      for (const v of list)
        if (v != null) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
    if (min === max) max = min + 1;
  }
  const scale = linearScale({ domain: [min, max], range: [bottom - 2, top + 4], nice: false });
  out.push(svg("line", { class: "gl", x1: 0, x2: innerW, y1: top - 7, y2: top - 7 }));
  const path = (list: Array<number | null>) =>
    linePath(list.map((v, k) => (v == null ? null : { x: xOf(lo + k), y: scale.map(v) })));
  if (model.type === "rsi") {
    for (const level of [30, 70])
      out.push(
        svg("line", {
          class: "guide",
          x1: 0,
          x2: innerW,
          y1: scale.map(level),
          y2: scale.map(level),
        }),
      );
    out.push(svg("path", { class: "osc-line", d: path(main) }));
    for (const level of [30, 70])
      axis.push(
        svg("text", { class: "yt", x: innerW + 8, y: scale.map(level), dy: "0.32em" }, `${level}`),
      );
  } else {
    const hist = values(model.histogram);
    const zero = scale.map(0);
    // A long window keeps the strongest bar of each pair of pixels: never more than innerW / 2.
    const stride = Math.max(1, Math.ceil(hist.length / Math.max(1, innerW / 2)));
    const bw = Math.max(1, Math.min(step * stride * 0.6, 12));
    for (let from = 0; from < hist.length; from += stride) {
      let best: number | null = null;
      let at = from;
      for (let k = from; k < Math.min(hist.length, from + stride); k += 1) {
        const v = hist[k];
        if (v != null && (best == null || Math.abs(v) > Math.abs(best))) {
          best = v;
          at = k;
        }
      }
      if (best == null) continue;
      const py = scale.map(best);
      out.push(
        svg("rect", {
          class: "hist",
          "data-dir": best >= 0 ? "up" : "down",
          x: (xOf(lo + at) - bw / 2).toFixed(1),
          width: bw.toFixed(1),
          y: Math.min(py, zero).toFixed(1),
          height: Math.max(1, Math.abs(py - zero)).toFixed(1),
        }),
      );
    }
    out.push(svg("line", { class: "guide", x1: 0, x2: innerW, y1: zero, y2: zero }));
    out.push(svg("path", { class: "osc-line", d: path(main) }));
    out.push(svg("path", { class: "osc-line signal", d: path(values(model.signal)) }));
  }
  out.push(svg("text", { class: "pane-name", x: 6, y: top + 6 }, model.name));
  return out;
}

/** The event flags over the visible bars. */
export function flagNodes(
  flags: readonly StockFlag[],
  bars: readonly StockBar[],
  lo: number,
  hi: number,
  xOf: (i: number) => number,
  y: (price: number) => number,
  candle: boolean,
  closeAt: (index: number) => number,
  top: number,
): SVGElement[] {
  const out: SVGElement[] = [];
  for (const flag of flags) {
    let at = -1;
    for (let i = lo; i <= hi; i += 1) {
      if (sameDay((bars[i] as StockBar).date, flag.date)) {
        at = i;
        break;
      }
    }
    if (at < 0) continue;
    const px = xOf(at);
    const py = Math.max(top + 14, y(candle ? (bars[at] as StockBar).high : closeAt(at)) - 18);
    const tone = TONE_COLORS[flag.tone ?? "accent"];
    out.push(
      svg(
        "g",
        { class: "flag", "aria-hidden": "true" },
        svg("line", { x1: px, x2: px, y1: py + 8, y2: py + 16, style: `stroke:${tone.ink}` }),
        svg("rect", {
          x: px - 9,
          y: py - 8,
          width: 18,
          height: 16,
          rx: 4,
          style: `fill:${tone.soft};stroke:${tone.ink}`,
        }),
        svg(
          "text",
          { x: px, y: py, dy: "0.34em", "text-anchor": "middle", style: `fill:${tone.ink}` },
          flag.label,
        ),
      ),
    );
  }
  return out;
}
