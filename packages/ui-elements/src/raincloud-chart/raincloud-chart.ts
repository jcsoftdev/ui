import {
  type BoxStats,
  boxStats,
  categoryLayout,
  type DensityPoint,
  type DistributionAxisOptions,
  gaussianKde,
  seededRandom,
  silvermanBandwidth,
  sortedFinite,
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
  categoryAxes,
  type DistributionSeries,
  extentOf,
  groupName,
  type StatLabels,
  seriesFormat,
  statLabelsOf,
  statsSnapshot,
} from "../internal/e18-dist.js";
import { AutoHeight, adoptPlot, EASE, flag, hitRect } from "../internal/e18-plot.js";
import css from "./raincloud-chart.css.js";

interface Prepared {
  stats: BoxStats;
  values: number[];
  density: DensityPoint[];
}

/** Splits a row slot into cloud, box and rain bands. */
function rowBands(top: number, size: number) {
  const baseline = top + size * 0.5;
  const box = Math.max(5, Math.min(12, size * 0.11));
  return {
    baseline,
    cloud: size * 0.48,
    boxCenter: baseline + box / 2 + 3,
    box,
    rainFrom: baseline + box + 8,
    rainTo: top + size - 2,
  };
}

const numberAttr = (host: Element, name: string, fallback: number): number => {
  const raw = host.getAttribute(name);
  const value = raw == null || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

/**
 * `<ui-raincloud-chart>`: a horizontal raincloud plot. Each row shows a half violin "cloud" for the
 * shape of the distribution, a slim box for the summary and the raw observations falling below as
 * "rain", so nothing about the data is hidden. Several series stack inside a row. The rain is drawn
 * with plain SVG circles (built in one fragment) and its jitter is deterministic: the same `seed`
 * always gives the same drops. Hover, the arrow keys and a tap show the five-number summary, the
 * mean, the count and the outliers of one cloud; the legend (`<ui-chart-legend>`) toggles series.
 * The row height grows with the rows unless `height` or `aspect-ratio` is set.
 *
 * Attributes (React props in brackets): `categories` and `series` (JSON), `bandwidth`, `rain="off"`
 * (`rain`), `point-radius` (`pointRadius`, default 2.5), `show-mean="off"` (`showMean`), `seed`
 * (default 7), `grid="off"`, plus the chart attributes (`label` is the React `title`, `description`,
 * `height`, `aspect-ratio`, `loading`, `locale`, `currency`, `value-format`, `animate`...).
 * Properties: `categories: string[]`, `series: DistributionSeries[]`, `valueAxis`
 * (`min`, `max`, `tickCount`, `format`, `title`), `statLabels` (the English statistic names).
 * Events: the chart events (`chart-hover`, `chart-select`, ...).
 */
export class UiRaincloudChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "categories",
    "series",
    "bandwidth",
    "rain",
    "point-radius",
    "show-mean",
    "seed",
    "grid",
  ];
  #categories: readonly string[] | undefined;
  #series: readonly DistributionSeries[] | undefined;
  #axis: DistributionAxisOptions | undefined;
  #labels: Partial<StatLabels> | undefined;
  #json = new Map<string, { raw: string; value: unknown }>();
  #prepared:
    | {
        series: readonly DistributionSeries[];
        categories: readonly string[];
        bandwidth: number | undefined;
        rows: Array<Array<Prepared | null>>;
      }
    | undefined;
  readonly #height = new AutoHeight(this);

  #fromAttr<T>(name: string): T | undefined {
    const raw = this.getAttribute(name);
    if (!raw) return undefined;
    const cached = this.#json.get(name);
    if (cached?.raw === raw) return cached.value as T;
    try {
      const value = JSON.parse(raw) as T;
      this.#json.set(name, { raw, value });
      return value;
    } catch {
      return undefined;
    }
  }

  get categories(): readonly string[] {
    return this.#categories ?? this.#fromAttr<string[]>("categories") ?? [];
  }
  set categories(value: readonly string[]) {
    this.#categories = value;
    this.#fit();
    this.requestDraw();
  }
  get series(): readonly DistributionSeries[] {
    return this.#series ?? this.#fromAttr<DistributionSeries[]>("series") ?? [];
  }
  set series(value: readonly DistributionSeries[]) {
    this.#series = value;
    this.#fit();
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
    adoptStyles(rootOf(this), css);
    this.setAttribute("data-ui", "raincloud-chart");
    this.#fit();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "categories" || name === "series") this.#fit();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return !this.#prepare().rows.some((row) => row.some(Boolean));
  }

  /** The rows size themselves: `max(220, categories * max(1, series) * 92 + 48)`. */
  #fit(): void {
    this.#height.apply(
      Math.max(220, this.categories.length * Math.max(1, this.series.length) * 92 + 48),
    );
  }

  /** Statistics, samples and density of every series x category; cached until the data changes. */
  #prepare() {
    const series = this.series;
    const categories = this.categories;
    const given = this.getAttribute("bandwidth");
    const bandwidth = given == null || given === "" ? undefined : Number(given);
    const cached = this.#prepared;
    if (
      cached &&
      cached.series === series &&
      cached.categories === categories &&
      cached.bandwidth === bandwidth
    )
      return cached;
    const rows = series.map((item) =>
      categories.map((_, index): Prepared | null => {
        const values = sortedFinite(item.data[index] ?? []);
        const stats = boxStats(values);
        if (!stats) return null;
        const h =
          bandwidth != null && Number.isFinite(bandwidth) ? bandwidth : silvermanBandwidth(values);
        return { stats, values, density: gaussianKde(values, { bandwidth: h, points: 72 }) };
      }),
    );
    this.#prepared = { series, categories, bandwidth, rows };
    return this.#prepared;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, animate } = ctx;
    const categories = this.categories;
    const all = this.series.map((item, index) => ({
      source: item,
      id: item.id,
      name: item.name,
      color: ctx.color(index, item.color),
      index,
    }));
    const visible = all.filter((item) => !this.isHidden(item.id));
    const { rows: prepared } = this.#prepare();
    const labels = statLabelsOf(this);
    const rain = flag(this, "rain", true);
    const pointRadius = numberAttr(this, "point-radius", 2.5);
    const showMean = flag(this, "show-mean", true);
    const seed = numberAttr(this, "seed", 7);
    const grid = flag(this, "grid", true);
    const title = this.getAttribute("label") ?? "Raincloud chart";
    const axis = this.#axis;

    const layout = categoryLayout({
      width,
      height,
      orientation: "horizontal",
      categories,
      seriesCount: visible.length,
      extent: extentOf(
        visible.flatMap((item) =>
          (prepared[item.index] ?? []).flatMap(
            (entry): Array<[number, number]> => (entry ? [[entry.stats.min, entry.stats.max]] : []),
          ),
        ),
      ),
      valueFormat: this.valueFormat,
      axis,
      padding: 0.12,
      locale,
      currency: this.getAttribute("currency") || undefined,
    });
    const { margin, valueScale } = layout;
    const map = valueScale.map;

    interface Cloud {
      category: number;
      series: (typeof all)[number];
      entry: Prepared;
      top: number;
      size: number;
      name: string;
      format: ReturnType<typeof seriesFormat>;
    }
    const items: Cloud[] = [];
    categories.forEach((category, c) => {
      visible.forEach((item, slotIndex) => {
        const entry = prepared[item.index]?.[c];
        if (!entry) return;
        const slot = layout.slot(c, slotIndex);
        items.push({
          category: c,
          series: item,
          entry,
          top: slot.center - slot.size / 2,
          size: slot.size,
          name: groupName(category, item, visible.length),
          format: seriesFormat(this, ctx, item),
        });
      });
    });

    const plot = svg("g", { transform: `translate(${margin.left},${margin.top})` });
    root.append(plot);
    plot.append(categoryAxes(layout, { title: axis?.title, grid }));

    const cloudNodes: Element[] = [];
    const rainNodes: Element[] = [];
    const marks: ChartMark[] = items.map((item) => {
      const bands = rowBands(item.top, item.size);
      const { entry } = item;
      const color = item.series.color;
      const group = svg("g", { "data-row": "", "data-series": item.series.id });
      plot.append(group);
      group.append(
        svg("rect", {
          x: 0,
          y: item.top,
          width: layout.innerWidth,
          height: item.size,
          rx: 8,
          "data-band": "",
          style: "fill:var(--chart-grid)",
        }),
      );
      let maxDensity = 1e-12;
      for (const point of entry.density) if (point.density > maxDensity) maxDensity = point.density;
      const cloud = svg("path", {
        "data-cloud": "",
        "aria-hidden": "true",
        d: violinPath({
          density: entry.density,
          map,
          center: bands.baseline,
          halfWidth: bands.cloud,
          maxDensity,
          horizontal: true,
          side: "start",
          domain: valueScale.domain,
        }),
        "stroke-width": 1.25,
        "stroke-linejoin": "round",
        style: `fill:${color};fill-opacity:.26;stroke:${color};transform-box:fill-box;transform-origin:center bottom`,
      });
      group.append(cloud);
      cloudNodes.push(cloud);
      group.append(
        boxGlyph({
          stats: entry.stats,
          map,
          center: bands.boxCenter,
          size: bands.box,
          horizontal: true,
          color,
          showMean,
          showOutliers: false,
        }),
      );
      const spread = Math.max(0, bands.rainTo - bands.rainFrom);
      if (rain && spread > 0) {
        const random = seededRandom(seed + item.category * 977 + item.series.index * 131);
        const drops = document.createDocumentFragment();
        for (const value of entry.values)
          drops.append(
            svg("circle", {
              cx: map(value),
              cy: bands.rainFrom + random() * spread,
              r: pointRadius,
            }),
          );
        const rainGroup = svg("g", {
          "data-rain": "",
          "aria-hidden": "true",
          "pointer-events": "none",
          style: `fill:${color};fill-opacity:.55;transform-box:fill-box;transform-origin:center`,
        });
        rainGroup.append(drops);
        group.append(rainGroup);
        rainNodes.push(rainGroup);
      }
      const el = hitRect(0, item.top, layout.innerWidth, item.size);
      group.append(el);
      return { el, label: boxValueText(item.name, entry.stats, labels, item.format) };
    });

    if (animate) {
      cloudNodes.forEach((node, index) => {
        node.animate(
          [
            { opacity: 0, transform: "scaleY(0)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 620, delay: index * 60, easing: EASE, fill: "backwards" },
        );
      });
      rainNodes.forEach((node, index) => {
        node.animate(
          [
            { opacity: 0, transform: "translateY(-8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 520, delay: 240 + index * 60, easing: EASE, fill: "backwards" },
        );
      });
    }

    return {
      summary: `${items.length} ${items.length === 1 ? "cloud" : "clouds"}: ${categories.join(", ")}`,
      marks,
      maxHoverRows: 8,
      hit: (_x, y) => {
        const py = y - margin.top;
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as Cloud;
          if (py >= item.top && py <= item.top + item.size) return i;
        }
        return -1;
      },
      hover: (index) => {
        const item = items[index];
        if (!item) return null;
        return {
          title: item.name,
          rows: boxTooltipRows(item.entry.stats, labels, item.format, item.series.color, showMean),
          x: margin.left + map(item.entry.stats.q3),
          y: margin.top + rowBands(item.top, item.size).baseline,
        };
      },
      snapshot: () =>
        statsSnapshot(
          title,
          all.flatMap((item) =>
            categories.map((category, c) => ({
              name: all.length > 1 ? `${category} · ${item.name}` : category,
              stats: prepared[item.index]?.[c]?.stats ?? null,
              format: seriesFormat(this, ctx, item),
            })),
          ),
          labels,
          all.map(({ id, name, color }) => ({ id, name, color })),
        ),
    };
  }
}

/** Registers `<ui-raincloud-chart>` (or `<prefix>-raincloud-chart`) and returns the tag. */
export function defineRaincloudChart(options?: DefineOptions): string {
  return defineElement("raincloud-chart", UiRaincloudChart, options);
}
