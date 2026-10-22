// The canvas layer of <ui-slope-chart>, loaded the first time a chart passes CANVAS_MARKS lines.
import { type DrawContext, svg } from "../internal/chart-base.js";
import { colorResolver } from "../internal/e18-canvas-color.js";
import type { SlopeItem } from "./slope-chart.js";

/** Columns of the sorted lookup behind `closest`. */
const COLUMNS = 32;

/** First index of `sorted` whose value is at least `target`. */
function lowerBound(sorted: Float64Array, target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface BigParams {
  ctx: DrawContext;
  drawing: Element;
  plot: SVGGElement;
  items: readonly SlopeItem[];
  colors: readonly string[];
  xL: number;
  xR: number;
  ysFrom: Float64Array;
  ysTo: Float64Array;
  top: number;
}

/** One canvas stroke per color, a highlight line for the focused one, and the sorted hit lookup. */
export function paintSlope(p: BigParams) {
  const { ctx, plot, items, colors, xL, xR, ysFrom, ysTo } = p;
  const resolve = colorResolver(p.drawing);
  const g = ctx.canvas();
  g.save();
  g.translate(0, p.top);
  const paths = new Map<string, Path2D>();
  items.forEach((_, i) => {
    const color = colors[i] as string;
    const path = paths.get(color) ?? new Path2D();
    paths.set(color, path);
    path.moveTo(xL, ysFrom[i] as number);
    path.lineTo(xR, ysTo[i] as number);
  });
  g.lineWidth = 1;
  g.globalAlpha = 0.55;
  for (const [color, path] of paths) {
    g.strokeStyle = resolve(color);
    g.stroke(path);
  }
  g.restore();
  const focus = svg("line", {
    "data-line": "",
    "stroke-linecap": "round",
    "stroke-width": 2.25,
    "aria-hidden": "true",
  });
  plot.append(svg("g", { "data-row": "", "aria-hidden": "true" }, focus));

  // Items sorted by their height at each of COLUMNS + 1 positions between the axes, built lazily.
  const columns: Array<{ order: Uint32Array; ys: Float64Array } | undefined> = [];
  let steepest = 0;
  for (let i = 0; i < items.length; i += 1)
    steepest = Math.max(steepest, Math.abs((ysTo[i] as number) - (ysFrom[i] as number)));
  const heightAt = (i: number, t: number) =>
    (ysFrom[i] as number) + ((ysTo[i] as number) - (ysFrom[i] as number)) * t;
  const column = (k: number) => {
    const cached = columns[k];
    if (cached) return cached;
    const t = k / COLUMNS;
    const at = Float64Array.from(items, (_, i) => heightAt(i, t));
    const order = Uint32Array.from(items, (_, i) => i).sort(
      (a, b) => (at[a] as number) - (at[b] as number),
    );
    const ys = Float64Array.from(order, (i) => at[i] as number);
    const built = { order, ys };
    columns[k] = built;
    return built;
  };
  return {
    element(i: number): SVGElement {
      focus.setAttribute("x1", String(xL));
      focus.setAttribute("x2", String(xR));
      focus.setAttribute("y1", String(ysFrom[i]));
      focus.setAttribute("y2", String(ysTo[i]));
      focus.style.stroke = colors[i] as string;
      return focus;
    },
    /** The line closest to height `ly` at `t` (0 at the first axis, 1 at the second), within `reach`. */
    closest(t: number, ly: number, reach: number): number {
      const k = Math.round(t * COLUMNS);
      const { order, ys } = column(k);
      const slack = steepest * Math.abs(t - k / COLUMNS);
      let best = -1;
      let gap = Number.POSITIVE_INFINITY;
      const end = Math.min(ys.length, lowerBound(ys, ly + reach + slack) + 1);
      for (let at = Math.max(0, lowerBound(ys, ly - reach - slack) - 1); at < end; at += 1) {
        const i = order[at] as number;
        const d = Math.abs(heightAt(i, t) - ly);
        if (d < gap) {
          gap = d;
          best = i;
        }
      }
      return gap <= reach ? best : -1;
    },
  };
}
