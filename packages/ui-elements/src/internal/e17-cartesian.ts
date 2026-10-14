// The cartesian engine behind <ui-bar-chart>, <ui-line-chart>, <ui-area-chart> and
// <ui-combo-chart>: columns, lines and areas on one plot, any number of value axes, stacking,
// a crosshair, drag-to-zoom and an overview brush. The four elements are presets of it, the way
// the React kit's `BarChart`, `LineChart`, `AreaChart` and `ComboChart` are presets of
// `CartesianChart`.
import {
  formatNumber,
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import type { Curve } from "@jcsoftdev/ui-core/chart/path";
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
  type BarKit,
  BRUSH_GAP,
  BRUSH_HEIGHT,
  type CartesianLayout,
  type ChartAnnotation,
  computeLayout,
  type LineKit,
  type MarkKind,
  type ResolvedSeries,
  type SeriesGeometry,
  type ValueAxisOptions,
  type XValue,
} from "./e17-layout.js";
import type { TimeKit } from "./e17-time.js";
import { cssColor, maxOf, minOf, numberAttr } from "./e17-util.js";
import type { IndexRange, Zoom } from "./e17-zoom.js";

export type { AxisSpec, ChartAnnotation, MarkKind, ValueAxisOptions, XValue };

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

const DEFAULT_MAX_POINTS = 2000;
/** Above this many categories the marks are virtual (named on demand, no element each). */
const VIRTUAL_MARKS = 150;
const EASE = "cubic-bezier(.22,1,.36,1)";

const KINDS: ReadonlySet<string> = new Set<MarkKind>(["line", "area", "column"]);
const warned = new Set<string>();
const warnOnce = (message: string) => {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

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

  /** Column geometry and drawing; the bar and combo entries supply them, the others never load them. */
  protected readonly barKit: BarKit | undefined = undefined;
  /** Line and area geometry, drawing and downsampling; the line, area and combo entries supply it. */
  protected readonly lineKit: LineKit | undefined = undefined;
  protected paintBars(_plot: SVGGElement, _layout: CartesianLayout): SVGElement[] {
    return [];
  }

  #categories: readonly XValue[] = [];
  #series: readonly CartesianSeries[] = [];
  #annotations: readonly ChartAnnotation[] = [];
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
  #root: SVGSVGElement | undefined;
  #signal: AbortSignal | undefined;
  #zoom: Zoom | undefined;
  #zoomLoad = false;
  #claim = false;
  #pendingZoom = false;
  #time: TimeKit | undefined;
  #timeLoad = false;
  #notes: typeof import("./e17-annotations.js") | undefined;
  #notesLoad = false;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#paintCross(info?.index ?? null);
    });
    this.addEventListener(CHART_EVENT.data, (event) => {
      // A loading or empty screen replaced the drawing's children: put the overlays back.
      if ((event as CustomEvent).detail) this.#zoom?.restore();
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
  /** Reference lines, ranges, points and text (the React `annotations`). */
  get annotations(): readonly ChartAnnotation[] {
    return this.#annotations;
  }
  set annotations(value: readonly ChartAnnotation[]) {
    this.#annotations = value ?? [];
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
    this.#zoom?.destroy();
    this.#zoom = undefined;
    this.#zoomLoad = false;
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (name === "brush") this.#ensureZoom();
  }

  protected override isEmpty(): boolean {
    return (
      this.#categories.length === 0 ||
      this.#series.every((item) => (item.ranges ?? item.data ?? []).every((value) => value == null))
    );
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    this.#root = root;
    this.#signal = signal;
    // A drag that drew a window is the chart's gesture: claim it so no selection follows. This
    // stays here (not in the lazy zoom code) so it always runs before the base's own listeners.
    const claim = (event: Event) => {
      if (!this.#claim) return;
      this.#claim = false;
      event.preventDefault();
    };
    root.addEventListener("pointerup", claim, { signal });
    root.addEventListener("pointercancel", claim, { signal });
    this.#ensureZoom();
  }

  /** Loads the zoom code the first time `brush` is on, then draws the strip. */
  #ensureZoom(): void {
    const root = this.#root;
    const signal = this.#signal;
    if (!this.hasAttribute("brush") || this.#zoom || this.#zoomLoad || !root || !signal) return;
    this.#zoomLoad = true;
    import("./e17-zoom.js").then(({ createZoom }) => {
      this.#zoomLoad = false;
      if (signal.aborted || this.#zoom) return;
      this.#zoom = createZoom(
        {
          drawing: this.drawing,
          layout: () => this.#layout,
          source: (index) => this.#source(index),
          setRange: (range, live) => this.#setRange(range, live),
          flush: () => this.#flushZoom(),
          redraw: () => this.requestDraw("transient"),
          adopt: (sheet) => adoptStyles(rootOf(this), sheet),
          claim: () => {
            this.#claim = true;
          },
          fullSeries: (context) => this.#resolve(context).filter((item) => !this.isHidden(item.id)),
        },
        root,
        signal,
        () => this.hasAttribute("brush"),
      );
      this.requestDraw("size");
    });
  }

  /** Dates need the calendar helpers; they load once, then the chart draws again. */
  #ensureTime(): void {
    if (this.#time || this.#timeLoad) return;
    this.#timeLoad = true;
    import("./e17-time.js").then(({ timeKit }) => {
      this.#time = timeKit;
      this.requestDraw();
    });
  }

  #ensureNotes(): void {
    if (this.#notes || this.#notesLoad) return;
    this.#notesLoad = true;
    import("./e17-annotations.js").then((module) => {
      this.#notes = module;
      this.requestDraw();
    });
  }

  /** Index in the full `categories` of mark `index` of the zoomed, sampled window. */
  #source(index: number): number {
    return this.#windowStart + (this.#origin ? (this.#origin[index] as number) : index);
  }

  /** `live`: part of a drag, so `zoom` is announced once by `#flushZoom` when it ends. */
  #setRange(next: IndexRange | null, live = false): void {
    const total = this.#categories.length;
    const range = next && next[0] <= 0 && next[1] >= total - 1 ? null : next;
    if (range?.[0] === this.#range?.[0] && range?.[1] === this.#range?.[1]) return;
    this.#range = range;
    if (live) this.#pendingZoom = true;
    else {
      this.#pendingZoom = false;
      emit(this, "zoom", range);
    }
    this.requestDraw();
  }

  #flushZoom(): void {
    if (!this.#pendingZoom) return;
    this.#pendingZoom = false;
    emit(this, "zoom", this.#range);
  }

  #copy(): CartesianLabels {
    return { ...DEFAULT_COPY, ...this.copy };
  }

  #xLabel(context: DrawContext): (value: XValue) => string {
    if (this.xFormat) return this.xFormat;
    const options = { locale: context.locale, timeZone: context.timeZone };
    const time = this.#time;
    return (value) =>
      value instanceof Date
        ? time
          ? `${time.dayOfMonth(value, options)} ${time.shortMonth(value, options)}`
          : value.toISOString().slice(0, 10)
        : typeof value === "number"
          ? formatNumber(value, { locale: context.locale })
          : value;
  }

  #resolve(context: DrawContext): ResolvedSeries[] {
    const categories = this.#categories;
    const distributed = this.hasAttribute("distributed");
    return this.#series.map((item, index) => {
      let kind = this.kind ?? item.type ?? "line";
      if (!KINDS.has(kind)) {
        const fallback: MarkKind = this.barKit ? "column" : "line";
        warnOnce(
          `ui-chart: series "${item.id}" has unknown type "${String(kind)}"; use line, area or column. It is drawn as a ${fallback}.`,
        );
        kind = fallback;
      }
      const ranges = item.ranges;
      const data = ranges ? ranges.map((range) => (range ? range[1] : null)) : (item.data ?? []);
      const colors =
        item.colors?.map(cssColor) ??
        (distributed
          ? categories.map((_, position) => context.color(position + index))
          : undefined);
      return {
        id: item.id,
        name: item.name,
        kind,
        axis: item.axis ?? "left",
        color: context.color(index, cssColor(item.color)),
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
    const notes = this.#annotations;
    if (notes.length) this.#ensureNotes();
    const markers = this.hasAttribute("markers");
    const gradient = this.getAttribute("gradient") !== "off";
    const showGrid = this.getAttribute("grid") !== "off";
    const rotation = numberAttr(this.getAttribute("category-label-rotation"), 0);
    const every = numberAttr(this.getAttribute("category-tick-every"), 0) || undefined;
    const xLabel = this.#xLabel(context);
    const custom = this.xFormat != null;
    const first = categories[0];
    if (first instanceof Date || categories[total - 1] instanceof Date) this.#ensureTime();
    const calendar = this.#time;
    const titleOf = (value: XValue) =>
      value instanceof Date && !custom && calendar
        ? calendar.formatDate(value, { locale: context.locale, timeZone: context.timeZone })
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
      maxPoints === null ||
      horizontal ||
      !this.lineKit ||
      resolved.some((item) => item.kind === "column")
        ? null
        : this.lineKit.sample(
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
      barRadius: numberAttr(this.getAttribute("bar-radius"), 6),
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
      bars: this.barKit,
      lines: this.lineKit,
      time: this.#time,
      annotations: notes,
      locale: context.locale,
      timeZone: context.timeZone,
      reserveBottom: brushOn ? BRUSH_HEIGHT + BRUSH_GAP : 0,
    });
    this.#layout = layout;
    const { margin, innerWidth, innerHeight } = layout;
    const marksOf =
      this.#notes && notes.length ? this.#notes.annotationGeometry(layout, shown, notes) : [];
    const noteLayer = (kind: "under" | "over") =>
      marksOf.length
        ? (this.#notes?.drawAnnotations(marksOf, innerWidth, innerHeight, kind) ?? null)
        : null;

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

    if (showGrid)
      plot.append(
        gridLines(
          layout.valueTicks,
          horizontal ? "vertical" : "horizontal",
          horizontal ? innerHeight : innerWidth,
        ),
      );

    const under = noteLayer("under");
    if (under) plot.append(under);

    // Crosshair parts: the band sits under the marks, the line and the dots over them.
    const bandSize = layout.mode === "band" ? layout.step : 0;
    const crossOn = this.getAttribute("crosshair") !== "off";
    const band = svg("rect", { "data-e17": "band", rx: 8, display: "none", "aria-hidden": "true" });
    if (crossOn && bandSize > 0) plot.append(band);

    const dense = count <= Math.max(2, innerWidth / 9);
    const paintLines = (kind: "line" | "area") =>
      this.lineKit?.paint(plot, defs, layout, {
        kind,
        clipId,
        markers: markers && dense,
        stacked,
        gradient,
      });
    paintLines("area");

    const bars = this.paintBars(plot, layout);
    paintLines("line");

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

    const over = noteLayer("over");
    if (over) plot.append(over);

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

    const drag = this.#zoom?.selection();
    if (drag)
      plot.append(
        svg("rect", {
          "data-e17": "selection",
          x: drag.from,
          y: 0,
          width: drag.to - drag.from,
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
    this.#zoom?.sync(
      brushOn
        ? {
            context,
            layout,
            total,
            range,
            categories,
            titleOf,
            start,
            end,
            labels: copy,
          }
        : null,
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
              x: margin.left + (ends.length ? maxOf(ends.map((p) => p.x)) : innerWidth / 2),
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
                  Math.max(ends.length ? minOf(ends.map((p) => p.y)) : innerHeight / 2, 28),
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
}
