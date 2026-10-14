import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  buildCategoryAxis,
  fullCategoryLabel,
  type XValue,
} from "@jcsoftdev/ui-core/chart/category-axis-time";
import { formatPercent, resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { areaPath, type Curve, type Point } from "@jcsoftdev/ui-core/chart/path";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { type StreamOffset, type StreamOrder, streamLayout } from "@jcsoftdev/ui-core/chart/stream";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { axisBottom, axisFormatOf, axisLeft, EASE, gridLines } from "../internal/e19-axes.js";
import css from "./stream-graph.css.js";

const MARGIN = { top: 10, right: 18, bottom: 30 };

/** One stream: `data` holds one value per category (`null` and negatives count as zero). */
export interface StreamSeries {
  id: string;
  name: string;
  data: ReadonlyArray<number | null>;
  /** CSS color; defaults to the palette slot of the series. */
  color?: string;
  /** Overrides the chart `value-format` for this series. */
  format?: ValueFormat;
}

/** Strings the stream graph adds to the base labels. */
export interface StreamLabels {
  total: string;
  category: string;
}
const DEFAULT_TEXT: StreamLabels = { total: "Total", category: "Category" };

/** Flowing stacked areas around a moving baseline; the other charts' `series` and `categories`. */
interface Stream {
  series: StreamSeries;
  index: number;
  color: string;
  top: Point[];
  bottom: Point[];
  thickest: number;
  thickness: number;
}

/**
 * `<ui-stream-graph>`: flowing stacked areas around a moving baseline (the React `StreamGraph`).
 * Hover a stream to isolate it (the others fade); the tooltip lists every stream at that point in
 * time. Keyboard: Left and Right move through time, Up and Down switch stream (the tooltip names it).
 * Attributes: `offset` (`wiggle`, `silhouette`, `zero`, `expand`), `order` (`inside-out`,
 * `ascending`, `none`), `curve` (`smooth`, `linear`, `step`...), `stream-labels="off"`,
 * `x-scale` (`auto`, `point`, `time`), `grid="off"`, plus the chart attributes. Properties:
 * `categories` (strings, numbers or dates), `series`, `xFormat`, `labels` (`total`, `category`).
 * Legend, tooltip and data table are the `ui-chart-*` parts.
 */
export class UiStreamGraph extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "offset",
    "order",
    "curve",
    "stream-labels",
    "x-scale",
    "grid",
  ];
  declare labels: Partial<ChartLabels & StreamLabels>;
  xFormat: ((value: XValue) => string) | undefined;
  #categories: readonly XValue[] = [];
  #series: readonly StreamSeries[] = [];
  /** The stream the pointer is on or the keyboard moved to (a series id). */
  #focus: string | null = null;

  get categories(): readonly XValue[] {
    return this.#categories;
  }
  set categories(value: readonly XValue[]) {
    this.#categories = value;
    this.requestDraw();
  }
  get series(): readonly StreamSeries[] {
    return this.#series;
  }
  set series(value: readonly StreamSeries[]) {
    this.#series = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "stream-graph";
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", "340");
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return !this.#series.some((item) => item.data.some((value) => value != null && value > 0));
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    // The pointer leaving ends the isolation it started.
    this.drawing.addEventListener("pointerleave", () => this.#point(null), { signal });
    root.addEventListener("pointerleave", () => this.#point(null), { signal });
  }

  #point(id: string | null): void {
    if (this.#focus === id) return;
    this.#focus = id;
    this.highlight(id);
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, format, color, animate, locale, timeZone } = context;
    const text: StreamLabels = { ...DEFAULT_TEXT, ...this.labels };
    const offset = (this.getAttribute("offset") as StreamOffset | null) ?? "wiggle";
    const order = (this.getAttribute("order") as StreamOrder | null) ?? "inside-out";
    const curve = (this.getAttribute("curve") as Curve | null) ?? "smooth";
    const grid = this.getAttribute("grid") !== "off";
    const labelsOn = this.getAttribute("stream-labels") !== "off";
    const categories = this.#categories;
    const all = this.#series;
    const visible = all.filter((item) => !this.isHidden(item.id));
    const showAxis = offset === "zero" || offset === "expand";
    const left = showAxis ? 52 : 14;
    const innerWidth = Math.max(40, width - left - MARGIN.right);
    const innerHeight = Math.max(10, height - MARGIN.top - MARGIN.bottom);

    const layout = streamLayout(
      visible.map((item) => item.data),
      offset,
      order,
    );
    const xScale = this.getAttribute("x-scale");
    const axis = buildCategoryAxis(categories, innerWidth, {
      mode: xScale === "point" ? "point" : "time",
      format: this.xFormat,
      locale,
      timeZone,
    });
    const [lo, hi] = layout.domain;
    const pad = (hi - lo) * 0.04;
    const y = linearScale({
      domain: [lo - pad, hi + pad],
      range: [innerHeight, 0],
      nice: showAxis,
      tickCount: 5,
    });
    const streams: Stream[] = visible.map((item, k) => {
      const layer = layout.layers[k] as { y0: number[]; y1: number[] };
      const top = axis.positions.map((x, i) => ({ x, y: y.map(layer.y1[i] as number) }));
      const bottom = axis.positions.map((x, i) => ({ x, y: y.map(layer.y0[i] as number) }));
      let thickest = 0;
      let thickness = 0;
      top.forEach((point, i) => {
        const t = (bottom[i] as Point).y - point.y;
        if (t > thickness) {
          thickness = t;
          thickest = i;
        }
      });
      const index = all.indexOf(item);
      return {
        series: item,
        index,
        color: color(index, item.color),
        top,
        bottom,
        thickest,
        thickness,
      };
    });
    const axisFormat =
      offset === "expand"
        ? (v: number) => formatPercent(v, { decimals: 0, locale })
        : axisFormatOf(this, locale);
    const yTicks = showAxis
      ? y.ticks().map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }))
      : [];
    // Visual order, top of the screen first: the tooltip and Up/Down use it.
    const currency = this.getAttribute("currency") || undefined;
    const own = (valueFormat: ValueFormat) => resolveFormat(valueFormat, { locale, currency });
    const topToBottom = layout.order.slice().reverse();

    const plot = svg("g", { transform: `translate(${left},${MARGIN.top})` });
    if (grid) {
      plot.append(gridLines(showAxis ? yTicks : [], "horizontal", innerWidth));
      if (!showAxis) plot.append(gridLines(axis.ticks, "vertical", innerHeight));
    }
    if (showAxis) plot.append(axisLeft(yTicks, 0));
    plot.append(axisBottom(axis.ticks, innerHeight));

    const shapes = svg("g");
    for (const stream of streams)
      shapes.append(
        svg("path", {
          d: areaPath(stream.top, stream.bottom, curve),
          "data-stream": stream.series.id,
          "data-series": stream.series.id,
          "stroke-width": 0.75,
          "stroke-linejoin": "round",
          "aria-hidden": "true",
          style: `fill:${stream.color};fill-opacity:.88;stroke:var(--surface);stroke-opacity:.9`,
        }),
      );
    plot.append(shapes);

    const names = svg("g", { "aria-hidden": "true" });
    if (labelsOn)
      for (const stream of streams) {
        const label = stream.series.name;
        const need = estimateTextWidth(label, 12) + 8;
        if (stream.thickness < 17 || need > innerWidth * 0.5) continue;
        const peak = stream.top[stream.thickest] as Point;
        const x = Math.min(innerWidth - need / 2, Math.max(need / 2, peak.x));
        const cy = (peak.y + (stream.bottom[stream.thickest] as Point).y) / 2;
        names.append(
          svg(
            "text",
            {
              x,
              y: cy,
              dy: "0.34em",
              "text-anchor": "middle",
              "data-series": stream.series.id,
              "stroke-width": 3,
              "stroke-linejoin": "round",
              style:
                "fill:var(--ink);stroke:var(--surface);stroke-opacity:.85;paint-order:stroke;font-size:12px;font-weight:700;pointer-events:none",
            },
            label,
          ),
        );
      }
    plot.append(names);

    // One column per category: the keyboard stop, the hit area and the crosshair (the line after it).
    const half = Math.max(2, axis.step / 2);
    const columns: ChartMark[] = [];
    // The focused stream (Up and Down) leads the announced text of the column it is read in.
    const columnLabel = (i: number): string => {
      const parts = visible.map((item) => `${item.name}: ${format(item.data[i] ?? 0)}`);
      const focus = visible.find((item) => item.id === this.#focus);
      return `${focus ? `${focus.name}. ` : ""}${fullLabel(i)}. ${parts.join(", ")}`;
    };
    const fullLabel = (i: number) =>
      this.xFormat
        ? this.xFormat(categories[i] as XValue)
        : fullCategoryLabel(categories[i] as XValue, { locale, timeZone });
    const rowsAt = (i: number): TooltipRow[] => {
      const rows: TooltipRow[] = topToBottom.map((k) => {
        const item = visible[k] as StreamSeries;
        const value = item.data[i] ?? 0;
        const total = layout.totals[i] as number;
        return {
          id: item.id,
          name: item.name,
          value: item.format ? own(item.format)(value) : format(value),
          color: color(all.indexOf(item), item.color),
          shape: "square" as const,
          note: total ? formatPercent(value / total, { decimals: 0, locale }) : undefined,
        };
      });
      if (rows.length)
        rows.push({
          id: "__total",
          name: text.total,
          value: format(layout.totals[i] as number),
          color: "transparent",
          emphasis: true,
        });
      return rows;
    };
    categories.forEach((_, i) => {
      const x = axis.positions[i] as number;
      const rect = svg("rect", {
        x: Math.max(-6, x - half),
        y: 0,
        width: half * 2,
        height: innerHeight,
        "data-col": i,
      });
      plot.append(
        rect,
        svg("line", {
          x1: x,
          x2: x,
          y1: 0,
          y2: innerHeight,
          "stroke-dasharray": "3 4",
          "aria-hidden": "true",
          style: "stroke:var(--chart-crosshair)",
        }),
      );
      columns.push({ el: rect, label: columnLabel(i) });
    });
    root.append(plot);
    if (animate) {
      shapes.animate(
        [
          { clipPath: "inset(-24px 100% -24px -6px)" },
          { clipPath: "inset(-24px -6px -24px -6px)" },
        ],
        { duration: 1000, easing: EASE, fill: "backwards" },
      );
      names.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 420,
        delay: 750,
        easing: "linear",
        fill: "backwards",
      });
    }

    const streamAt = (px: number, py: number): string | null => {
      const index = axis.indexAt(px);
      if (index < 0) return null;
      const value = y.invert(py);
      for (let k = 0; k < visible.length; k += 1) {
        const layer = layout.layers[k] as { y0: number[]; y1: number[] };
        if (value >= (layer.y0[index] as number) && value <= (layer.y1[index] as number))
          return (visible[k] as StreamSeries).id;
      }
      return null;
    };
    const pick = (id: string | null, delta: number): string | null => {
      const ids = topToBottom.map((k) => (visible[k] as StreamSeries).id);
      if (!ids.length) return null;
      if (id == null) return ids[delta > 0 ? 0 : ids.length - 1] as string;
      const next = ids.indexOf(id) + delta;
      return next < 0 || next >= ids.length ? null : (ids[next] as string);
    };

    return {
      summary: `${visible.length} streams over ${categories.length} points, from ${fullLabel(0)} to ${fullLabel(categories.length - 1)}.`,
      marks: columns,
      maxHoverRows: all.length + 1,
      hit: (x, yy, _target, radius) => {
        const px = x - left;
        const py = yy - MARGIN.top;
        if (px < -radius || px > innerWidth + radius || py < -radius || py > innerHeight + radius)
          return -1;
        this.#point(streamAt(Math.min(innerWidth, Math.max(0, px)), py));
        return axis.indexAt(Math.min(innerWidth, Math.max(0, px)));
      },
      hover: (i): HoverContent | null => {
        const rows = rowsAt(i);
        if (!rows.length) return null;
        const focused = visible.find((item) => item.id === this.#focus);
        const stream = streams.find((s) => s.series.id === this.#focus);
        return {
          title: fullLabel(i),
          rows,
          body: focused
            ? `${focused.name}: ${focused.format ? own(focused.format)(focused.data[i] ?? 0) : format(focused.data[i] ?? 0)}`
            : undefined,
          x: left + (axis.positions[i] as number),
          y:
            MARGIN.top +
            (stream
              ? ((stream.top[i] as Point).y + (stream.bottom[i] as Point).y) / 2
              : innerHeight / 2),
        };
      },
      nav: (index, intent) => {
        if (intent === "left") return Math.max(0, index - 1);
        if (intent === "right") return Math.min(categories.length - 1, index + 1);
        if (intent === "home") return 0;
        if (intent === "end") return categories.length - 1;
        if (intent === "up" || intent === "down") {
          this.#focus = pick(this.#focus, intent === "down" ? 1 : -1);
          this.highlight(this.#focus);
          for (let k = 0; k < columns.length; k += 1)
            (columns[k] as { el: Element }).el.setAttribute("aria-label", columnLabel(k));
          // Same column, other stream: a transient frame re-runs `hover` so the tooltip names it.
          this.requestDraw("transient");
        }
        return index;
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? "",
        categoryHeader: text.category,
        categories: categories.map((_, i) => fullLabel(i)),
        categoryValues: categories.map((value) =>
          value instanceof Date || typeof value === "number" ? value : String(value),
        ),
        series: all.map((item, i) => ({
          id: item.id,
          name: item.name,
          color: color(i, item.color),
          shape: "square" as const,
          hidden: this.isHidden(item.id),
          values: categories.map((_, k) => item.data[k] ?? null),
          text: categories.map((_, k) => {
            const value = item.data[k];
            return value == null ? "" : item.format ? own(item.format)(value) : format(value);
          }),
        })),
      }),
    };
  }
}

/** Registers `<ui-stream-graph>` (or `<prefix>-stream-graph`) and returns the tag. */
export function defineStreamGraph(options?: DefineOptions): string {
  return defineElement("stream-graph", UiStreamGraph, options);
}
