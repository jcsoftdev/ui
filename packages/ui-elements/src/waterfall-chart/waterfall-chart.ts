import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { DIRECTION_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { roundedRectPath } from "@jcsoftdev/ui-core/chart/path";
import { bandScale, linearScale } from "@jcsoftdev/ui-core/chart/scale";
import {
  pickLabels,
  type WaterfallBar,
  type WaterfallKind,
  type WaterfallStep,
  waterfallLayout,
} from "@jcsoftdev/ui-core/chart/waterfall";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import {
  AutoHeight,
  adoptPlot,
  axisBottom,
  axisFormatter,
  axisLeft,
  fadeIn,
  flag,
  gridLines,
  grow,
  hitRect,
  jsonAttr,
  resolveBound,
  text,
  type ValueAxis,
} from "../internal/e18-plot.js";
import css from "./waterfall-chart.css.js";

export type { WaterfallStep } from "@jcsoftdev/ui-core/chart/waterfall";

const V_MARGIN = { top: 22, right: 14, bottom: 30 };
const H_MARGIN = { top: 8, right: 56, bottom: 30 };

const FILL: Record<WaterfallKind, string> = {
  increase: DIRECTION_COLORS.up,
  decrease: DIRECTION_COLORS.down,
  start: DIRECTION_COLORS.flat,
  subtotal: DIRECTION_COLORS.flat,
  total: DIRECTION_COLORS.flat,
};

const LABEL_STYLE = "font-size:11px;font-weight:700;font-variant-numeric:tabular-nums";

const truncate = (label: string, maxChars: number): string =>
  label.length <= maxChars ? label : `${label.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;

const labelFill = (kind: WaterfallKind): string =>
  kind === "increase"
    ? DIRECTION_COLORS.up
    : kind === "decrease"
      ? DIRECTION_COLORS.down
      : "var(--ink)";

/**
 * `<ui-waterfall-chart>`: a bridge from a start value to a total. Increases and decreases float on
 * the running total, subtotals and totals stand on the baseline, and dashed connectors carry the eye
 * to the next step. Hover, arrow keys (Left/Right, or Up/Down when horizontal) and a tap show the
 * step and the running total; the legend (`<ui-chart-legend readonly>`) is a key to the three colors.
 *
 * Attributes (React props in brackets): `orientation` (`vertical` or `horizontal`), `connectors="off"`,
 * `data-labels="off"` (`dataLabels`), `grid="off"`, `increase-label`, `decrease-label`,
 * `total-label`, `running-label` (`increaseLabel`, `decreaseLabel`, `totalLabel`, `runningLabel`),
 * `value-label` and `category-label` (table column and header), `steps` (JSON), plus the chart
 * attributes (`label` is the React `title`, `description`, `height`, `aspect-ratio`, `loading`,
 * `locale`, `value-format` ...). Properties: `steps`, `yAxis` (`min`, `max`, `tickCount`, `format`,
 * `title`). Events: the chart events (`chart-hover`, `chart-select`, `chart-data` ...).
 */
export class UiWaterfallChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "steps",
    "orientation",
    "connectors",
    "data-labels",
    "grid",
    "increase-label",
    "decrease-label",
    "total-label",
    "running-label",
    "value-label",
    "category-label",
  ];
  #steps: readonly WaterfallStep[] | undefined;
  #axis: ValueAxis | undefined;
  readonly #height = new AutoHeight(this);

  get steps(): readonly WaterfallStep[] {
    return this.#steps ?? jsonAttr<WaterfallStep[]>(this, "steps") ?? [];
  }
  set steps(value: readonly WaterfallStep[]) {
    this.#steps = value;
    this.requestDraw();
  }
  get yAxis(): ValueAxis | undefined {
    return this.#axis;
  }
  set yAxis(value: ValueAxis | undefined) {
    this.#axis = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "waterfall-chart";
    this.#height.apply(320);
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.steps.length === 0;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, format, animate } = ctx;
    const layout = waterfallLayout(this.steps);
    const bars = layout.bars;
    const horizontal = this.getAttribute("orientation") === "horizontal";
    const increaseLabel = this.getAttribute("increase-label") ?? "Increase";
    const decreaseLabel = this.getAttribute("decrease-label") ?? "Decrease";
    const totalLabel = this.getAttribute("total-label") ?? "Total";
    const runningLabel = this.getAttribute("running-label") ?? "Running total";
    const valueLabel = this.getAttribute("value-label") ?? "Total";
    const connectors = flag(this, "connectors", true);
    const dataLabels = flag(this, "data-labels", true);
    const grid = flag(this, "grid", true);
    const axis = this.#axis ?? {};
    const tickFormat = axisFormatter(this, axis.format);

    const signed = (bar: WaterfallBar) =>
      bar.kind === "increase" ? `+${format(bar.value)}` : format(bar.value);
    const kindName = (kind: WaterfallKind) =>
      kind === "increase" ? increaseLabel : kind === "decrease" ? decreaseLabel : totalLabel;

    const margin = horizontal ? H_MARGIN : V_MARGIN;
    const top = margin.top;
    const innerHeight = Math.max(40, height - margin.top - margin.bottom);
    const domain: [number, number] = [
      resolveBound(axis.min, layout.min),
      resolveBound(axis.max, layout.max),
    ];

    let left: number;
    let innerWidth: number;
    if (horizontal) {
      left = Math.min(
        width * 0.36,
        bars.reduce((wide, bar) => Math.max(wide, estimateTextWidth(bar.label, 12)), 48) + 14,
      );
      innerWidth = Math.max(40, width - left - (dataLabels ? H_MARGIN.right : 12));
    } else {
      left = 0;
      innerWidth = 0;
    }

    const valueScale = horizontal
      ? linearScale({
          domain,
          range: [0, innerWidth],
          tickCount: axis.tickCount ?? Math.max(2, Math.round(innerWidth / 130)),
        })
      : linearScale({
          domain,
          range: [innerHeight, 0],
          tickCount: axis.tickCount ?? Math.max(3, Math.round(innerHeight / 56)),
        });
    const valueTicks = valueScale.ticks().map((tick) => ({
      key: tick,
      position: valueScale.map(tick),
      label: tickFormat(tick),
    }));
    if (!horizontal) {
      left =
        valueTicks.reduce((wide, tick) => Math.max(wide, estimateTextWidth(tick.label)), 16) + 18;
      innerWidth = Math.max(40, width - left - V_MARGIN.right);
    }
    const band = bandScale(
      horizontal
        ? { count: bars.length, range: [0, innerHeight], paddingInner: 0.3, paddingOuter: 0.1 }
        : { count: bars.length, range: [0, innerWidth], paddingInner: 0.32, paddingOuter: 0.16 },
    );
    const maxChars = horizontal
      ? Math.max(3, Math.floor((left - 14) / 6.6))
      : Math.max(3, Math.floor(band.step / 6.4));
    const categoryTicks = bars.map((bar, i) => ({
      key: bar.id,
      position: band.center(i),
      label: truncate(bar.label, maxChars),
    }));

    const shapes = bars.map((bar, i) => {
      const lo = Math.min(bar.from, bar.to);
      const hi = Math.max(bar.from, bar.to);
      if (horizontal) {
        const a = valueScale.map(lo);
        const w = Math.max(1.5, valueScale.map(hi) - a);
        return {
          bar,
          start: band.start(i),
          near: a,
          far: a + w,
          path: roundedRectPath(a, band.start(i), w, band.bandwidth, {
            tl: 4,
            tr: 4,
            br: 4,
            bl: 4,
          }),
        };
      }
      const y0 = valueScale.map(hi);
      const h = Math.max(1.5, valueScale.map(lo) - y0);
      return {
        bar,
        start: band.start(i),
        near: y0,
        far: y0 + h,
        path: roundedRectPath(band.start(i), y0, band.bandwidth, h, { tl: 4, tr: 4, br: 4, bl: 4 }),
      };
    });

    const plot = svg("g", { transform: `translate(${left},${top})` });
    root.append(plot);
    if (grid)
      plot.append(
        gridLines(
          valueTicks,
          horizontal ? "vertical" : "horizontal",
          horizontal ? innerHeight : innerWidth,
          valueScale.map(0),
        ),
      );
    if (horizontal) plot.append(axisLeft(categoryTicks, 0), axisBottom(valueTicks, innerHeight));
    else plot.append(axisLeft(valueTicks, 0, axis.title), axisBottom(categoryTicks, innerHeight));

    if (connectors) {
      const lines = svg("g", { "aria-hidden": "true" });
      for (let i = 0; i < shapes.length - 1; i++) {
        const shape = shapes[i];
        const next = shapes[i + 1];
        if (!shape || !next) continue;
        const level = valueScale.map(shape.bar.to);
        const line = svg("line", {
          x1: horizontal ? level : shape.start + band.bandwidth,
          x2: horizontal ? level : next.start,
          y1: horizontal ? shape.start + band.bandwidth : level,
          y2: horizontal ? next.start : level,
          "stroke-dasharray": "3 3",
          "shape-rendering": "crispEdges",
          style: "stroke:var(--ink-3);stroke-opacity:0.7",
        });
        if (animate) fadeIn(line, 360, 520);
        lines.append(line);
      }
      plot.append(lines);
    }

    const shown = horizontal
      ? shapes.map(() => true)
      : pickLabels(
          shapes.map((shape) => ({
            center: shape.start + band.bandwidth / 2,
            width: estimateTextWidth(signed(shape.bar), 11),
            y: shape.near - 6,
          })),
        );

    const marks: ChartMark[] = shapes.map((shape, i) => {
      const group = svg("g", { "data-row": "" });
      plot.append(group);
      const bandRect = horizontal
        ? {
            x: -left,
            y: shape.start - (band.step - band.bandwidth) / 2,
            width: left + innerWidth + 12,
            height: band.step,
          }
        : {
            x: shape.start - (band.step - band.bandwidth) / 2,
            y: 0,
            width: band.step,
            height: innerHeight,
          };
      group.append(
        svg("rect", { ...bandRect, rx: 6, "data-band": "", style: "fill:var(--chart-grid)" }),
      );
      const path = svg("path", {
        "data-bar": "",
        d: shape.path,
        "aria-hidden": "true",
        "fill-opacity": shape.bar.kind === "subtotal" ? 0.62 : 0.9,
        style: `fill:${FILL[shape.bar.kind]};transform-box:fill-box;transform-origin:${horizontal ? "left center" : "center bottom"}`,
      });
      group.append(path);
      if (animate)
        grow(path, horizontal ? "x" : "y", i, {
          duration: 560,
          step: Math.min(60, 520 / Math.max(1, bars.length)),
          max: 520,
        });
      if (dataLabels && shown[i]) {
        const label = text(
          signed(shape.bar),
          horizontal
            ? { x: shape.far + 6, y: shape.start + band.bandwidth / 2, dy: "0.34em" }
            : { x: shape.start + band.bandwidth / 2, y: shape.near - 6, "text-anchor": "middle" },
          `fill:${labelFill(shape.bar.kind)};${LABEL_STYLE}`,
        );
        label.setAttribute("aria-hidden", "true");
        if (animate) fadeIn(label, 360, 520);
        group.append(label);
      }
      const el = hitRect(bandRect.x, bandRect.y, bandRect.width, bandRect.height);
      group.append(el);
      return {
        el,
        label: `${shape.bar.label}. ${kindName(shape.bar.kind)} ${signed(shape.bar)}. ${runningLabel} ${format(shape.bar.to)}`,
      };
    });

    return {
      summary: `${bars.length} ${bars.length === 1 ? "step" : "steps"}`,
      marks,
      maxHoverRows: 2,
      hit: (x, y) => {
        if (!bars.length) return -1;
        const px = x - left;
        const py = y - top;
        if (py < 0 || py > innerHeight) return -1;
        if (!horizontal && (px < 0 || px > innerWidth)) return -1;
        return band.indexAt(horizontal ? py : px);
      },
      hover: (index) => {
        const shape = shapes[index];
        if (!shape) return null;
        const bar = shape.bar;
        const rows: TooltipRow[] = [
          {
            id: "value",
            name: kindName(bar.kind),
            value: signed(bar),
            color: FILL[bar.kind],
            shape: "square",
          },
          {
            id: "running",
            name: runningLabel,
            value: format(bar.to),
            color: "var(--ink-3)",
            shape: "dot",
          },
        ];
        return {
          title: bar.label,
          rows,
          x: horizontal ? left + shape.far : left + band.center(index),
          y: horizontal ? top + band.center(index) : top + shape.near,
        };
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? "Waterfall chart",
        categoryHeader: this.getAttribute("category-label") ?? "Category",
        categories: bars.map((bar) => bar.label),
        series: [
          {
            id: "value",
            name: valueLabel,
            color: "transparent",
            values: bars.map((bar) => bar.value),
            text: bars.map((bar) => `${kindName(bar.kind)}: ${signed(bar)}`),
          },
          {
            id: "running",
            name: runningLabel,
            color: "transparent",
            values: bars.map((bar) => bar.to),
            text: bars.map((bar) => format(bar.to)),
          },
        ],
        legend: [
          { id: "up", name: increaseLabel, color: DIRECTION_COLORS.up, shape: "square" as const },
          {
            id: "down",
            name: decreaseLabel,
            color: DIRECTION_COLORS.down,
            shape: "square" as const,
          },
          { id: "total", name: totalLabel, color: DIRECTION_COLORS.flat, shape: "square" as const },
        ],
      }),
    };
  }
}

/** Registers `<ui-waterfall-chart>` (or `<prefix>-waterfall-chart`) and returns the tag. */
export function defineWaterfallChart(options?: DefineOptions): string {
  return defineElement("waterfall-chart", UiWaterfallChart, options);
}
