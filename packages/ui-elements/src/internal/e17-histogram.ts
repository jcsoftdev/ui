// The engine behind <ui-histogram>: automatic or fixed bins shared by every visible series, counts
// or densities, a fitted normal curve and an "explode into dots" view. A port of the React kit's
// `Histogram`, with marks that are the bins.
import {
  formatNumber,
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import { barPath, linePath } from "@jcsoftdev/ui-core/chart/path";
import { adoptStyles, emit, rootOf } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  join,
  svg,
  type TooltipRow,
} from "./chart-base.js";
import { axisBottom, axisLeft, baseline, gridLines } from "./e17-axes.js";
import css from "./e17-chart.css.js";
import {
  type Bin,
  type BinRule,
  binCounts,
  binEdges,
  mean,
  normalPdf,
  sortedFinite,
  standardDeviation,
} from "./e17-stats.js";
import { cssColor, numberAttr, numberList } from "./e17-util.js";
import { type DistributionAxisOptions, xyLayout } from "./e17-xy-layout.js";
import zoomCss from "./e17-zoom.css.js";

export type { Bin, BinRule, DistributionAxisOptions };

export interface HistogramSeries {
  id: string;
  name: string;
  /** Raw observations, e.g. every ticket of the month. */
  values: ReadonlyArray<number | null>;
  color?: string;
}

export interface HistogramLabels {
  range: string;
  frequency: string;
  density: string;
  explode: string;
  bars: string;
}

const DEFAULT_COPY: HistogramLabels = {
  range: "Range",
  frequency: "Frequency",
  density: "Density",
  explode: "Show points",
  bars: "Show bars",
};
const EASE = "cubic-bezier(.34,1.56,.64,1)";

interface Binned {
  id: string;
  name: string;
  color: string;
  bins: Bin[];
  total: number;
  mean: number;
  sd: number;
}

export class UiHistogram extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "bins",
    "bin-width",
    "domain",
    "mode",
    "normal-curve",
    "exploded",
    "explode-toggle",
    "grid",
  ];
  static override retain = true;

  xAxis: DistributionAxisOptions = {};
  yAxis: DistributionAxisOptions = {};
  /** Format of the binned values (x axis, tooltip ranges). */
  binFormat: ValueFormat | undefined;
  copy: Partial<HistogramLabels> = {};

  #series: readonly HistogramSeries[] = [];
  #g: SVGGElement | undefined;
  #band: SVGRectElement | undefined;
  #edges: number[] = [];
  #xOf: ((value: number) => number) | undefined;
  #innerHeight = 0;
  #toggle: HTMLButtonElement | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#paintBand(info ? info.index : null);
    });
    this.addEventListener(CHART_EVENT.data, (event) => {
      if (
        (event as CustomEvent).detail &&
        this.#toggle &&
        !this.#toggle.isConnected &&
        this.hasAttribute("explode-toggle")
      )
        this.drawing.append(this.#toggle);
    });
  }

  get series(): readonly HistogramSeries[] {
    return this.#series;
  }
  set series(value: readonly HistogramSeries[]) {
    this.#series = value;
    this.requestDraw();
  }
  get exploded(): boolean {
    return this.hasAttribute("exploded");
  }
  set exploded(value: boolean) {
    this.toggleAttribute("exploded", value);
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    adoptStyles(rootOf(this), zoomCss);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#toggle?.remove();
  }

  protected override isEmpty(): boolean {
    return !this.#series.some((item) => item.values.some((v) => v != null && Number.isFinite(v)));
  }

  #paintBand(index: number | null): void {
    const band = this.#band;
    const edges = this.#edges;
    const xOf = this.#xOf;
    if (!band || !xOf) return;
    if (index === null || index < 0 || index >= edges.length - 1) {
      band.setAttribute("display", "none");
      return;
    }
    const x0 = xOf(edges[index] as number);
    const x1 = xOf(edges[index + 1] as number);
    band.setAttribute("x", `${x0}`);
    band.setAttribute("width", `${Math.max(1, x1 - x0)}`);
    band.setAttribute("height", `${this.#innerHeight}`);
    band.setAttribute("display", "inline");
  }

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height } = context;
    const copy = { ...DEFAULT_COPY, ...this.copy };
    const currency = this.getAttribute("currency") || undefined;
    const locale = context.locale;
    const fmt = resolveFormat(this.binFormat, { locale, currency });
    const density = this.getAttribute("mode") === "density";
    const normalCurve = this.hasAttribute("normal-curve");
    const exploded = this.exploded;
    const grid = this.getAttribute("grid") !== "off";
    const binsAttr = this.getAttribute("bins");
    const bins: BinRule | number | undefined =
      binsAttr === "auto" || binsAttr === "sturges" || binsAttr === "freedman-diaconis"
        ? binsAttr
        : numberAttr(binsAttr, 0) || undefined;
    const binWidth = numberAttr(this.getAttribute("bin-width"), 0) || undefined;
    const domainPair = numberList(this.getAttribute("domain"), 2);
    const domain = domainPair ? ([domainPair[0], domainPair[1]] as [number, number]) : undefined;

    const all = this.#series.map((source, index) => ({
      source,
      id: source.id,
      color: context.color(index, cssColor(source.color)),
    }));
    const visible = all.filter((item) => !this.isHidden(item.id));
    const pooled: number[] = [];
    const sorted = new Map<string, number[]>();
    for (const item of visible) {
      const values = sortedFinite(item.source.values);
      sorted.set(item.id, values);
      for (const value of values) pooled.push(value);
    }
    const edges = binEdges(pooled, { bins, binWidth, domain });
    this.#edges = edges;
    const binned: Binned[] = visible.map((item) => {
      const values = sorted.get(item.id) as number[];
      const counted = binCounts(values, edges);
      return {
        id: item.id,
        name: item.source.name,
        color: item.color,
        bins: counted,
        total: counted.reduce((sum, bin) => sum + bin.count, 0),
        mean: mean(values),
        sd: standardDeviation(values),
      };
    });
    const binCount = Math.max(0, edges.length - 1);
    const lo = (edges[0] as number) ?? 0;
    const hi = (edges[edges.length - 1] as number) ?? 1;
    const binSize = edges.length > 1 ? (edges[1] as number) - lo : 1;
    const heightOf = (item: Binned, count: number) =>
      density ? count / Math.max(1, item.total) / binSize : count;
    const curveOf = (item: Binned, x: number) => {
      const pdf = normalPdf(x, item.mean, item.sd);
      return density ? pdf : pdf * item.total * binSize;
    };
    let top = 0;
    for (const item of binned) {
      for (const bin of item.bins) top = Math.max(top, heightOf(item, bin.count));
      if (normalCurve && item.sd > 0) top = Math.max(top, curveOf(item, item.mean));
    }
    const yFormat: ValueFormat = density
      ? (value) => formatNumber(value, { maximumFractionDigits: 3, locale })
      : "integer";
    const lanes = Math.max(1, binned.length);
    const layoutFor = (yMax?: number) =>
      xyLayout({
        width,
        height,
        xExtent: [lo, hi],
        yExtent: [0, top || 1],
        xAxis: { ...this.xAxis, min: lo, max: hi },
        yAxis: { ...this.yAxis, min: 0, ...(yMax != null ? { max: yMax } : {}) },
        xText: resolveAxisFormat(this.xAxis.format ?? this.binFormat, { locale, currency }),
        yText: resolveAxisFormat(this.yAxis.format ?? yFormat, { locale, currency }),
        locale,
        timeZone: context.timeZone,
      });
    const laneOf = (scaleX: (value: number) => number) =>
      Math.max(2, (scaleX(lo + binSize) - scaleX(lo) - 2) / lanes);
    let layout = layoutFor();
    if (exploded && binned.length) {
      // A dot is one count tall; when it would be taller than the bin is wide, stretch the axis so it stays round.
      const unit = Math.max(...binned.map((item) => heightOf(item, 1)), Number.MIN_VALUE);
      const lane = laneOf(layout.xScale.map);
      const cell = layout.innerHeight / (layout.yScale.domain[1] / unit);
      if (cell > lane) layout = layoutFor((layout.innerHeight / lane) * unit);
    }
    const { margin, innerWidth, innerHeight, xScale, yScale } = layout;
    this.#xOf = xScale.map;
    this.#innerHeight = innerHeight;
    const base = yScale.map(0);
    const overlap = binned.length > 1;

    this.#g ??= svg("g");
    const g = this.#g;
    g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    if (!g.isConnected) root.append(g);
    g.replaceChildren();
    if (grid) g.append(gridLines(layout.yTicks, "horizontal", innerWidth));
    g.append(
      baseline(0, innerWidth, innerHeight, innerHeight),
      axisLeft(layout.yTicks, 0, this.yAxis.title ?? (density ? copy.density : copy.frequency)),
      axisBottom(layout.xTicks, innerHeight),
    );
    if (this.xAxis.title)
      g.append(
        svg(
          "text",
          {
            x: innerWidth,
            y: innerHeight + 40,
            "text-anchor": "end",
            "data-e17": "title",
            "aria-hidden": "true",
          },
          this.xAxis.title,
        ),
      );
    this.#band = svg("rect", {
      y: 0,
      rx: 6,
      display: "none",
      "aria-hidden": "true",
      "data-e17": "band",
    });
    g.append(this.#band);

    const dotsLayer = svg("g", { "aria-hidden": "true" });
    const barsLayer = svg("g");
    g.append(barsLayer, dotsLayer);
    const lane = laneOf(xScale.map);
    const dotRadius = Math.max(
      1,
      Math.min(lane, ...binned.map((item) => base - yScale.map(heightOf(item, 1)))) / 2 - 0.5,
    );
    const animated = context.animate && binCount <= 400;
    binned.forEach((item, seriesIndex) => {
      const group = svg("g", { "data-series": item.id });
      barsLayer.append(group);
      if (exploded) {
        group.setAttribute("style", "pointer-events:none");
        item.bins.forEach((bin) => {
          const cx = xScale.map(bin.x0) + 1 + seriesIndex * lane + lane / 2;
          for (let k = 0; k < bin.count; k += 1) {
            const dot = svg("circle", {
              cx,
              cy: yScale.map(heightOf(item, k + 0.5)),
              r: dotRadius,
              style: `fill:${item.color};fill-opacity:${overlap ? 0.7 : 0.9};stroke:var(--surface);stroke-width:.75`,
            });
            group.append(dot);
            if (animated && k < 40)
              dot.animate(
                [
                  { opacity: 0, transform: "translateY(-18px) scale(0.2)" },
                  { opacity: 1, transform: "none" },
                ],
                {
                  duration: 420,
                  delay: Math.min(600, k * 12 + seriesIndex * 30),
                  easing: EASE,
                  fill: "backwards",
                },
              );
          }
        });
        return;
      }
      const built = join(
        group,
        item.bins.filter((bin) => bin.count > 0),
        (bin) => `${bin.x0}`,
        () => svg("path"),
        (el, bin) => {
          const x0 = xScale.map(bin.x0);
          const x1 = xScale.map(bin.x1);
          const gap = Math.min(2, (x1 - x0) * 0.12);
          const y = yScale.map(heightOf(item, bin.count));
          const w = Math.max(1, x1 - x0 - gap);
          el.setAttribute(
            "d",
            barPath(x0 + gap / 2, y, w, Math.max(1, base - y), Math.min(4, w / 3), "top"),
          );
          el.setAttribute(
            "style",
            `fill:${item.color};fill-opacity:${overlap ? 0.5 : 0.88};transform-box:fill-box;transform-origin:center bottom`,
          );
        },
      );
      if (animated)
        built.forEach((el, i) => {
          el.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
            duration: 520,
            delay: i * 22,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          });
        });
    });
    if (normalCurve)
      binned.forEach((item) => {
        if (!(item.sd > 0)) return;
        const points = Array.from({ length: 81 }, (_, i) => {
          const x = lo + ((hi - lo) * i) / 80;
          return { x: xScale.map(x), y: yScale.map(curveOf(item, x)) };
        });
        const d = linePath(points, "smooth");
        const curve = svg("g", { "aria-hidden": "true" });
        curve.append(
          svg("path", {
            d,
            fill: "none",
            "stroke-width": 4.5,
            "stroke-linecap": "round",
            style: "stroke:var(--surface)",
          }),
          svg("path", {
            d,
            fill: "none",
            "stroke-width": 2,
            "stroke-linecap": "round",
            "stroke-dasharray": overlap ? undefined : "5 4",
            style: `stroke:${overlap ? item.color : "var(--ink-2)"}`,
          }),
        );
        g.append(curve);
        if (animated)
          curve.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 500,
            delay: 420,
            easing: "ease-out",
            fill: "backwards",
          });
      });

    // The explode toggle: an HTML button under the plot.
    if (this.hasAttribute("explode-toggle")) {
      this.#toggle ??= document.createElement("button");
      const button = this.#toggle;
      button.type = "button";
      button.dataset.e17 = "reset";
      button.setAttribute("aria-pressed", String(exploded));
      button.textContent = exploded ? copy.bars : copy.explode;
      if (!button.dataset.bound) {
        button.dataset.bound = "";
        button.addEventListener("click", () => {
          this.exploded = !this.exploded;
          emit(this, "explode", this.exploded);
        });
      }
      if (!button.isConnected) this.drawing.append(button);
    } else {
      this.#toggle?.remove();
    }
    this.#paintBand(context.hover);

    const rangeText = (bin: Bin) => `${fmt(bin.x0)} – ${fmt(bin.x1)}`;
    const first = binned[0];
    const rowsOf = (index: number): TooltipRow[] =>
      binned.map((item) => {
        const count = item.bins[index]?.count ?? 0;
        return {
          id: item.id,
          name: item.name,
          value: density
            ? formatNumber(heightOf(item, count), { maximumFractionDigits: 4, locale })
            : formatNumber(count, { locale }),
          color: item.color,
          note: item.total ? `(${formatPercent(count / item.total, { locale })})` : undefined,
        };
      });
    return {
      summary: `${binCount} bins from ${fmt(lo)} to ${fmt(hi)}`,
      marks: {
        count: binCount,
        label: (i) =>
          `${copy.range} ${rangeText(first?.bins[i] as Bin)}: ${rowsOf(i)
            .map((row) => `${row.name} ${row.value} ${row.note ?? ""}`.trim())
            .join(", ")}`,
      },
      maxHoverRows: Math.max(1, all.length),
      hit: (x) => {
        const value = xScale.invert(x - margin.left);
        if (value < lo || value > hi) return -1;
        let a = 0;
        let b = binCount - 1;
        while (a < b) {
          const mid = (a + b + 1) >> 1;
          if (value >= (edges[mid] as number)) a = mid;
          else b = mid - 1;
        }
        return binCount ? a : -1;
      },
      hover: (i) => {
        const bin = first?.bins[i];
        if (!bin) return null;
        const tallest = Math.max(...binned.map((item) => heightOf(item, item.bins[i]?.count ?? 0)));
        return {
          title: rangeText(bin),
          rows: rowsOf(i),
          x: margin.left + xScale.map(bin.x1),
          y: margin.top + Math.max(24, yScale.map(tallest)),
        };
      },
      snapshot: () => {
        const bins0 = first?.bins ?? [];
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: copy.range,
          categories: bins0.map(rangeText),
          series: binned.map((item) => ({
            id: item.id,
            name: item.name,
            color: item.color,
            values: item.bins.map((bin) => bin.count),
            text: item.bins.map((bin) => String(bin.count)),
          })),
          legend: all.map((item) => ({
            id: item.id,
            name: item.source.name,
            color: item.color,
            shape: "square" as const,
          })),
        };
      },
    };
  }
}
