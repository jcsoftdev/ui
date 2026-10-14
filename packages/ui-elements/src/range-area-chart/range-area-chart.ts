import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  allDates,
  buildCategoryAxis as buildPointAxis,
  type XValue,
} from "@jcsoftdev/ui-core/chart/category-axis";
import { resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { areaPath, type Curve, linePath, type Point } from "@jcsoftdev/ui-core/chart/path";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  type SnapshotSeries,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { nearestX } from "../internal/chart-hit.js";
import {
  AutoHeight,
  axisBottom,
  axisFormatter,
  axisLeft,
  EASE,
  flag,
  gridLines,
  hitRect,
  jsonAttr,
  resolveBound,
  type ValueAxis,
} from "../internal/e18-plot.js";

export type { XValue };

/** The time-axis stack (calendar ticks, date formatting): fetched only when categories are dates. */
type TimeAxis = typeof import("@jcsoftdev/ui-core/chart/category-axis-time");
let timeAxis: TimeAxis | undefined;
let timeAxisLoad: Promise<TimeAxis> | undefined;
const loadTimeAxis = (): Promise<TimeAxis> =>
  (timeAxisLoad ??= import("@jcsoftdev/ui-core/chart/category-axis-time").then(
    (module) => (timeAxis = module),
  ));

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Dates when EVERY category is an ISO date string (the JSON attribute cannot carry a `Date`). */
function isoDates(values: readonly XValue[]): Date[] | undefined {
  if (!values.length) return undefined;
  const dates: Date[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !ISO_DATE.test(value)) return undefined;
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return undefined;
    dates.push(date);
  }
  return dates;
}

const validDates = (values: readonly XValue[]): boolean =>
  allDates(values) && values.every((value) => !Number.isNaN((value as Date).getTime()));

/** `value` when it is a finite number; anything else leaves a gap. */
const real = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export interface RangeBand {
  id: string;
  name: string;
  /** Lower edge per category; `null` leaves a gap. */
  min: ReadonlyArray<number | null>;
  /** Upper edge per category. */
  max: ReadonlyArray<number | null>;
  /** Optional central line (average or median). */
  mean?: ReadonlyArray<number | null>;
  /** CSS color; defaults to the palette slot of the band. */
  color?: string;
  /** Format of this band's values; defaults to the chart's `value-format`. */
  format?: ValueFormat;
}

/** The value axis options; `zero` forces (or forbids) a zero baseline. */
export interface RangeAxis extends ValueAxis {
  zero?: boolean;
}

const MARGIN = { top: 14, right: 18, bottom: 30 };
const CURVES = new Set<string>(["linear", "smooth", "step", "step-before", "step-after"]);

/**
 * `<ui-range-area-chart>`: a min-max band over time (or categories) with an optional line for the
 * average. Several bands overlay each other; the legend (`<ui-chart-legend>`) toggles them. Hover,
 * a tap or the arrow keys pick a category: a dashed crosshair, the band edges and the mean are
 * marked, and the tooltip lists every visible band as `min - max` with its mean.
 *
 * Attributes (React props in brackets): `curve` (`smooth` default, `linear`, `step`,
 * `step-before`, `step-after`), `show-mean="off"` (`showMean`), `x-scale` (`auto`, `point`, `time`;
 * `xScale`), `grid="off"`, `min-label`, `max-label`, `mean-label` (`minLabel`, `maxLabel`,
 * `meanLabel`), `category-label` (the table header, React `labels.category`), `categories` and
 * `bands` (JSON), plus the chart attributes (`label` is the React `title`, `description`, `height`
 * default 300, `aspect-ratio`, `loading`, `animate`, `locale`, `time-zone`, `value-format`...).
 * Properties: `categories` (strings, numbers or `Date`s; all dates give a real time axis), `bands`
 * ({@link RangeBand}), `xFormat` (tick label of a category), `yAxis` (`min`, `max`, `tickCount`,
 * `format`, `title`, `zero`). Events: the chart events (`chart-hover`, `chart-select`,
 * `chart-series`...).
 */
export class UiRangeAreaChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "categories",
    "bands",
    "curve",
    "show-mean",
    "x-scale",
    "grid",
    "min-label",
    "max-label",
    "mean-label",
    "category-label",
  ];
  #categories: readonly XValue[] | undefined;
  #bands: readonly RangeBand[] | undefined;
  #yAxis: RangeAxis | undefined;
  #xFormat: ((value: XValue) => string) | undefined;
  readonly #height = new AutoHeight(this);
  #paint: ((index: number | null) => void) | undefined;
  #parsed: { raw: string | null; value: readonly XValue[] } | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) =>
      this.#paint?.((event as CustomEvent<HoverInfo | null>).detail?.index ?? null),
    );
  }

  get categories(): readonly XValue[] {
    if (this.#categories) return this.#categories;
    const raw = this.getAttribute("categories");
    if (this.#parsed?.raw !== raw) {
      const list = jsonAttr<XValue[]>(this, "categories");
      const value = Array.isArray(list) ? list : [];
      this.#parsed = { raw, value: isoDates(value) ?? value };
    }
    return (this.#parsed as { value: readonly XValue[] }).value;
  }
  set categories(value: readonly XValue[]) {
    this.#categories = value;
    this.#prime();
    this.requestDraw();
  }
  get bands(): readonly RangeBand[] {
    return this.#bands ?? jsonAttr<RangeBand[]>(this, "bands") ?? [];
  }
  set bands(value: readonly RangeBand[]) {
    this.#bands = value;
    this.requestDraw();
  }
  get yAxis(): RangeAxis | undefined {
    return this.#yAxis;
  }
  set yAxis(value: RangeAxis | undefined) {
    this.#yAxis = value;
    this.requestDraw();
  }
  get xFormat(): ((value: XValue) => string) | undefined {
    return this.#xFormat;
  }
  set xFormat(value: ((value: XValue) => string) | undefined) {
    this.#xFormat = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.#height.apply(300);
    this.#prime();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "categories") this.#prime();
    super.attributeChangedCallback(name);
  }

  /** Starts fetching the time-axis chunk as soon as the categories turn out to be dates. */
  #prime(): void {
    if (timeAxis || !this.isConnected || !this.categories.some((c) => c instanceof Date)) return;
    loadTimeAxis().then(() => this.requestDraw());
  }

  protected override isEmpty(): boolean {
    const { categories, bands } = this;
    for (const band of bands)
      for (let i = 0; i < categories.length; i += 1)
        if (real(band.min?.[i]) != null && real(band.max?.[i]) != null) return false;
    return true;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, timeZone, animate } = ctx;
    const categories = this.categories;
    // Date categories wait for the time-axis chunk: drawing now would flash a point axis.
    if (!timeAxis && categories.some((value) => value instanceof Date)) {
      loadTimeAxis().then(() => this.requestDraw());
      return {};
    }
    const bands = this.bands;
    const visible = bands.filter((band) => !this.isHidden(band.id));
    const curveAttr = this.getAttribute("curve") ?? "smooth";
    const curve: Curve = CURVES.has(curveAttr) ? (curveAttr as Curve) : "smooth";
    const showMean = flag(this, "show-mean", true);
    const minLabel = this.getAttribute("min-label") ?? "Min";
    const maxLabel = this.getAttribute("max-label") ?? "Max";
    const meanLabel = this.getAttribute("mean-label") ?? "Mean";
    const xScale = this.getAttribute("x-scale") ?? "auto";
    const yAxis = this.#yAxis ?? {};
    const dateOptions = { locale, timeZone };
    const currency = this.getAttribute("currency") || undefined;
    const fmt = (band: RangeBand) =>
      band.format ? resolveFormat(band.format, { locale, currency }) : ctx.format;
    const colorOf = (band: RangeBand) => ctx.color(bands.indexOf(band), band.color);
    const labelOf = (value: XValue) =>
      timeAxis && value instanceof Date && !Number.isNaN(value.getTime())
        ? timeAxis.fullCategoryLabel(value, dateOptions)
        : String(value);
    const titleOf = (index: number) => labelOf(categories[index] as XValue);

    // Value scale: the domain follows the visible bands only.
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    let seen = false;
    const include = (value: unknown) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      seen = true;
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    };
    for (const band of visible)
      for (let i = 0; i < categories.length; i += 1) {
        if (real(band.min?.[i]) != null && real(band.max?.[i]) != null) {
          include(band.min[i]);
          include(band.max[i]);
        }
        include(band.mean?.[i]);
      }
    const zero = yAxis.zero ?? (seen && lo <= hi * 0.35);
    const domain: [number, number] = seen
      ? [resolveBound(yAxis.min, zero ? Math.min(0, lo) : lo), resolveBound(yAxis.max, hi)]
      : [0, 1];
    const innerHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom);
    const y = linearScale({
      domain,
      range: [innerHeight, 0],
      tickCount: yAxis.tickCount ?? Math.max(3, Math.round(innerHeight / 56)),
    });
    const tickFormat = axisFormatter(this, yAxis.format);
    const yTicks = y.ticks().map((tick) => ({
      key: tick,
      position: y.map(tick),
      label: tickFormat(tick),
    }));
    let widest = 16;
    for (const tick of yTicks) widest = Math.max(widest, estimateTextWidth(tick.label));
    const left = widest + 18;
    const innerWidth = Math.max(40, width - left - MARGIN.right);
    const axis =
      timeAxis && xScale !== "point" && validDates(categories)
        ? timeAxis.buildCategoryAxis(categories, innerWidth, {
            mode: "time",
            format: this.#xFormat,
            locale,
            timeZone,
          })
        : buildPointAxis(categories, innerWidth, {
            mode: "point",
            format:
              this.#xFormat ??
              ((value) =>
                timeAxis && value instanceof Date && !Number.isNaN(value.getTime())
                  ? timeAxis.defaultCategoryLabel(value, dateOptions)
                  : String(value)),
          });

    // Geometry of every visible band.
    const geometry = visible.map((band) => {
      const top: Array<Point | null> = [];
      const bottom: Point[] = [];
      const mean: Array<Point | null> = [];
      for (let i = 0; i < categories.length; i += 1) {
        const x = axis.positions[i] as number;
        const min = real(band.min?.[i]);
        const max = real(band.max?.[i]);
        if (min == null || max == null) {
          top.push(null);
          bottom.push({ x, y: innerHeight });
        } else {
          top.push({ x, y: y.map(max) });
          bottom.push({ x, y: y.map(min) });
        }
        const m = real(band.mean?.[i]);
        mean.push(m == null ? null : { x, y: y.map(m) });
      }
      return { band, color: colorOf(band), top, bottom, mean: band.mean ? mean : null };
    });

    const plot = svg("g", { transform: `translate(${left},${MARGIN.top})` });
    root.append(plot);
    if (flag(this, "grid", true)) plot.append(gridLines(yTicks, "horizontal", innerWidth));
    plot.append(axisLeft(yTicks, 0, yAxis.title), axisBottom(axis.ticks, innerHeight));

    // The bands, revealed from the left on entry.
    const clipId = uid("range-reveal");
    const reveal = svg("rect", {
      x: -6,
      y: -24,
      width: innerWidth + 12,
      height: innerHeight + 48,
      style: "transform-box:fill-box;transform-origin:left center",
    });
    root.append(svg("defs", {}, svg("clipPath", { id: clipId }, reveal)));
    if (animate)
      reveal.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        duration: 900,
        easing: EASE,
        fill: "backwards",
      });
    const bandLayer = svg("g", { "clip-path": `url(#${clipId})` });
    plot.append(bandLayer);
    for (const item of geometry) {
      const group = svg("g", { "data-series": item.band.id, "aria-hidden": "true" });
      group.append(
        svg("path", {
          d: areaPath(item.top, item.bottom, curve),
          style: `fill:${item.color};fill-opacity:.2`,
        }),
      );
      if (showMean && item.mean)
        group.append(
          svg("path", {
            d: linePath(item.mean, curve),
            fill: "none",
            "stroke-width": 2.25,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            style: `stroke:${item.color}`,
          }),
        );
      bandLayer.append(group);
    }

    // Crosshair of the category in focus, with the edges and the mean of each band. It is drawn
    // from `ctx.hover` and moved in place on `chart-hover`, so hovering never redraws the chart.
    let cross: SVGGElement | undefined;
    const paint = (active: number | null) => {
      cross?.remove();
      cross = undefined;
      if (active == null || active < 0 || active >= categories.length) return;
      const x = axis.positions[active] as number;
      cross = svg("g", { "aria-hidden": "true", "pointer-events": "none" });
      cross.append(
        svg("line", {
          x1: x,
          x2: x,
          y1: 0,
          y2: innerHeight,
          "stroke-dasharray": "3 4",
          style: "stroke:var(--chart-crosshair)",
        }),
      );
      for (const item of geometry) {
        const upper = item.top[active];
        const lower = item.bottom[active];
        if (!upper) continue;
        for (const point of [upper, lower as Point])
          cross.append(
            svg("circle", {
              cx: point.x,
              cy: point.y,
              r: 3.5,
              "stroke-width": 2,
              style: `fill:var(--surface);stroke:${item.color}`,
            }),
          );
        const m = item.mean?.[active];
        if (showMean && m)
          cross.append(
            svg("circle", {
              cx: m.x,
              cy: m.y,
              r: 4.5,
              "stroke-width": 2.5,
              style: `fill:${item.color};stroke:var(--surface)`,
            }),
          );
      }
      // Under the hit columns, over the bands.
      plot.insertBefore(cross, plot.querySelector("[data-hit]"));
    };
    this.#paint = paint;

    // One focus stop and hit column per category.
    const rangeText = (index: number) => {
      const parts = visible.map((band) => {
        const f = fmt(band);
        const min = real(band.min?.[index]);
        const max = real(band.max?.[index]);
        if (min == null || max == null) return `${band.name}: -`;
        const m = real(band.mean?.[index]);
        return `${band.name}: ${minLabel} ${f(min)}, ${maxLabel} ${f(max)}${
          showMean && m != null ? `, ${meanLabel} ${f(m)}` : ""
        }`;
      });
      return `${titleOf(index)}. ${parts.join(". ")}`;
    };
    const marks: ChartMark[] = categories.map((_, i) => {
      const x = axis.positions[i] as number;
      const from = i === 0 ? 0 : ((axis.positions[i - 1] as number) + x) / 2;
      const to =
        i === categories.length - 1 ? innerWidth : (x + (axis.positions[i + 1] as number)) / 2;
      const el = hitRect(from, 0, to - from, innerHeight);
      el.setAttribute("data-hit", "");
      plot.append(el);
      return { el, label: rangeText(i) };
    });

    paint(ctx.hover);

    const points = axis.positions.map((x) => ({ x, y: 0 }));
    return {
      summary: `${categories.length} categories, ${visible.map((band) => band.name).join(", ")}`,
      marks,
      maxHoverRows: bands.length,
      hit: (px, py) => {
        const x = px - left;
        const yy = py - MARGIN.top;
        if (yy < 0 || yy > innerHeight || x < -8 || x > innerWidth + 8) return -1;
        return nearestX(points, x);
      },
      hover: (index) => {
        if (index < 0 || index >= categories.length) return null;
        const rows: TooltipRow[] = [];
        let anchor = innerHeight;
        for (const band of visible) {
          const min = real(band.min?.[index]);
          const max = real(band.max?.[index]);
          if (min == null || max == null) continue;
          const f = fmt(band);
          const m = real(band.mean?.[index]);
          anchor = Math.min(anchor, y.map(max));
          rows.push({
            id: band.id,
            name: band.name,
            value: `${f(min)} – ${f(max)}`,
            color: colorOf(band),
            shape: "square",
            note: showMean && m != null ? `${meanLabel} ${f(m)}` : undefined,
          });
        }
        if (!rows.length) return null;
        return {
          title: titleOf(index),
          rows,
          x: left + (axis.positions[index] as number),
          y: MARGIN.top + anchor,
        };
      },
      snapshot: () => {
        const series: SnapshotSeries[] = [];
        for (const band of bands) {
          const f = fmt(band);
          const column = (suffix: string, label: string, data: typeof band.min | undefined) =>
            series.push({
              id: `${band.id}-${suffix}`,
              name: `${band.name} ${label}`,
              color: colorOf(band),
              shape: "square",
              values: categories.map((_, i) => real(data?.[i])),
              text: categories.map((_, i) => {
                const v = real(data?.[i]);
                return v == null ? "" : f(v);
              }),
            });
          column("min", minLabel, band.min);
          column("max", maxLabel, band.max);
          if (band.mean) column("mean", meanLabel, band.mean);
        }
        return {
          title: this.getAttribute("label") ?? "Range area chart",
          categoryHeader: this.getAttribute("category-label") ?? "Category",
          categories: categories.map(labelOf),
          categoryValues: categories,
          series,
          legend: bands.map((band) => ({
            id: band.id,
            name: band.name,
            color: colorOf(band),
            shape: "square" as const,
          })),
        };
      },
    };
  }
}

/** Registers `<ui-range-area-chart>` (or `<prefix>-range-area-chart`) and returns the tag. */
export function defineRangeAreaChart(options?: DefineOptions): string {
  return defineElement("range-area-chart", UiRangeAreaChart, options);
}
