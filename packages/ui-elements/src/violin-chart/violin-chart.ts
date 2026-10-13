import {
  type BoxStats,
  boxStats,
  categoryLayout,
  type DensityPoint,
  type DistributionAxisOptions,
  densityAt,
  gaussianKde,
  groupSeed,
  type JitteredValue,
  jitterValues,
  silvermanBandwidth,
  toXY,
  violinPath,
} from "@jcsoftdev/ui-core/chart/distribution";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import {
  boxGlyph,
  boxTooltipRows,
  boxValueText,
  type ColoredSeries,
  categoryAxes,
  colorSeries,
  type DistributionSeries,
  extentOf,
  groupName,
  observationDots,
  type PointColoring,
  type StatLabels,
  seriesFormat,
  statLabelsOf,
  statsSnapshot,
} from "../internal/e18-dist.js";
import {
  AutoHeight,
  adoptPlot,
  EASE,
  flag,
  hitRect,
  jsonAttr,
  valueFormatOf,
} from "../internal/e18-plot.js";
import css from "./violin-chart.css.js";

export type { DistributionSeries } from "../internal/e18-dist.js";

export type ViolinInner = "box" | "quartiles" | "none";

interface Prepared {
  categories: readonly string[];
  series: readonly DistributionSeries[];
  /** `[series][category]`: statistics and density, or null without data. */
  cells: ReadonlyArray<ReadonlyArray<{ stats: BoxStats; density: DensityPoint[] } | null>>;
}

interface Item {
  key: string;
  category: number;
  series: ColoredSeries;
  stats: BoxStats;
  density: DensityPoint[];
  center: number;
  halfWidth: number;
  side: "both" | "start" | "end";
}

const num = (host: Element, name: string): number | undefined => {
  const raw = host.getAttribute(name);
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/**
 * `<ui-violin-chart>`: a Gaussian kernel density mirrored around each category axis, with an
 * optional inner box or quartile lines. Two series can share one split violin per category. Hover,
 * arrow keys (every arrow walks the violins in reading order) and a tap show the statistics of the
 * violin: maximum, Q3, median, Q1, minimum, mean, count and outliers. The legend
 * (`<ui-chart-legend>`) toggles the series.
 *
 * Attributes (React props in brackets): `categories` and `series` (JSON, or the properties),
 * `orientation` (`vertical`, `horizontal`), `inner` (`box`, `quartiles`, `none`), `split` (only
 * effective with exactly two visible series), `bandwidth` (data units; Silverman's rule per violin
 * by default), `scale` (`width`, `area`), `show-points` (`showPoints`), `jitter` (0-1, default
 * 0.8), `point-color` (`pointColor`: `series`, `value`), `seed` (default 11), `grid="off"`, plus the
 * chart attributes (`label` is the React `title`, `description`, `height` (default 340),
 * `aspect-ratio`, `loading`, `locale`, `value-format`, `currency` ...).
 *
 * Properties: `categories: string[]`, `series: DistributionSeries[]` (`id`, `name`, `data[i]` =
 * samples of `categories[i]`, `color`, `format`), `valueAxis` (`min`, `max`, `tickCount`, `format`,
 * `title`) and `statLabels` (the words of the tooltip and the data table, English by default).
 *
 * Events: the chart events of the base (`chart-hover`, `chart-select`, `chart-series` ...).
 */
export class UiViolinChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "categories",
    "series",
    "orientation",
    "inner",
    "split",
    "bandwidth",
    "scale",
    "show-points",
    "jitter",
    "point-color",
    "seed",
    "grid",
  ];
  #categories: readonly string[] | undefined;
  #series: readonly DistributionSeries[] | undefined;
  #axis: DistributionAxisOptions | undefined;
  #stat: Partial<StatLabels> | undefined;
  #prepared: Prepared | null = null;
  readonly #height = new AutoHeight(this);

  get categories(): readonly string[] {
    return this.#categories ?? jsonAttr<string[]>(this, "categories") ?? [];
  }
  set categories(value: readonly string[]) {
    this.#categories = value;
    this.#prepared = null;
    this.requestDraw();
  }
  get series(): readonly DistributionSeries[] {
    return this.#series ?? jsonAttr<DistributionSeries[]>(this, "series") ?? [];
  }
  set series(value: readonly DistributionSeries[]) {
    this.#series = value;
    this.#prepared = null;
    this.requestDraw();
  }
  get valueAxis(): DistributionAxisOptions | undefined {
    return this.#axis;
  }
  set valueAxis(value: DistributionAxisOptions | undefined) {
    this.#axis = value;
    this.requestDraw();
  }
  get statLabels(): Partial<StatLabels> | undefined {
    return this.#stat;
  }
  set statLabels(value: Partial<StatLabels> | undefined) {
    this.#stat = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "violin-chart";
    this.#height.apply(340);
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "categories" || name === "series" || name === "bandwidth") this.#prepared = null;
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return !this.#prepare().cells.some((row) => row.some(Boolean));
  }

  /** Statistics and 72-point density of every series and category; cached until the data changes. */
  #prepare(): Prepared {
    if (this.#prepared) return this.#prepared;
    const bandwidth = num(this, "bandwidth");
    const categories = this.categories;
    const series = this.series;
    const cells = series.map((item) =>
      categories.map((_, index) => {
        const values = item.data[index] ?? [];
        const stats = boxStats(values);
        if (!stats) return null;
        const h = bandwidth ?? silvermanBandwidth(values);
        return { stats, density: gaussianKde(values, { bandwidth: h, points: 72 }) };
      }),
    );
    this.#prepared = { categories, series, cells };
    return this.#prepared;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, animate } = ctx;
    const { categories, series, cells } = this.#prepare();
    const labels = statLabelsOf(this);
    const all = colorSeries(ctx, series);
    const visible = all.filter((item) => !this.isHidden(item.id));
    const horizontal = this.getAttribute("orientation") === "horizontal";
    const inner = (this.getAttribute("inner") ?? "box") as ViolinInner;
    const split = flag(this, "split") && visible.length === 2;
    const scaleMode = this.getAttribute("scale") === "area" ? "area" : "width";
    const showPoints = flag(this, "show-points");
    const share = Math.min(1, Math.max(0, num(this, "jitter") ?? 0.8));
    const coloring: PointColoring =
      this.getAttribute("point-color") === "value" ? "value" : "series";
    const seed = num(this, "seed") ?? 11;
    const axis = this.#axis;

    const cell = (item: ColoredSeries, category: number) => cells[item.index]?.[category] ?? null;
    let globalMax = 0;
    const extent = extentOf(
      (function* () {
        for (const item of visible)
          for (const entry of cells[item.index] ?? []) {
            if (!entry) continue;
            for (const point of entry.density)
              if (point.density > globalMax) globalMax = point.density;
            yield [entry.stats.min, entry.stats.max] as [number, number];
          }
      })(),
    );
    const layout = categoryLayout({
      width,
      height,
      orientation: horizontal ? "horizontal" : "vertical",
      categories,
      seriesCount: split ? 1 : visible.length,
      extent,
      valueFormat: valueFormatOf(this),
      axis,
      padding: 0.18,
      locale,
      currency: this.getAttribute("currency") || undefined,
    });
    const { margin, valueScale, innerWidth, innerHeight } = layout;
    const map = valueScale.map;

    const items: Item[] = [];
    categories.forEach((_, category) => {
      visible.forEach((item, slotIndex) => {
        const entry = cell(item, category);
        if (!entry) return;
        const slot = layout.slot(category, split ? 0 : slotIndex);
        items.push({
          key: `${item.id}-${category}`,
          category,
          series: item,
          stats: entry.stats,
          density: entry.density,
          center: slot.center,
          halfWidth: Math.min(slot.size / 2, 80) * 0.96,
          side: split ? (slotIndex === 0 ? "start" : "end") : "both",
        });
      });
    });

    const maxFor = (item: Item) => {
      if (scaleMode === "area") return globalMax;
      let top = 1e-12;
      for (const point of item.density) if (point.density > top) top = point.density;
      return top;
    };
    const nameOf = (item: Item) =>
      groupName(categories[item.category] as string, item.series, visible.length);

    const plot = svg("g", { transform: `translate(${margin.left},${margin.top})` });
    root.append(plot);
    plot.append(categoryAxes(layout, { title: axis?.title, grid: flag(this, "grid", true) }));

    const quartileLine = (item: Item, value: number, kind: "median" | "quartile") => {
      const reach = (densityAt(item.density, value) / maxFor(item)) * item.halfWidth;
      const sign = item.side === "start" ? -1 : 1;
      const from = item.side === "both" ? item.center - reach : item.center;
      const to = item.side === "both" ? item.center + reach : item.center + sign * reach;
      const [x1, y1] = toXY(horizontal, map(value), from).split(",");
      const [x2, y2] = toXY(horizontal, map(value), to).split(",");
      return svg("line", {
        x1,
        y1,
        x2,
        y2,
        "stroke-width": kind === "median" ? 2 : 1.25,
        "stroke-dasharray": kind === "median" ? undefined : "3 3",
        style: `stroke:${kind === "median" ? "var(--ink)" : "var(--ink-2)"}`,
      });
    };

    const marks: ChartMark[] = items.map((item, index) => {
      const { stats, density, center, halfWidth, side, series: owner } = item;
      const group = svg("g", { "data-row": "", "data-series": owner.id });
      plot.append(group);
      const start = side === "end" ? center : center - halfWidth;
      const span = side === "both" ? halfWidth * 2 : halfWidth;
      const band = horizontal
        ? { x: 0, y: start, width: innerWidth, height: span }
        : { x: start, y: 0, width: span, height: innerHeight };
      group.append(
        svg("rect", { ...band, rx: 8, "data-band": "", style: "fill:var(--chart-grid)" }),
      );

      const shape = svg("g", {
        style: "transform-box:fill-box;transform-origin:center",
      });
      shape.append(
        svg("path", {
          "data-violin": "",
          d: violinPath({
            density,
            map,
            center,
            halfWidth,
            maxDensity: maxFor(item),
            horizontal,
            side,
            domain: valueScale.domain,
          }),
          "stroke-width": 1.25,
          "fill-opacity": 0.28,
          "stroke-linejoin": "round",
          style: `fill:${owner.color};stroke:${owner.color}`,
        }),
      );
      const quartiles = inner === "quartiles" || (inner === "box" && side !== "both");
      if (quartiles)
        shape.append(
          quartileLine(item, stats.q1, "quartile"),
          quartileLine(item, stats.median, "median"),
          quartileLine(item, stats.q3, "quartile"),
        );
      else if (inner === "box")
        shape.append(
          boxGlyph({
            stats,
            map,
            center,
            size: Math.max(4, Math.min(10, halfWidth * 0.18)),
            horizontal,
            color: owner.color,
            variant: "inner",
            showMean: false,
            showOutliers: false,
          }),
        );
      group.append(shape);
      if (animate)
        shape.animate(
          [
            { opacity: 0, transform: horizontal ? "scaleY(0)" : "scaleX(0)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 620, delay: index * 50, easing: EASE, fill: "backwards" },
        );

      if (showPoints) {
        const top = maxFor(item);
        const sign = side === "start" ? -1 : 1;
        const placed: JitteredValue[] = jitterValues(
          owner.source.data[item.category] ?? [],
          groupSeed(seed, item.category, owner.index),
          (value) => (densityAt(density, value) / top) * halfWidth * share,
        );
        group.append(
          observationDots({
            points:
              side === "both"
                ? placed
                : placed.map((point) => ({ ...point, offset: sign * Math.abs(point.offset) })),
            map,
            center,
            horizontal,
            color: owner.color,
            coloring,
            range: [stats.min, stats.max],
          }),
        );
      }

      const el = hitRect(band.x, band.y, band.width, band.height);
      group.append(el);
      return {
        el,
        label: boxValueText(nameOf(item), stats, labels, seriesFormat(this, ctx, owner)),
      };
    });

    const title = this.getAttribute("label") ?? "Violin chart";
    return {
      summary: `${items.length} ${items.length === 1 ? "violin" : "violins"} in ${categories.length} ${categories.length === 1 ? "category" : "categories"}`,
      marks,
      maxHoverRows: 8,
      hit: (x, y) => {
        const cross = horizontal ? y - margin.top : x - margin.left;
        let best = -1;
        let distance = Number.POSITIVE_INFINITY;
        for (const [index, item] of items.entries()) {
          if (item.side === "start" && cross > item.center) continue;
          if (item.side === "end" && cross < item.center) continue;
          const d = Math.abs(item.center - cross);
          if (d <= item.halfWidth + 8 && d < distance) {
            best = index;
            distance = d;
          }
        }
        return best;
      },
      hover: (index) => {
        const item = items[index];
        if (!item) return null;
        const format = seriesFormat(this, ctx, item.series);
        return {
          title: nameOf(item),
          rows: boxTooltipRows(item.stats, labels, format, item.series.color),
          x: margin.left + (horizontal ? map(item.stats.q3) : item.center + item.halfWidth / 2),
          y: margin.top + (horizontal ? item.center : map(item.stats.median)),
        };
      },
      snapshot: () =>
        statsSnapshot(
          title,
          all.flatMap((item) =>
            categories.map((category, index) => ({
              name: series.length > 1 ? `${category} · ${item.name}` : category,
              stats: cell(item, index)?.stats ?? null,
              format: seriesFormat(this, ctx, item),
            })),
          ),
          labels,
          all,
        ),
    };
  }
}

/** Registers `<ui-violin-chart>` (or `<prefix>-violin-chart`) and returns the tag. */
export function defineViolinChart(options?: DefineOptions): string {
  return defineElement("violin-chart", UiViolinChart, options);
}
