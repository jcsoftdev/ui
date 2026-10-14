import {
  type ColorRange,
  rangeIndex,
  type ScaleColors,
} from "@jcsoftdev/ui-core/chart/color-scale";
import { createRegionIndex } from "@jcsoftdev/ui-core/geo/match";
import { type DefineOptions, defineElement } from "../internal/base.js";
import type { DrawContext, DrawResult } from "../internal/chart-base.js";
import {
  colorScale,
  directionalNav,
  finiteValues,
  legendFor,
  type RegionDatum,
  type RegionInfo,
} from "../internal/e24-geo.js";
import { GeoMapElement } from "../internal/e24-map.js";

const NO_DATA_FILL = "var(--surface-2)";

interface Model {
  values: Array<number | null>;
  fills: string[];
  names: string[];
  texts: Array<string | null> | undefined;
  finite: number;
  domain: readonly [number, number];
}

/**
 * `<ui-choropleth-map>`: regions colored by value, such as customers by department or sales by
 * country. Color follows the theme and accent tokens: a sequential or diverging gradient (the legend
 * draws it as a gradient bar through the chart's `scale`) or stepped `ranges` (the legend lists them,
 * and toggling one dims those regions to "no data"). Hover, arrow keys (geometric neighbours), Home
 * and End show a region's value; click, Enter or a tap pins it (`chart-select`; a double click or
 * Shift+Enter fires `chart-drill`). Drag pans, the wheel (with Ctrl or Cmd, or always) and pinch zoom,
 * `+`, `-` and `0` zoom and fit, Shift+arrows pan, and the buttons do the same. A drag never selects.
 *
 * ARIA: the drawing is a `group` named by `label`, each region an `img` named "Region: value"; the
 * values are also a screen-reader table (or `ui-chart-data-table`).
 *
 * Attributes: `map` (`world` or `peru`: that topology is fetched on demand; or set the `map`
 * property to your own `GeoMap`), `scale` (`sequential` default, `diverging`), `domain` (`min,max`),
 * `center` (neutral value of a diverging scale), `value-name`, `projection` (`equirectangular`,
 * `mercator`, `equalEarth`, `fitted`), `region-labels` (`none`, `name`, `value`), `zoomable="off"`,
 * `wheel-zoom` (`modifier` default, `always`), `max-zoom`, plus the chart attributes (`label`,
 * `locale`, `value-format`, `currency`, `height`, `aspect-ratio`, `loading`, `empty`, ...).
 * Properties: `data` (`{ id, value }[]`, matched by id or name), `colors` (`{ low, mid, high }`),
 * `ranges`, `map`, `labels`. Events: `chart-ready`, `chart-data`, `chart-hover`, `chart-select`,
 * `chart-drill`, `chart-series`. `chart.regions` lists `{ index, id, name, value }` for the indexes
 * the events carry.
 */
export class UiChoroplethMap extends GeoMapElement {
  static override observedAttributes = [
    ...GeoMapElement.observedAttributes,
    "scale",
    "domain",
    "center",
    "value-name",
    "region-labels",
  ];
  #data: readonly RegionDatum[] = [];
  #colors: ScaleColors | undefined;
  #ranges: readonly ColorRange[] | undefined;
  #domain: readonly [number, number] | undefined;
  #model: Model | undefined;
  #regions: RegionInfo[] = [];

  get data(): readonly RegionDatum[] {
    return this.#data;
  }
  set data(value: readonly RegionDatum[]) {
    this.#data = value ?? [];
    this.requestDraw();
  }
  get colors(): ScaleColors | undefined {
    return this.#colors;
  }
  set colors(value: ScaleColors | undefined) {
    this.#colors = value;
    this.requestDraw();
  }
  get ranges(): readonly ColorRange[] | undefined {
    return this.#ranges;
  }
  set ranges(value: readonly ColorRange[] | undefined) {
    this.#ranges = value;
    this.requestDraw();
  }
  get domain(): readonly [number, number] | undefined {
    if (this.#domain) return this.#domain;
    const [min, max] = (this.getAttribute("domain") ?? "").split(",").map(Number);
    return Number.isFinite(min) && Number.isFinite(max)
      ? [min as number, max as number]
      : undefined;
  }
  set domain(value: readonly [number, number] | undefined) {
    this.#domain = value;
    this.requestDraw();
  }
  /** `{ index, id, name, value }` of every region, in the order of the marks and events. */
  get regions(): readonly RegionInfo[] {
    return this.#regions;
  }

  protected override isEmpty(): boolean {
    return finiteValues(this.data).length === 0;
  }

  protected override draw(ctx: DrawContext): DrawResult | undefined {
    const stage = this.stage(ctx);
    if (!stage) return undefined;
    const labels = this.mapLabels;
    const { features, anchors } = stage.geo;
    const name = this.getAttribute("value-name") || labels.value;
    if (!ctx.transient && (ctx.phase !== "resize" || !this.#model))
      this.#model = this.#build(ctx, features);
    const model = this.#model as Model;
    const noData = labels.noData;
    const text = (index: number) => {
      const value = model.values[index];
      return value == null ? noData : ctx.format(value);
    };
    this.#regions = features.map((feature, index) => ({
      index,
      id: feature.id,
      name: feature.name,
      value: model.values[index] ?? null,
    }));
    const elements = this.paintRegions(stage, model.fills);
    this.paintLabels(stage, model.texts);
    const map = this.loadedMap;
    const options = this.#scaleOptions();
    return {
      label: map?.name,
      summary: `${map?.name ?? ""}: ${features.length} regions, ${model.finite} with data${
        model.finite ? ` (${ctx.format(model.domain[0])} to ${ctx.format(model.domain[1])})` : ""
      }`,
      marks: elements.map((el, index) => ({ el, label: `${model.names[index]}: ${text(index)}` })),
      hit: (_x, _y, target) => this.regionOf(target),
      hover: (index) => {
        const anchor = anchors[index];
        if (!anchor) return null;
        const at = this.anchorOf(stage, anchor[0], anchor[1]);
        return {
          title: model.names[index],
          rows: [
            { id: "value", name, value: text(index), color: model.fills[index] ?? NO_DATA_FILL },
          ],
          x: at.x,
          y: at.y,
          side: "top",
        };
      },
      nav: (index, intent) => directionalNav(anchors, index, intent),
      maxHoverRows: 1,
      snapshot: () => ({
        title: this.getAttribute("label") || map?.name || "",
        categoryHeader: labels.region,
        categories: model.names,
        series: [
          {
            id: "value",
            name,
            color: ctx.color(0),
            values: model.values,
            text: model.values.map((_, index) => text(index)),
          },
        ],
        ...legendFor(options, model.domain, ctx.format, name),
      }),
    };
  }

  #scaleOptions() {
    const scale = this.getAttribute("scale") === "diverging" ? "diverging" : "sequential";
    return {
      scale,
      domain: this.domain,
      center: Number(this.getAttribute("center")) || 0,
      colors: this.#colors,
      ranges: this.#ranges,
    } as const;
  }

  #build(ctx: DrawContext, features: ReadonlyArray<{ id: string; name: string }>): Model {
    const lookup = createRegionIndex(this.#data);
    const scale = colorScale(finiteValues(this.#data), this.#scaleOptions());
    const values = features.map((feature) => {
      const value = lookup(feature)?.value;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    });
    const ranges = this.#ranges;
    const fills = values.map((value) => {
      if (value == null) return NO_DATA_FILL;
      if (ranges?.length && this.isHidden(`range-${rangeIndex(value, ranges)}`))
        return NO_DATA_FILL;
      return scale.color(value)?.color ?? NO_DATA_FILL;
    });
    const mode = this.getAttribute("region-labels");
    const texts =
      mode === "name" || mode === "value"
        ? features.map((feature, index) =>
            mode === "name"
              ? feature.name
              : values[index] == null
                ? null
                : ctx.format(values[index] as number),
          )
        : undefined;
    return {
      values,
      fills,
      names: features.map((feature) => feature.name),
      texts,
      finite: values.filter((value) => value != null).length,
      domain: scale.domain,
    };
  }
}

/** Registers `<ui-choropleth-map>` (or `<prefix>-choropleth-map`) and returns the tag. */
export function defineChoroplethMap(options?: DefineOptions): string {
  return defineElement("choropleth-map", UiChoroplethMap, options);
}
