import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { DIRECTION_COLORS, directionOf } from "@jcsoftdev/ui-core/chart/palette";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { spreadSlopeLabels } from "@jcsoftdev/ui-core/chart/slope";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type SnapshotSeries,
  svg,
  type TooltipRow,
  type VirtualMarks,
} from "../internal/chart-base.js";
import { CANVAS_HEIGHT, CANVAS_MARKS, colorResolver } from "../internal/e18-canvas.js";
import {
  AutoHeight,
  adoptPlot,
  fadeIn,
  finite,
  fitLabel,
  flag,
  grow,
  hitRect,
  jsonAttr,
  percentChange,
  text,
} from "../internal/e18-plot.js";
import css from "./slope-chart.css.js";

export interface SlopeItem {
  id?: string;
  label: string;
  from: number;
  to: number;
  /** CSS color; overrides `color-by`. */
  color?: string;
}

const MARGIN = { top: 34, bottom: 14 };
const LABEL_GAP = 17;
const LABEL_STYLE = "font-weight:600;font-variant-numeric:tabular-nums";
const HEADER_STYLE = "fill:var(--ink-3);font-size:11px;font-weight:700";

/** Columns of the sorted lookup behind `hit` on the canvas layer. */
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

/** Index of the value closest to `target`, or -1 when there are none. */
function nearest(values: readonly number[], target: number): number {
  let best = -1;
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    const d = Math.abs((values[i] as number) - target);
    if (d < gap) {
      best = i;
      gap = d;
    }
  }
  return best;
}

/**
 * `<ui-slope-chart>`: two columns, one line per category, the slope is the change. Labels with
 * values sit on both sides and are nudged apart when values are close, so every name stays
 * readable. Hover, arrow keys (Up/Down and Left/Right both step) and a tap show the two values and
 * the change; the optional `<ui-chart-legend readonly>` is the up/down key. Over the label columns
 * the pointer snaps to the nearest label, between them to the nearest line within 16px.
 *
 * Attributes (React props in brackets): `from-label` and `to-label` (`fromLabel`, `toLabel`),
 * `color-by` (`direction` or `series`), `lower-is-better`, `delta-label`, `category-label`
 * (`labels.category`), `legend="off"` (`legend`; the key is only published for `color-by=direction`),
 * `items` (JSON), plus the chart attributes (`label` is the React `title`, `description`, `height`
 * (a number grows the plot, `fill` takes the parent), `aspect-ratio`, `loading`, `locale`,
 * `value-format`, `animate="off"`...). Properties: `items` (`{ id?, label, from, to, color? }`).
 * Events: the chart events (`chart-hover`, `chart-select`...).
 */
export class UiSlopeChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "items",
    "from-label",
    "to-label",
    "color-by",
    "lower-is-better",
    "legend",
    "delta-label",
    "category-label",
  ];
  #items: readonly SlopeItem[] | undefined;
  readonly #height = new AutoHeight(this);

  get items(): readonly SlopeItem[] {
    return this.#items ?? jsonAttr<SlopeItem[]>(this, "items") ?? [];
  }
  set items(value: readonly SlopeItem[]) {
    this.#items = value;
    this.#fit();
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    this.setAttribute("data-slope", "");
    adoptStyles(rootOf(this), css);
    this.#fit();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "items") this.#fit();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** The plot grows with the number of items unless the author fixed the height. */
  #fit(): void {
    const natural = Math.max(260, this.items.length * (LABEL_GAP + 5) + MARGIN.top + MARGIN.bottom);
    this.#height.apply(
      this.items.length > CANVAS_MARKS ? Math.min(natural, CANVAS_HEIGHT) : natural,
    );
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, format, locale, animate } = ctx;
    // An item with a NaN or infinite value cannot be placed: it is left out of the plot.
    const items = this.items.filter(
      (item) => Number.isFinite(item.from) && Number.isFinite(item.to),
    );
    const big = items.length > CANVAS_MARKS;
    const fromLabel = this.getAttribute("from-label") ?? "Before";
    const toLabel = this.getAttribute("to-label") ?? "After";
    const deltaLabel = this.getAttribute("delta-label") ?? "Change";
    const bySeries = this.getAttribute("color-by") === "series";
    const goodUp = !flag(this, "lower-is-better");
    const narrow = width < 440;
    const size = narrow ? 11 : 12;

    const colors = items.map((item, i) => {
      if (item.color) return item.color;
      if (bySeries) return ctx.color(i);
      const direction = directionOf(item.to - item.from);
      if (direction === "flat") return DIRECTION_COLORS.flat;
      return (direction === "up") === goodUp ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
    });
    const change = (item: SlopeItem) => {
      const diff = item.to - item.from;
      return `${diff > 0 ? "+" : ""}${format(diff)} (${percentChange(item.from, item.to, locale)})`;
    };

    // Geometry: label columns, the two axes, and the spread label positions.
    const sideWidth = (pick: (item: SlopeItem) => number) => {
      let widest = 40;
      for (const item of items)
        widest = Math.max(widest, estimateTextWidth(`${item.label}  ${format(pick(item))}`, size));
      return widest + 16;
    };
    const room = Math.min(width * (narrow ? 0.4 : 0.34), 230);
    const leftWidth = big
      ? 56
      : Math.min(
          room,
          sideWidth((item) => item.from),
        );
    const rightWidth = big
      ? 56
      : Math.min(
          room,
          sideWidth((item) => item.to),
        );
    const xL = leftWidth;
    const xR = Math.max(xL + 40, width - rightWidth);
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      lo = Math.min(lo, item.from, item.to);
      hi = Math.max(hi, item.from, item.to);
    }
    // Every value equal: centre the lines instead of pinning them to an edge.
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const innerHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom);
    const y = linearScale({
      domain: items.length ? [lo, hi] : [0, 1],
      range: [innerHeight, 0],
      nice: false,
    });
    const ysFrom = Float64Array.from(items, (item) => finite(y.map(item.from)));
    const ysTo = Float64Array.from(items, (item) => finite(y.map(item.to)));
    const labelFrom = big ? [] : spreadSlopeLabels(Array.from(ysFrom), LABEL_GAP, 0, innerHeight);
    const labelTo = big ? [] : spreadSlopeLabels(Array.from(ysTo), LABEL_GAP, 0, innerHeight);

    // Column headers, the two axes.
    root.append(
      svg(
        "g",
        { "aria-hidden": "true" },
        text(
          fitLabel(fromLabel, leftWidth + 40, 11, 2),
          { x: xL, y: 12, "text-anchor": "middle" },
          HEADER_STYLE,
        ),
        text(
          fitLabel(toLabel, rightWidth + 40, 11, 2),
          { x: xR, y: 12, "text-anchor": "middle" },
          HEADER_STYLE,
        ),
      ),
    );
    const plot = svg("g", { transform: `translate(0,${MARGIN.top})` });
    root.append(plot);
    const axes = svg("g", { "aria-hidden": "true" });
    for (const x of [xL, xR])
      axes.append(
        svg("line", {
          x1: x,
          x2: x,
          y1: -8,
          y2: innerHeight + 8,
          "shape-rendering": "crispEdges",
          style: "stroke:var(--chart-grid);stroke-width:2",
        }),
      );
    plot.append(axes);

    const describe = (item: SlopeItem) =>
      `${item.label}. ${fromLabel} ${format(item.from)}, ${toLabel} ${format(item.to)}, ${deltaLabel} ${change(item)}`;

    // Thousands of lines: one canvas stroke per color, a highlight line for the focused one.
    const canvasMarks = (): VirtualMarks => {
      const resolve = colorResolver(this.drawing);
      const g = ctx.canvas();
      g.save();
      g.translate(0, MARGIN.top);
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
      return {
        count: items.length,
        label: (i) => describe(items[i] as SlopeItem),
        element: (i) => {
          focus.setAttribute("x1", String(xL));
          focus.setAttribute("x2", String(xR));
          focus.setAttribute("y1", String(ysFrom[i]));
          focus.setAttribute("y2", String(ysTo[i]));
          focus.style.stroke = colors[i] as string;
          return focus;
        },
      };
    };

    // Items sorted by their height at each of COLUMNS + 1 positions between the axes, built lazily.
    const columns: Array<{ order: Uint32Array; ys: Float64Array } | undefined> = [];
    let steepest = 0;
    if (big)
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
    /** The line closest to height `ly` at `t` (0 at the first axis, 1 at the second), within `reach`. */
    const closest = (t: number, ly: number, reach: number): number => {
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
    };

    const marks: ChartMark[] | VirtualMarks = big
      ? canvasMarks()
      : items.map((item, i) => {
          const color = colors[i] as string;
          const y1 = ysFrom[i] as number;
          const y2 = ysTo[i] as number;
          const group = svg("g", { "data-row": "" });
          plot.append(group);
          const line = svg("line", {
            "data-line": "",
            x1: xL,
            y1,
            x2: xR,
            y2,
            "stroke-linecap": "round",
            "stroke-width": 2.25,
            "aria-hidden": "true",
            style: `stroke:${color};transform-box:fill-box;transform-origin:left center`,
          });
          const dot = (cx: number, cy: number) =>
            svg("circle", {
              "data-dot": "",
              cx,
              cy,
              r: 4.5,
              "aria-hidden": "true",
              style: `fill:${color};stroke:var(--surface);stroke-width:2`,
            });
          group.append(line, dot(xL, y1), dot(xR, y2));
          if (animate)
            grow(line, "x", i, {
              duration: 620,
              step: Math.min(40, 400 / Math.max(1, items.length)),
            });

          const fromText = format(item.from);
          const toText = format(item.to);
          const value = (content: string) =>
            svg("tspan", { style: `fill:${color};font-weight:700` }, content);
          const labels = svg("g", { "aria-hidden": "true", style: "pointer-events:none" });
          labels.append(
            svg(
              "text",
              {
                "data-label": "",
                x: xL - 12,
                y: labelFrom[i] as number,
                dy: "0.34em",
                "text-anchor": "end",
                "font-size": size,
                style: LABEL_STYLE,
              },
              fitLabel(item.label, leftWidth - 16 - estimateTextWidth(fromText, size) - 8, size, 2),
              " ",
              value(fromText),
            ),
            svg(
              "text",
              {
                "data-label": "",
                x: xR + 12,
                y: labelTo[i] as number,
                dy: "0.34em",
                "text-anchor": "start",
                "font-size": size,
                style: LABEL_STYLE,
              },
              value(toText),
              " ",
              fitLabel(item.label, rightWidth - 16 - estimateTextWidth(toText, size) - 8, size, 2),
            ),
          );
          if (animate) fadeIn(labels, 380, 420);
          group.append(labels);

          // The keyboard stop: the box of the line.
          const top = Math.min(y1, y2) - 8;
          const el = hitRect(xL, top, xR - xL, Math.abs(y2 - y1) + 16);
          group.append(el);
          return { el, label: describe(item) };
        });

    const rows = (item: SlopeItem, index: number): TooltipRow[] => [
      {
        id: "from",
        name: fromLabel,
        value: format(item.from),
        color: colors[index] as string,
        shape: "dot",
      },
      {
        id: "to",
        name: toLabel,
        value: format(item.to),
        color: colors[index] as string,
        shape: "dot",
      },
      { id: "delta", name: deltaLabel, value: change(item), color: "transparent", emphasis: true },
    ];

    return {
      summary: `${items.length} ${items.length === 1 ? "line" : "lines"}: ${fromLabel} to ${toLabel}`,
      marks,
      maxHoverRows: 3,
      hit: (x, py) => {
        if (!items.length || x < 0 || x > width || py < 0 || py > height) return -1;
        const ly = py - MARGIN.top;
        if (big) {
          const t = Math.min(1, Math.max(0, (x - xL) / (xR - xL)));
          return closest(t, ly, x <= xL || x >= xR ? Number.POSITIVE_INFINITY : 16);
        }
        if (x <= xL) return nearest(labelFrom, ly);
        if (x >= xR) return nearest(labelTo, ly);
        const t = (x - xL) / (xR - xL);
        const onLine = Array.from(ysFrom, (from, i) => from + ((ysTo[i] as number) - from) * t);
        const best = nearest(onLine, ly);
        return Math.abs((onLine[best] as number) - ly) <= 16 ? best : -1;
      },
      hover: (index) => {
        const item = items[index];
        if (!item) return null;
        return {
          title: item.label,
          rows: rows(item, index),
          x: (xL + xR) / 2,
          y: MARGIN.top + ((ysFrom[index] as number) + (ysTo[index] as number)) / 2,
        };
      },
      snapshot: () => {
        const columns: SnapshotSeries[] = [
          {
            id: "from",
            name: fromLabel,
            color: "transparent",
            values: items.map((item) => item.from),
            text: items.map((item) => format(item.from)),
          },
          {
            id: "to",
            name: toLabel,
            color: "transparent",
            values: items.map((item) => item.to),
            text: items.map((item) => format(item.to)),
          },
          {
            id: "delta",
            name: deltaLabel,
            color: "transparent",
            values: items.map((item) => item.to - item.from),
            text: items.map(change),
          },
        ];
        const showKey = !bySeries && flag(this, "legend", true) && items.length > 0;
        return {
          title: this.getAttribute("label") ?? "Slope chart",
          categoryHeader: this.getAttribute("category-label") ?? "Category",
          categories: items.map((item) => item.label),
          series: columns,
          legend: showKey
            ? [
                {
                  id: "up",
                  name: goodUp ? "▲" : "▼",
                  color: DIRECTION_COLORS.up,
                  shape: "line" as const,
                },
                {
                  id: "down",
                  name: goodUp ? "▼" : "▲",
                  color: DIRECTION_COLORS.down,
                  shape: "line" as const,
                },
              ]
            : [],
        };
      },
    };
  }
}

/** Registers `<ui-slope-chart>` (or `<prefix>-slope-chart`) and returns the tag. */
export function defineSlopeChart(options?: DefineOptions): string {
  return defineElement("slope-chart", UiSlopeChart, options);
}
