// The cartesian engine behind <ui-bar-chart>, <ui-line-chart>, <ui-area-chart> and
// <ui-combo-chart>: columns, lines and areas on one plot, any number of value axes, stacking,
// a crosshair, drag-to-zoom and an overview brush. The four elements are presets of it, the way
// the React kit's `BarChart`, `LineChart`, `AreaChart` and `ComboChart` are presets of
// `CartesianChart`.
import { sharedSampleIndices } from "@jcsoftdev/ui-core/chart/downsample";
import {
  formatNumber,
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import type { Curve } from "@jcsoftdev/ui-core/chart/path";
import { pointScale } from "@jcsoftdev/ui-core/chart/scale";
import { dayOfMonth, formatDate, shortMonth } from "@jcsoftdev/ui-core/chart/scale-time";
import type { StackMode } from "@jcsoftdev/ui-core/chart/stack";
import { adoptStyles, emit, rootOf, uid } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  type HoverInfo,
  type MarkShape,
  svg,
  type TooltipRow,
} from "./chart-base.js";
import {
  axisBottom,
  axisCategoryLeft,
  axisLeft,
  axisRight,
  baseline,
  gridLines,
} from "./e17-axes.js";
import css from "./e17-chart.css.js";
import {
  type AxisSpec,
  type CartesianLayout,
  computeLayout,
  type MarkKind,
  type ResolvedSeries,
  type SeriesGeometry,
  type ValueAxisOptions,
  type XValue,
} from "./e17-layout.js";

export type { AxisSpec, MarkKind, ValueAxisOptions, XValue };

/** One series. Bar charts take `ranges` (floating bars), `colors` and `stackGroup`. */
export interface CartesianSeries {
  id: string;
  name: string;
  /** One value per category; `null` leaves a gap. Not needed with `ranges`. */
  data?: ReadonlyArray<number | null>;
  /** Floating bars: `[start, end]` per category. The value shown is the end. */
  ranges?: ReadonlyArray<readonly [number, number] | null>;
  /** How the series is drawn; the preset picks it (a combo chart reads it from each series). */
  type?: MarkKind;
  /** Id of the value axis: "left" (default), "right" or one declared in `axes`. */
  axis?: string;
  color?: string;
  dashed?: boolean;
  /** Overrides the chart `value-format` for this series. */
  format?: ValueFormat;
  /** With `stack`, series of one group pile up and each group is a column of its own. */
  stackGroup?: string;
  /** Color of each bar; `undefined` entries keep the series color. */
  colors?: ReadonlyArray<string | undefined>;
}

/** Visible strings beyond the base ones. English defaults. */
export interface CartesianLabels {
  total: string;
  resetZoom: string;
  brush: string;
  category: string;
}

const DEFAULT_COPY: CartesianLabels = {
  total: "Total",
  resetZoom: "Reset zoom",
  brush: "Visible range",
  category: "Category",
};

const BRUSH_HEIGHT = 52;
const BRUSH_GAP = 12;
const DEFAULT_MAX_POINTS = 2000;
/** Above this many categories the marks are virtual (named on demand, no element each). */
const VIRTUAL_MARKS = 150;
const EASE = "cubic-bezier(.22,1,.36,1)";

type IndexRange = readonly [number, number];

const shapeOf = (kind: MarkKind, dashed: boolean): MarkShape =>
  kind === "line" ? (dashed ? "dashed" : "line") : "square";

const pick = <T>(values: readonly T[], indices: readonly number[] | null): readonly T[] =>
  indices ? indices.map((index) => values[index] as T) : values;

/** Shared by the four cartesian elements; a subclass says which kind its series are. */
export abstract class CartesianElement extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "orientation",
    "stack",
    "curve",
    "markers",
    "data-labels",
    "bar-radius",
    "x-scale",
    "grid",
    "brush",
    "crosshair",
    "gradient",
    "distributed",
    "max-points",
    "category-label-rotation",
    "category-tick-every",
  ];
  static override retain = true;

  /** Kind of every series (bar: column, line: line...); `undefined` reads it from `series[i].type`. */
  protected abstract readonly kind: MarkKind | undefined;
  /** Curve when the `curve` attribute is absent. */
  protected readonly defaultCurve: Curve = "linear";

  /** Property forms of what attributes cannot carry. */
  yAxis: ValueAxisOptions = {};
  rightAxis: ValueAxisOptions = {};
  axes: readonly AxisSpec[] = [];
  /** Text of a category on the axis (dates get short locale defaults). */
  xFormat: ((value: XValue) => string) | undefined;
  copy: Partial<CartesianLabels> = {};

  #categories: readonly XValue[] = [];
  #series: readonly CartesianSeries[] = [];
  #range: IndexRange | null = null;
  #rangeTotal = 0;
  #layout: CartesianLayout | undefined;
  #windowStart = 0;
  #origin: readonly number[] | null = null;
  #cross: {
    band: SVGRectElement;
    line: SVGLineElement;
    dots: Array<[number, SVGCircleElement]>;
  } | null = null;
  #plot: SVGGElement | undefined;
  #defs: SVGDefsElement | undefined;
  #mini: SVGGElement | undefined;
  #selection: { from: number; to: number } | null = null;
  #dragFrom: number | null = null;
  #dragged = false;
  #slider: HTMLElement | undefined;
  #reset: HTMLButtonElement | undefined;
  #brush: { update(patch: object): void; destroy(): void } | undefined;
  #brushLoad = false;
  #brushWanted = false;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#paintCross(info?.index ?? null);
    });
    this.addEventListener(CHART_EVENT.data, (event) => {
      // A loading or empty screen replaced the drawing's children: put the overlays back.
      if ((event as CustomEvent).detail) this.#restoreOverlays();
    });
  }

  get categories(): readonly XValue[] {
    return this.#categories;
  }
  set categories(value: readonly XValue[]) {
    this.#categories = value;
    this.requestDraw();
  }
  get series(): readonly CartesianSeries[] {
    return this.#series;
  }
  set series(value: readonly CartesianSeries[]) {
    this.#series = value;
    this.requestDraw();
  }
  /** The zoomed window of category indices (inclusive), or `null` when the whole data shows. */
  get zoom(): IndexRange | null {
    return this.#range;
  }
  set zoom(value: IndexRange | null) {
    this.#setRange(value);
  }
  /** Shows the whole data again. */
  resetZoom(): void {
    this.#setRange(null);
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#brush?.destroy();
    this.#brush = undefined;
    this.#brushLoad = false;
    this.#slider?.remove();
    this.#reset?.remove();
  }

  protected override isEmpty(): boolean {
    return (
      this.#categories.length === 0 ||
      this.#series.every((item) => (item.ranges ?? item.data ?? []).every((value) => value == null))
    );
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    const opts = { signal };
    const local = (event: PointerEvent): number | null => {
      const layout = this.#layout;
      const box = root.getBoundingClientRect();
      if (!layout || !box.width) return null;
      const x = (event.clientX - box.left) * (layout.width / box.width) - layout.margin.left;
      const y = (event.clientY - box.top) * (layout.height / box.height) - layout.margin.top;
      return x < 0 || y < 0 || x > layout.innerWidth || y > layout.innerHeight ? null : x;
    };
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.hasAttribute("brush") || event.button !== 0 || event.pointerType === "touch")
          return;
        const x = local(event);
        if (x === null || this.#layout?.horizontal) return;
        this.#dragFrom = x;
        this.#dragged = false;
        root.setPointerCapture(event.pointerId);
      },
      opts,
    );
    root.addEventListener(
      "pointermove",
      (event) => {
        const layout = this.#layout;
        if (this.#dragFrom === null || !layout) return;
        const box = root.getBoundingClientRect();
        const raw = (event.clientX - box.left) * (layout.width / box.width) - layout.margin.left;
        const x = Math.min(Math.max(raw, 0), layout.innerWidth);
        if (!this.#dragged && Math.abs(x - this.#dragFrom) <= 4) return;
        this.#dragged = true;
        this.#selection = { from: Math.min(this.#dragFrom, x), to: Math.max(this.#dragFrom, x) };
        this.requestDraw("transient");
      },
      opts,
    );
    const finish = (event: PointerEvent) => {
      if (this.#dragFrom === null) return;
      const layout = this.#layout;
      const selection = this.#selection;
      this.#dragFrom = null;
      this.#selection = null;
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      if (this.#dragged) {
        this.#dragged = false;
        // The drag is the chart's gesture: claim it so no selection follows.
        event.preventDefault();
        if (layout && selection && event.type === "pointerup") {
          const lo = layout.indexAt(selection.from);
          const hi = layout.indexAt(selection.to);
          if (hi - lo >= 1) this.#setRange([this.#source(lo), this.#source(hi)]);
        }
        this.requestDraw("transient");
      }
    };
    root.addEventListener("pointerup", finish, opts);
    root.addEventListener("pointercancel", finish, opts);
  }

  /** Index in the full `categories` of mark `index` of the zoomed, sampled window. */
  #source(index: number): number {
    return this.#windowStart + (this.#origin ? (this.#origin[index] as number) : index);
  }

  #setRange(next: IndexRange | null): void {
    const total = this.#categories.length;
    const range = next && next[0] <= 0 && next[1] >= total - 1 ? null : next;
    if (range?.[0] === this.#range?.[0] && range?.[1] === this.#range?.[1]) return;
    this.#range = range;
    emit(this, "zoom", range);
    this.requestDraw();
  }

  #copy(): CartesianLabels {
    return { ...DEFAULT_COPY, ...this.copy };
  }

  #xLabel(context: DrawContext): (value: XValue) => string {
    if (this.xFormat) return this.xFormat;
    const options = { locale: context.locale, timeZone: context.timeZone };
    return (value) =>
      value instanceof Date
        ? `${dayOfMonth(value, options)} ${shortMonth(value, options)}`
        : typeof value === "number"
          ? formatNumber(value, { locale: context.locale })
          : value;
  }

  #resolve(context: DrawContext): ResolvedSeries[] {
    const categories = this.#categories;
    const distributed = this.hasAttribute("distributed");
    return this.#series.map((item, index) => {
      const kind = this.kind ?? item.type ?? "line";
      const ranges = item.ranges;
      const data = ranges ? ranges.map((range) => (range ? range[1] : null)) : (item.data ?? []);
      const colors =
        item.colors ??
        (distributed
          ? categories.map((_, position) => context.color(position + index))
          : undefined);
      return {
        id: item.id,
        name: item.name,
        kind,
        axis: item.axis ?? "left",
        color: context.color(index, item.color),
        dashed: item.dashed ?? false,
        format:
          item.format === undefined
            ? context.format
            : resolveFormat(item.format, {
                locale: context.locale,
                currency: this.getAttribute("currency") || undefined,
              }),
        data,
        from: ranges ? ranges.map((range) => (range ? range[0] : null)) : undefined,
        stackGroup: item.stackGroup,
        pointColors: colors,
      };
    });
  }

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height } = context;
    const copy = this.#copy();
    const categories = this.#categories;
    const total = categories.length;
    if (this.#rangeTotal !== total) {
      this.#range = null;
      this.#rangeTotal = total;
    }
    const orientation =
      this.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical";
    const horizontal = orientation === "horizontal";
    const stack = (
      ["normal", "percent"].includes(this.getAttribute("stack") ?? "")
        ? this.getAttribute("stack")
        : "none"
    ) as StackMode;
    const curve = (this.getAttribute("curve") as Curve | null) ?? this.defaultCurve;
    const dataLabels = this.hasAttribute("data-labels");
    const markers = this.hasAttribute("markers");
    const gradient = this.getAttribute("gradient") !== "off";
    const showGrid = this.getAttribute("grid") !== "off";
    const rotation = Number(this.getAttribute("category-label-rotation")) || 0;
    const every = Number(this.getAttribute("category-tick-every")) || undefined;
    const xLabel = this.#xLabel(context);
    const custom = this.xFormat != null;
    const titleOf = (value: XValue) =>
      value instanceof Date && !custom
        ? formatDate(value, { locale: context.locale, timeZone: context.timeZone })
        : xLabel(value);

    const resolved = this.#resolve(context);
    const visibleAll = resolved.filter((item) => !this.isHidden(item.id));
    const brushOn = this.hasAttribute("brush") && total > 2 && !horizontal;
    const range = this.#range;
    const start = range ? range[0] : 0;
    const end = range ? range[1] : total - 1;
    this.#windowStart = start;
    const windowed = range
      ? visibleAll.map((item) => ({
          ...item,
          data: item.data.slice(start, end + 1),
          from: item.from?.slice(start, end + 1),
          pointColors: item.pointColors?.slice(start, end + 1),
        }))
      : visibleAll;
    const windowCategories = range ? categories.slice(start, end + 1) : categories;

    const maxPointsAttr = this.getAttribute("max-points");
    const maxPoints = maxPointsAttr === "off" ? null : Number(maxPointsAttr) || DEFAULT_MAX_POINTS;
    const sample =
      maxPoints === null || horizontal || resolved.some((item) => item.kind === "column")
        ? null
        : sharedSampleIndices(
            windowed.map((item) => item.data),
            maxPoints,
          );
    this.#origin = sample;
    const series = sample
      ? windowed.map((item) => ({ ...item, data: pick(item.data, sample) }))
      : windowed;
    const shown = sample ? pick(windowCategories, sample) : windowCategories;
    const count = shown.length;

    const axisFormat = (format: ValueFormat | undefined) =>
      resolveAxisFormat(format, {
        locale: context.locale,
        currency: this.getAttribute("currency") || undefined,
      });
    const layout = computeLayout({
      width,
      height,
      categories: shown,
      series,
      orientation,
      stack,
      curve,
      dataLabels,
      barRadius: Number(this.getAttribute("bar-radius") ?? 6),
      xScale: (this.getAttribute("x-scale") as "auto" | "band" | "time" | null) ?? "auto",
      xLabel,
      axisFormat,
      valueFormat:
        this.valueFormat ?? (this.getAttribute("value-format") as ValueFormat | null) ?? undefined,
      yAxis: this.yAxis,
      rightAxis: this.rightAxis,
      axes: this.axes,
      labelRotation: rotation,
      categoryTickEvery: every,
      locale: context.locale,
      timeZone: context.timeZone,
      reserveBottom: brushOn ? BRUSH_HEIGHT + BRUSH_GAP : 0,
    });
    this.#layout = layout;
    const { margin, innerWidth, innerHeight } = layout;

    // The persistent skeleton: the plot group is rebuilt, the rest of the svg is kept.
    this.#plot ??= svg("g");
    this.#defs ??= svg("defs");
    if (!this.#plot.isConnected) root.append(this.#defs, this.#plot);
    const plot = this.#plot;
    const defs = this.#defs;
    defs.replaceChildren();
    plot.replaceChildren();
    plot.setAttribute("transform", `translate(${margin.left},${margin.top})`);

    const clipId = uid("reveal");
    const reveal = svg("rect", {
      x: -6,
      y: -24,
      width: innerWidth + 12,
      height: innerHeight + 48,
      style: "transform-box:fill-box;transform-origin:left center",
    });
    defs.append(svg("clipPath", { id: clipId }, reveal));
    const stacked = stack !== "none";
    const gradientIds = new Map<string, string>();
    if (gradient)
      for (const item of layout.geometry)
        if (item.kind === "area") {
          const id = uid("area");
          gradientIds.set(item.id, id);
          defs.append(
            svg(
              "linearGradient",
              { id, x1: 0, y1: 0, x2: 0, y2: 1 },
              svg("stop", {
                offset: "0%",
                style: `stop-color:${item.color};stop-opacity:${stacked ? 0.55 : 0.36}`,
              }),
              svg("stop", {
                offset: "100%",
                style: `stop-color:${item.color};stop-opacity:${stacked ? 0.22 : 0.02}`,
              }),
            ),
          );
        }

    if (showGrid)
      plot.append(
        gridLines(
          layout.valueTicks,
          horizontal ? "vertical" : "horizontal",
          horizontal ? innerHeight : innerWidth,
        ),
      );

    // Crosshair parts: the band sits under the marks, the line and the dots over them.
    const bandSize = layout.mode === "band" ? layout.step : 0;
    const crossOn = this.getAttribute("crosshair") !== "off";
    const band = svg("rect", { "data-e17": "band", rx: 8, display: "none", "aria-hidden": "true" });
    if (crossOn && bandSize > 0) plot.append(band);

    const lineGroup = (item: SeriesGeometry, markersOn: boolean) => {
      const group = svg("g", { "data-series": item.id });
      if (item.area)
        group.append(
          svg("path", {
            d: item.area,
            style: gradientIds.has(item.id)
              ? `fill:url(#${gradientIds.get(item.id)})`
              : `fill:${item.color};fill-opacity:${stacked ? 0.42 : 0.16}`,
          }),
        );
      if (item.line)
        group.append(
          svg("path", {
            d: item.line,
            fill: "none",
            "stroke-width": item.kind === "area" ? 2 : 2.5,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-dasharray": item.dashed ? "6 6" : undefined,
            style: `stroke:${item.color}`,
          }),
        );
      if (markersOn)
        for (const point of item.points)
          if (point)
            group.append(
              svg("circle", {
                cx: point.x,
                cy: point.y,
                r: 3.25,
                "stroke-width": 2,
                style: `fill:var(--surface);stroke:${item.color}`,
              }),
            );
      return group;
    };
    const dense = count <= Math.max(2, innerWidth / 9);
    const areas = svg("g", { "clip-path": `url(#${clipId})` });
    for (const item of layout.geometry)
      if (item.kind === "area") areas.append(lineGroup(item, markers && dense));
    plot.append(areas);

    const bars: SVGElement[] = [];
    for (const item of layout.geometry) {
      if (item.kind !== "column") continue;
      const group = svg("g", { "data-series": item.id });
      for (const bar of item.bars ?? []) {
        const path = svg("path", {
          d: bar.d,
          "data-bar": bar.index,
          style: `fill:${bar.color ?? item.color};${item.dashed ? "fill-opacity:.35;" : ""}transform-box:fill-box;transform-origin:${
            horizontal
              ? bar.negative
                ? "right center"
                : "left center"
              : bar.negative
                ? "center top"
                : "center bottom"
          }`,
        });
        bars.push(path);
        group.append(path);
      }
      plot.append(group);
    }
    const lines = svg("g", { "clip-path": `url(#${clipId})` });
    for (const item of layout.geometry)
      if (item.kind === "line") lines.append(lineGroup(item, markers && dense));
    plot.append(lines);

    const hasBars = layout.geometry.some((item) => item.kind === "column");
    const [d0, d1] = layout.valueScale.domain;
    const zero =
      hasBars && layout.valueScale.type !== "log" && d0 <= 0 && d1 >= 0
        ? layout.valueScale.map(0)
        : layout.zero;
    if (zero != null)
      plot.append(
        baseline(
          horizontal ? zero : 0,
          horizontal ? zero : innerWidth,
          horizontal ? 0 : zero,
          horizontal ? innerHeight : zero,
        ),
      );

    const line = svg("line", {
      "data-e17": "cross",
      y1: 0,
      y2: innerHeight,
      display: "none",
      "aria-hidden": "true",
    });
    if (crossOn && bandSize === 0 && !horizontal) plot.append(line);

    if (horizontal) {
      plot.append(
        axisCategoryLeft(layout.categoryTicks),
        axisBottom(layout.valueTicks, innerHeight),
      );
    } else {
      plot.append(axisBottom(layout.categoryTicks, innerHeight, rotation));
      for (const axis of layout.axes) {
        const left = axis.side === "left";
        const at = left ? -axis.offset : innerWidth + axis.offset;
        if (axis.color || axis.offset > 0)
          plot.append(
            svg("line", {
              x1: at,
              x2: at,
              y1: 0,
              y2: innerHeight,
              "shape-rendering": "crispEdges",
              "aria-hidden": "true",
              style: `stroke:${axis.color ?? "var(--line-strong)"};stroke-opacity:.55`,
            }),
          );
        plot.append((left ? axisLeft : axisRight)(axis.ticks, at, axis.title, axis.color));
      }
    }

    if (dataLabels) {
      const labelsGroup = svg("g", { "aria-hidden": "true" });
      for (const item of layout.geometry)
        for (const label of item.labels)
          labelsGroup.append(
            svg(
              "text",
              {
                x: label.x,
                y: label.y,
                "text-anchor": label.anchor,
                "data-e17": "label",
                "data-inside": label.inside || undefined,
                "data-series": item.id,
              },
              label.text,
            ),
          );
      plot.append(labelsGroup);
    }

    const dots: Array<[number, SVGCircleElement]> = [];
    if (crossOn)
      layout.geometry.forEach((item, seriesIndex) => {
        if (item.kind === "column") return;
        const dot = svg("circle", {
          "data-e17": "dot",
          r: 5,
          display: "none",
          "aria-hidden": "true",
          style: `fill:${item.color}`,
        });
        dots.push([seriesIndex, dot]);
        plot.append(dot);
      });
    this.#cross = { band, line, dots };

    if (this.#selection)
      plot.append(
        svg("rect", {
          "data-e17": "selection",
          x: this.#selection.from,
          y: 0,
          width: this.#selection.to - this.#selection.from,
          height: innerHeight,
          rx: 6,
          "stroke-width": 1,
        }),
      );

    // One focusable, transparent mark per category: the hit area and the keyboard target. Dense
    // charts name their marks lazily instead of building thousands of elements.
    const half = layout.step / 2;
    const textOf = (index: number) =>
      this.#describe(series, layout, stack, index, titleOf, copy, context).text;
    const virtual = count > VIRTUAL_MARKS;
    const marks: readonly ChartMark[] = virtual
      ? []
      : layout.positions.map((position, index) => {
          const el = svg("rect", {
            "data-e17": "hit",
            x: horizontal ? 0 : position - half,
            y: horizontal ? position - half : 0,
            width: horizontal ? innerWidth : layout.step,
            height: horizontal ? layout.step : innerHeight,
          });
          plot.append(el);
          return { el, label: textOf(index) };
        });

    if (context.animate) {
      reveal.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        duration: 900,
        easing: EASE,
        fill: "backwards",
      });
      const per = Math.min(28, 420 / Math.max(1, bars.length));
      bars.forEach((bar, index) => {
        bar.animate(
          [
            { transform: horizontal ? "scaleX(0)" : "scaleY(0)" },
            { transform: horizontal ? "scaleX(1)" : "scaleY(1)" },
          ],
          { duration: 620, delay: index * per, easing: EASE, fill: "backwards" },
        );
      });
    }

    this.#paintCross(context.hover);
    this.#syncOverlays(
      root,
      context,
      layout,
      brushOn,
      total,
      range,
      copy,
      series,
      titleOf,
      start,
      end,
    );

    const names = visibleAll.map((item) => item.name).join(", ");
    const sourceOf = (index: number) => this.#source(index);
    return {
      summary: `${count} ${copy.category.toLowerCase()}${count === 1 ? "" : "s"}: ${shown[0] ? titleOf(shown[0]) : ""} – ${shown[count - 1] ? titleOf(shown[count - 1] as XValue) : ""}. ${names}`,
      marks: virtual ? { count, label: textOf } : marks,
      maxHoverRows: resolved.length + (stack === "normal" ? 1 : 0),
      hit: (x, y) => {
        if (brushOn && y > height - BRUSH_HEIGHT - 6) return -1;
        return layout.indexAt(horizontal ? y - margin.top : x - margin.left);
      },
      hover: (index) => {
        if (index < 0 || index >= count) return null;
        const details = this.#describe(series, layout, stack, index, titleOf, copy, context);
        const position = layout.positions[index] as number;
        const ends = layout.geometry
          .map((item) => item.points[index])
          .filter((point): point is NonNullable<typeof point> => point != null);
        const content: HoverContent = horizontal
          ? {
              title: details.title,
              rows: details.rows,
              x: margin.left + (ends.length ? Math.max(...ends.map((p) => p.x)) : innerWidth / 2),
              y: margin.top + position,
              category: sourceOf(index),
            }
          : {
              title: details.title,
              rows: details.rows,
              x: margin.left + position,
              y:
                margin.top +
                Math.min(
                  Math.max(ends.length ? Math.min(...ends.map((p) => p.y)) : innerHeight / 2, 28),
                  innerHeight - 28,
                ),
              category: sourceOf(index),
            };
        return content;
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? "",
        categoryHeader: copy.category,
        categories: categories.map(titleOf),
        categoryValues: categories,
        series: resolved.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
          shape: shapeOf(item.kind, item.dashed),
          values: item.data,
          text: item.data.map((value, index) => {
            if (value == null) return "";
            const origin = item.from?.[index];
            return origin == null
              ? item.format(value)
              : `${item.format(origin)} – ${item.format(value)}`;
          }),
        })),
      }),
    };
  }

  /** Rows, title and a one-line text for the category at mark `index`. */
  #describe(
    series: readonly ResolvedSeries[],
    layout: CartesianLayout,
    stack: StackMode,
    index: number,
    titleOf: (value: XValue) => string,
    copy: CartesianLabels,
    context: DrawContext,
  ) {
    const category = this.#shownCategory(index);
    const rows: TooltipRow[] = [];
    let sum = 0;
    let stackable = 0;
    for (const item of series) {
      const raw = item.data[index];
      const layer = layout.layers.get(item.id);
      let note: string | undefined;
      if (layer && stack === "percent" && raw != null)
        note = formatPercent((layer.y1[index] as number) - (layer.y0[index] as number), {
          locale: context.locale,
        });
      if (layer && raw != null) {
        sum += raw;
        stackable += 1;
      }
      const origin = item.from?.[index];
      rows.push({
        id: item.id,
        name: item.name,
        value:
          raw == null
            ? "—"
            : origin != null
              ? `${item.format(origin)} – ${item.format(raw)}`
              : item.format(raw),
        color: item.pointColors?.[index] ?? item.color,
        shape: shapeOf(item.kind, item.dashed),
        note,
      });
    }
    const groups = new Set(series.map((item) => item.stackGroup ?? ""));
    if (stack === "normal" && stackable > 1 && groups.size <= 1)
      rows.push({
        id: "__total",
        name: copy.total,
        value: context.format(sum),
        color: "transparent",
        emphasis: true,
      });
    const title = titleOf(category);
    return {
      title,
      rows,
      text: `${title}: ${rows.map((row) => `${row.name} ${row.value}`).join(", ")}`,
    };
  }

  #shownCategory(index: number): XValue {
    const full = this.#categories;
    return full[this.#source(index)] as XValue;
  }

  /** Moves the crosshair (band, line and dots) to category `index`, or hides it. */
  #paintCross(index: number | null): void {
    const cross = this.#cross;
    const layout = this.#layout;
    if (!cross || !layout) return;
    const position = index === null ? undefined : layout.positions[index];
    const on = position !== undefined;
    const half = layout.step / 2;
    cross.band.setAttribute("display", on ? "inline" : "none");
    cross.line.setAttribute("display", on ? "inline" : "none");
    if (on) {
      if (layout.horizontal) {
        cross.band.setAttribute("x", "0");
        cross.band.setAttribute("y", `${position - half}`);
        cross.band.setAttribute("width", `${layout.innerWidth}`);
        cross.band.setAttribute("height", `${layout.step}`);
      } else {
        cross.band.setAttribute("x", `${position - half}`);
        cross.band.setAttribute("y", "0");
        cross.band.setAttribute("width", `${layout.step}`);
        cross.band.setAttribute("height", `${layout.innerHeight}`);
        cross.line.setAttribute("x1", `${position}`);
        cross.line.setAttribute("x2", `${position}`);
      }
    }
    for (const [seriesIndex, dot] of cross.dots) {
      const point = on && index !== null ? layout.geometry[seriesIndex]?.points[index] : null;
      dot.setAttribute("display", point ? "inline" : "none");
      if (point) {
        dot.setAttribute("cx", `${point.x}`);
        dot.setAttribute("cy", `${point.y}`);
      }
    }
  }

  // ---- overlays: the overview brush and the reset button ---------------------------------------

  #restoreOverlays(): void {
    for (const el of [this.#slider, this.#reset])
      if (el && !el.isConnected && this.#brushWanted) this.drawing.append(el);
  }

  #syncOverlays(
    root: SVGSVGElement,
    context: DrawContext,
    layout: CartesianLayout,
    brushOn: boolean,
    total: number,
    range: IndexRange | null,
    copy: CartesianLabels,
    _series: readonly ResolvedSeries[],
    titleOf: (value: XValue) => string,
    start: number,
    end: number,
  ): void {
    const drawing = this.drawing;
    this.#brushWanted = brushOn;
    if (!brushOn) {
      this.#mini?.remove();
      this.#slider?.remove();
      this.#reset?.remove();
      this.#brush?.destroy();
      this.#brush = undefined;
      this.#brushLoad = false;
      return;
    }
    const { margin, innerWidth } = layout;
    const top = context.height - BRUSH_HEIGHT;
    const track = pointScale({ count: total, range: [0, innerWidth] });
    const current = range ?? [0, total - 1];
    const x0 = track.center(current[0]);
    const x1 = track.center(current[1]);

    // The overview: every visible series in miniature, the window and its handles.
    this.#mini ??= svg("g", { "aria-hidden": "true" });
    const mini = this.#mini;
    mini.replaceChildren();
    mini.setAttribute("transform", `translate(${margin.left},${top})`);
    mini.append(
      svg("rect", {
        "data-e17": "track",
        x: 0,
        y: 0.5,
        width: innerWidth,
        height: BRUSH_HEIGHT - 1,
        rx: 10,
      }),
    );
    const fullSeries = this.#fullSeries(context);
    const values = fullSeries.flatMap((item) => item.data).filter((v): v is number => v != null);
    const lo = Math.min(0, ...values);
    const span = (values.length ? Math.max(...values) : 1) - lo || 1;
    const y = (value: number) => BRUSH_HEIGHT - 6 - ((value - lo) / span) * (BRUSH_HEIGHT - 14);
    fullSeries.forEach((item) => {
      let d = "";
      let open = false;
      item.data.forEach((value, index) => {
        if (value == null) {
          open = false;
          return;
        }
        d += `${open ? "L" : "M"}${track.center(index).toFixed(1)},${y(value).toFixed(1)}`;
        open = true;
      });
      mini.append(
        svg("path", {
          d,
          fill: "none",
          "stroke-width": 1.25,
          style: `stroke:${item.color};stroke-opacity:.85`,
        }),
      );
    });
    mini.append(
      svg("rect", { "data-e17": "veil", x: 0, y: 0, width: Math.max(0, x0), height: BRUSH_HEIGHT }),
      svg("rect", {
        "data-e17": "veil",
        x: x1,
        y: 0,
        width: Math.max(0, innerWidth - x1),
        height: BRUSH_HEIGHT,
      }),
      svg("rect", {
        "data-e17": "window",
        x: x0,
        y: 0.5,
        width: Math.max(0, x1 - x0),
        height: BRUSH_HEIGHT - 1,
        rx: 8,
        "stroke-width": 1.25,
      }),
    );
    for (const x of [x0, x1])
      mini.append(
        svg("rect", {
          "data-e17": "handle",
          x: x - 4,
          y: BRUSH_HEIGHT / 2 - 12,
          width: 8,
          height: 24,
          rx: 4,
          "stroke-width": 1.25,
        }),
      );
    if (!mini.isConnected) root.append(mini);

    this.#slider ??= document.createElement("div");
    const slider = this.#slider;
    slider.dataset.e17 = "slider";
    slider.setAttribute("role", "slider");
    slider.tabIndex = 0;
    slider.setAttribute("aria-label", copy.brush);
    slider.setAttribute("aria-valuemin", "0");
    slider.setAttribute("aria-valuemax", `${total - 1}`);
    slider.setAttribute("aria-valuenow", `${current[0]}`);
    slider.setAttribute(
      "aria-valuetext",
      `${titleOf(this.#categories[start] as XValue)} – ${titleOf(this.#categories[end] as XValue)}`,
    );
    Object.assign(slider.style, {
      position: "absolute",
      left: `${margin.left}px`,
      top: `${top}px`,
      width: `${innerWidth}px`,
      height: `${BRUSH_HEIGHT}px`,
      touchAction: "none",
      borderRadius: "10px",
    });
    if (!slider.isConnected) drawing.append(slider);

    this.#reset ??= document.createElement("button");
    const reset = this.#reset;
    reset.type = "button";
    reset.dataset.e17 = "reset";
    reset.textContent = copy.resetZoom;
    reset.hidden = !range;
    if (!reset.dataset.bound) {
      reset.dataset.bound = "";
      reset.addEventListener("click", () => this.resetZoom());
    }
    if (!reset.isConnected) drawing.append(reset);

    const patch = {
      count: total,
      range: current,
      offset: 0,
      indexAt: (pixel: number) => track.indexAt(pixel),
      position: (index: number) => track.center(index),
      onChange: (next: IndexRange) => this.#setRange(next),
    };
    if (this.#brush) this.#brush.update(patch);
    else if (!this.#brushLoad) {
      this.#brushLoad = true;
      import("@jcsoftdev/ui-core/chart/brush").then(({ attachIndexBrush }) => {
        if (!this.isConnected || !this.#brushWanted || this.#brush) return;
        this.#brush = attachIndexBrush(slider, patch);
        this.#brush.update(patch);
      });
    }
  }

  /** The visible series over the whole data (the overview ignores the zoom window). */
  #fullSeries(context: DrawContext): ResolvedSeries[] {
    return this.#resolve(context).filter((item) => !this.isHidden(item.id));
  }
}
