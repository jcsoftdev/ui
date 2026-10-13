import {
  type BoxStats,
  boxStats,
  categoryLayout,
  type DistributionAxisOptions,
  groupSeed,
  type JitteredValue,
  jitterValues,
} from "@jcsoftdev/ui-core/chart/distribution";
import type { ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import { type DefineOptions, defineElement } from "../internal/base.js";
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
import { adoptPlot, flag, hitRect, jsonAttr, valueFormatOf } from "../internal/e18-plot.js";

interface BoxItem {
  category: number;
  series: ColoredSeries;
  stats: BoxStats;
  center: number;
  size: number;
  format: ValueFormatter;
  dots: JitteredValue[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * `<ui-box-plot>`: box-and-whisker plot with the median, quartiles, Tukey whiskers, outliers and
 * the mean for every category, optionally grouped side by side by series. Hover, arrow keys and a
 * tap show the five-number summary, the mean, `n` and the outliers; `<ui-chart-legend>` toggles
 * the series (a legend is worth adding with more than one).
 *
 * Attributes (React props in brackets): `orientation` (`vertical`, `horizontal`), `whisker` (Tukey
 * `k`, default 1.5; `infinity` stretches to min and max), `show-mean="off"` (`showMean`),
 * `show-outliers="off"` (`showOutliers`), `show-points` (`showPoints`), `jitter` (0 to 1, default
 * 0.7), `point-color` (`series`, `value`; `pointColor`), `seed` (default 11), `grid="off"`,
 * `categories` and `series` (JSON), plus the chart attributes (`label` is the React `title`,
 * `description`, `height`, `aspect-ratio`, `loading`, `locale`, `value-format`, `currency`,
 * `animate`, `table` ...). Properties: `categories` (one name per box), `series` (`id`, `name`,
 * `data[i]` = samples of `categories[i]`, `color`, `format`), `valueAxis` (`min`, `max`,
 * `tickCount`, `format`, `title`) and `statLabels` (names of the statistics; React `labels`).
 * Events: the chart events (`chart-hover`, `chart-select`, ...).
 */
export class UiBoxPlot extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "categories",
    "series",
    "orientation",
    "whisker",
    "show-mean",
    "show-outliers",
    "show-points",
    "jitter",
    "point-color",
    "seed",
    "grid",
  ];
  #categories: readonly string[] | undefined;
  #series: readonly DistributionSeries[] | undefined;
  #axis: DistributionAxisOptions | undefined;
  #labels: Partial<StatLabels> | undefined;

  get categories(): readonly string[] {
    return this.#categories ?? jsonAttr<string[]>(this, "categories") ?? [];
  }
  set categories(value: readonly string[]) {
    this.#categories = value;
    this.requestDraw();
  }
  get series(): readonly DistributionSeries[] {
    return this.#series ?? jsonAttr<DistributionSeries[]>(this, "series") ?? [];
  }
  set series(value: readonly DistributionSeries[]) {
    this.#series = value;
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
    return this.#labels;
  }
  set statLabels(value: Partial<StatLabels> | undefined) {
    this.#labels = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    super.connectedCallback();
  }

  /** Tukey fence multiplier; the attribute `infinity` stretches the whiskers to min and max. */
  get #whisker(): number {
    const raw = this.getAttribute("whisker");
    if (raw == null || raw === "") return 1.5;
    if (raw.toLowerCase() === "infinity") return Number.POSITIVE_INFINITY;
    const value = Number(raw);
    return Number.isNaN(value) ? 1.5 : value;
  }

  protected override isEmpty(): boolean {
    const count = this.categories.length;
    for (const item of this.series)
      for (let i = 0; i < count; i++)
        for (const value of item.data[i] ?? [])
          if (value != null && Number.isFinite(value)) return false;
    return true;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, animate } = ctx;
    const categories = this.categories;
    const all = colorSeries(ctx, this.series);
    const visible = all.filter((item) => !this.isHidden(item.id));
    const whisker = this.#whisker;
    const horizontal = this.getAttribute("orientation") === "horizontal";
    const showMean = flag(this, "show-mean", true);
    const showOutliers = flag(this, "show-outliers", true);
    const showPoints = flag(this, "show-points");
    const jitter = Number(this.getAttribute("jitter") ?? 0.7);
    const coloring: PointColoring =
      this.getAttribute("point-color") === "value" ? "value" : "series";
    const seed = Number(this.getAttribute("seed") ?? 11) || 0;
    const grid = flag(this, "grid", true);
    const axis = this.#axis;
    const labels = statLabelsOf(this);

    const stats = all.map((item) =>
      categories.map((_, index) => boxStats(item.source.data[index] ?? [], whisker)),
    );

    const extent = extentOf(
      visible.flatMap((item) =>
        (stats[item.index] ?? []).flatMap(
          (summary): Array<[number, number]> =>
            summary
              ? [
                  [
                    showOutliers ? summary.min : summary.lowerWhisker,
                    showOutliers ? summary.max : summary.upperWhisker,
                  ],
                ]
              : [],
        ),
      ),
    );
    const layout = categoryLayout({
      width,
      height,
      orientation: horizontal ? "horizontal" : "vertical",
      categories,
      seriesCount: visible.length,
      extent,
      valueFormat: valueFormatOf(this),
      axis,
      locale,
      currency: this.getAttribute("currency") || undefined,
    });
    const { margin, innerWidth, innerHeight, valueScale, band } = layout;
    const map = valueScale.map;

    const items: BoxItem[] = [];
    categories.forEach((_, category) => {
      visible.forEach((item, slotIndex) => {
        const summary = stats[item.index]?.[category];
        if (!summary) return;
        const slot = layout.slot(category, slotIndex);
        const size = Math.min(slot.size * 0.72, 72);
        items.push({
          category,
          series: item,
          stats: summary,
          center: slot.center,
          size,
          format: seriesFormat(this, ctx, item),
          dots: showPoints
            ? jitterValues(
                item.source.data[category] ?? [],
                groupSeed(seed, category, item.index),
                (size / 2) * clamp01(jitter),
              )
            : [],
        });
      });
    });

    const plot = svg("g", { transform: `translate(${margin.left},${margin.top})` });
    root.append(plot);
    plot.append(categoryAxes(layout, { title: axis?.title, grid }));

    const share = band.step / Math.max(1, visible.length);
    const nameOf = (item: BoxItem) =>
      groupName(categories[item.category] as string, item.series, visible.length);

    const marks: ChartMark[] = items.map((item, index) => {
      const group = svg("g", { "data-row": "", "data-series": item.series.id });
      plot.append(group);
      const from = item.center - share / 2;
      const rect = horizontal
        ? { x: 0, y: from, width: innerWidth, height: share }
        : { x: from, y: 0, width: share, height: innerHeight };
      group.append(
        svg("rect", {
          ...rect,
          rx: 8,
          "data-band": "",
          style: "fill:var(--chart-grid);fill-opacity:.6",
        }),
      );
      const enter = svg("g", {
        "data-enter": "",
        style: "transform-box:fill-box;transform-origin:center",
      });
      enter.append(
        boxGlyph({
          stats: item.stats,
          map,
          center: item.center,
          size: item.size,
          horizontal,
          color: item.series.color,
          showMean,
          showOutliers: showOutliers && !showPoints,
        }),
      );
      if (showPoints)
        enter.append(
          observationDots({
            points: item.dots,
            map,
            center: item.center,
            horizontal,
            color: item.series.color,
            coloring,
            range: [item.stats.min, item.stats.max],
          }),
        );
      group.append(enter);
      if (animate)
        enter.animate(
          [
            { opacity: 0, transform: horizontal ? "scaleX(0.4)" : "scaleY(0.4)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 520,
            delay: index * 45,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          },
        );
      const el = hitRect(rect.x, rect.y, rect.width, rect.height);
      group.append(el);
      return { el, label: boxValueText(nameOf(item), item.stats, labels, item.format) };
    });

    const title = this.getAttribute("label") ?? "Box plot";
    const fallbackFormat = ctx.format;
    return {
      summary: `${categories.length} ${categories.length === 1 ? "category" : "categories"}, ${visible.length} ${visible.length === 1 ? "series" : "series"}, ${items.length} boxes`,
      marks,
      maxHoverRows: 8,
      hit: (x, y) => {
        const cross = (horizontal ? y - margin.top : x - margin.left) as number;
        let best = -1;
        let distance = band.step / 2;
        for (let i = 0; i < items.length; i++) {
          const d = Math.abs((items[i] as BoxItem).center - cross);
          if (d <= distance) {
            best = i;
            distance = d;
          }
        }
        return best;
      },
      hover: (index) => {
        const item = items[index];
        if (!item) return null;
        return {
          title: nameOf(item),
          rows: boxTooltipRows(item.stats, labels, item.format, item.series.color, showMean),
          x: margin.left + (horizontal ? map(item.stats.q3) : item.center + item.size / 2),
          y: margin.top + (horizontal ? item.center : map(item.stats.median)),
        };
      },
      snapshot: () =>
        statsSnapshot(
          title,
          all.flatMap((item) =>
            categories.map((category, index) => ({
              name: groupName(category, item, all.length),
              stats: stats[item.index]?.[index] ?? null,
              format: item.source.format ? seriesFormat(this, ctx, item) : fallbackFormat,
            })),
          ),
          labels,
          all.map((item) => ({ id: item.id, name: item.name, color: item.color })),
        ),
    };
  }
}

/** Registers `<ui-box-plot>` (or `<prefix>-box-plot`) and returns the tag. */
export function defineBoxPlot(options?: DefineOptions): string {
  return defineElement("box-plot", UiBoxPlot, options);
}
