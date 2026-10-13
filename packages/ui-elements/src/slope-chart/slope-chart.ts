import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { DIRECTION_COLORS, directionOf, seriesColor } from "@jcsoftdev/ui-core/chart/palette";
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
} from "../internal/chart-base.js";
import {
  AutoHeight,
  adoptPlot,
  fadeIn,
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

/** Shortens `label` with an ellipsis to fit `room` pixels; empty when not even two characters fit. */
function ellipsize(label: string, room: number, size = 12): string {
  if (estimateTextWidth(label, size) <= room) return label;
  const chars = Math.floor(room / (size * 0.58)) - 1;
  return chars >= 2 ? `${label.slice(0, chars).trimEnd()}…` : "";
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
    this.#height.apply(
      Math.max(260, this.items.length * (LABEL_GAP + 5) + MARGIN.top + MARGIN.bottom),
    );
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, format, locale, animate } = ctx;
    const items = this.items;
    const fromLabel = this.getAttribute("from-label") ?? "Before";
    const toLabel = this.getAttribute("to-label") ?? "After";
    const deltaLabel = this.getAttribute("delta-label") ?? "Change";
    const bySeries = this.getAttribute("color-by") === "series";
    const goodUp = !flag(this, "lower-is-better");
    const narrow = width < 440;
    const size = narrow ? 11 : 12;

    const colors = items.map((item, i) => {
      if (item.color) return item.color;
      if (bySeries) return seriesColor(i);
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
    const leftWidth = Math.min(
      room,
      sideWidth((item) => item.from),
    );
    const rightWidth = Math.min(
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
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const y = linearScale({
      domain: items.length ? [lo, hi] : [0, 1],
      range: [innerHeight, 0],
      nice: false,
    });
    const ysFrom = items.map((item) => y.map(item.from));
    const ysTo = items.map((item) => y.map(item.to));
    const labelFrom = spreadSlopeLabels(ysFrom, LABEL_GAP, 0, innerHeight);
    const labelTo = spreadSlopeLabels(ysTo, LABEL_GAP, 0, innerHeight);

    // Column headers, the two axes.
    root.append(
      svg(
        "g",
        { "aria-hidden": "true" },
        text(
          ellipsize(fromLabel, leftWidth + 40, 11),
          { x: xL, y: 12, "text-anchor": "middle" },
          HEADER_STYLE,
        ),
        text(
          ellipsize(toLabel, rightWidth + 40, 11),
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

    const marks: ChartMark[] = items.map((item, i) => {
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
          ellipsize(item.label, leftWidth - 16 - estimateTextWidth(fromText, size) - 8, size),
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
          ellipsize(item.label, rightWidth - 16 - estimateTextWidth(toText, size) - 8, size),
        ),
      );
      if (animate) fadeIn(labels, 380, 420);
      group.append(labels);

      // The keyboard stop: the box of the line.
      const top = Math.min(y1, y2) - 8;
      const el = hitRect(xL, top, xR - xL, Math.abs(y2 - y1) + 16);
      group.append(el);
      return {
        el,
        label: `${item.label}. ${fromLabel} ${fromText}, ${toLabel} ${toText}, ${deltaLabel} ${change(item)}`,
      };
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
        if (x <= xL) return nearest(labelFrom, ly);
        if (x >= xR) return nearest(labelTo, ly);
        const t = (x - xL) / (xR - xL);
        const onLine = ysFrom.map((from, i) => from + ((ysTo[i] as number) - from) * t);
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
