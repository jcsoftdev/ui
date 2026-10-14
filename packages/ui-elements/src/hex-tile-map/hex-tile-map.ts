import {
  type ColorRange,
  inkOn,
  rangeIndex,
  type ScaleColors,
} from "@jcsoftdev/ui-core/chart/color-scale";
import {
  type HexTile,
  hexAt,
  hexPoints,
  layoutHexGrid,
  PERU_HEX_TILES,
} from "@jcsoftdev/ui-core/geo/hex";
import { createRegionIndex } from "@jcsoftdev/ui-core/geo/match";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  join,
  svg,
} from "../internal/chart-base.js";
import {
  AutoAspect,
  colorScale,
  DEFAULT_MAP_LABELS,
  directionalNav,
  finiteValues,
  legendFor,
  type MapLabels,
  type RegionDatum,
  type RegionInfo,
} from "../internal/e24-geo.js";
import css from "./hex-tile-map.css.js";

export type { HexTile };

const NO_DATA_FILL = "var(--surface-2)";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Cell {
  tile: HexTile;
  value: number | null;
  color: string;
  ink: string;
}

/**
 * `<ui-hex-tile-map>`: every region is one hexagon of the same size, so small regions (Callao,
 * Tumbes) weigh as much as large ones and nothing hides behind Loreto. Colored by value like
 * `ui-choropleth-map`, with the same legend (a gradient bar from the chart's `scale`, or stepped
 * `ranges`), tooltip, keyboard model and screen-reader table. Hover, arrows (the nearest tile in that
 * direction), Home and End show a tile; click, Enter or a tap pins it (`chart-select`). The default
 * layout is Peru's 25 regions; set `tiles` for any other territory. No map data is loaded.
 *
 * ARIA: the drawing is a `group` named by `label`, each tile an `img` named "Region: value".
 *
 * Attributes: `scale` (`sequential` default, `diverging`), `domain` (`min,max`), `center`,
 * `value-name`, `tile-labels` (`both` default, `code`, `value`, `none`), plus the chart attributes
 * (`label`, `locale`, `value-format`, `currency`, `height`, `aspect-ratio`, `animate="off"`, ...).
 * Properties: `data` (`{ id, value }[]`, matched by tile id or name), `tiles`
 * (`{ id, name, code, row, col }[]`, odd rows shifted half a tile), `colors`, `ranges`, `labels`;
 * `tileInfo(index)` returns `{ index, id, name, value }`. Events: the chart events.
 */
export class UiHexTileMap extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "scale",
    "domain",
    "center",
    "value-name",
    "tile-labels",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels> & Partial<MapLabels>;
  #data: readonly RegionDatum[] = [];
  #tiles: readonly HexTile[] = PERU_HEX_TILES;
  #colors: ScaleColors | undefined;
  #ranges: readonly ColorRange[] | undefined;
  #domain: readonly [number, number] | undefined;
  #cells: Cell[] = [];
  readonly #aspect = new AutoAspect(this);

  get data(): readonly RegionDatum[] {
    return this.#data;
  }
  set data(value: readonly RegionDatum[]) {
    this.#data = value ?? [];
    this.requestDraw();
  }
  get tiles(): readonly HexTile[] {
    return this.#tiles;
  }
  set tiles(value: readonly HexTile[]) {
    this.#tiles = value ?? PERU_HEX_TILES;
    this.#fitAspect();
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
  /** `{ index, id, name, value }` of tile `index`, as the events number them. */
  tileInfo(index: number): RegionInfo | undefined {
    const cell = this.#cells[index];
    return cell && { index, id: cell.tile.id, name: cell.tile.name, value: cell.value };
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "hex-tile-map";
    this.#fitAspect();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    this.#aspect.changed(name);
    super.attributeChangedCallback(name);
  }

  #fitAspect(): void {
    const grid = layoutHexGrid(this.#tiles, 1000, 1000);
    this.#aspect.apply(grid.height > 0 ? grid.width / grid.height : null);
  }

  protected override isEmpty(): boolean {
    return finiteValues(this.#data).length === 0;
  }

  protected override draw(ctx: DrawContext): DrawResult | undefined {
    const labels: MapLabels = { ...DEFAULT_MAP_LABELS, ...this.labels };
    const name = this.getAttribute("value-name") || labels.value;
    const options = {
      scale: this.getAttribute("scale") === "diverging" ? "diverging" : "sequential",
      domain: this.domain,
      center: Number(this.getAttribute("center")) || 0,
      colors: this.#colors,
      ranges: this.#ranges,
    } as const;
    const scale = colorScale(finiteValues(this.#data), options);
    const lookup = createRegionIndex(this.#data);
    const ranges = this.#ranges;
    const cells = this.#tiles.map((tile): Cell => {
      const raw = lookup(tile)?.value;
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      const stop = value == null ? null : scale.color(value);
      const hidden =
        value != null && ranges?.length && this.isHidden(`range-${rangeIndex(value, ranges)}`);
      return {
        tile,
        value,
        color: !stop || hidden ? NO_DATA_FILL : stop.color,
        ink: !stop || hidden ? "var(--ink-2)" : inkOn(stop.strength),
      };
    });
    this.#cells = cells;
    const grid = layoutHexGrid(this.#tiles, ctx.width, ctx.height);
    const gap = Math.max(1.5, grid.size * 0.08);
    const codeSize = clamp(grid.size * 0.46, 8, 13);
    const valueSize = clamp(grid.size * 0.36, 8, 11);
    const mode = this.getAttribute("tile-labels") ?? "both";
    const showCode = mode !== "none" && mode !== "value" && grid.size >= 15;
    const showValue = (mode === "value" || mode === "both") && grid.size >= 24;
    const text = (cell: Cell) => (cell.value == null ? labels.noData : ctx.format(cell.value));

    const elements = join(
      ctx.svg,
      cells,
      (cell) => cell.tile.id,
      () =>
        svg(
          "g",
          { "data-tile": "" },
          svg("polygon", {}),
          svg("text", { "text-anchor": "middle", "aria-hidden": "true" }),
        ),
      (el, cell, index) => {
        const [cx, cy] = grid.centers[index] as [number, number];
        el.dataset.i = `${index}`;
        const polygon = el.firstElementChild as SVGPolygonElement;
        polygon.setAttribute("points", hexPoints(cx, cy, grid.size, gap / 2));
        polygon.style.fill = cell.color;
        const label = el.lastElementChild as SVGTextElement;
        const lines = [
          showCode ? cell.tile.code : null,
          showValue && cell.value != null ? ctx.format(cell.value) : null,
        ].filter((line): line is string => !!line);
        label.style.fill = cell.ink;
        label.replaceChildren(
          ...lines.map((line, i) =>
            svg(
              "tspan",
              {
                x: cx,
                dy: i === 0 ? (lines.length > 1 ? "-0.15em" : "0.35em") : "1.2em",
                "font-size": i === 0 && showCode ? codeSize : valueSize,
              },
              line,
            ),
          ),
        );
      },
    );
    if (ctx.animate)
      elements.forEach((el, index) => {
        el.animate(
          [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: 380,
            delay: index * 14,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          },
        );
      });

    const finite = cells.filter((cell) => cell.value != null).length;
    return {
      summary: `${cells.length} regions, ${finite} with data`,
      marks: elements.map((el, index) => ({
        el,
        label: `${(cells[index] as Cell).tile.name}: ${text(cells[index] as Cell)}`,
      })),
      hit: (x, y) => {
        const exact = hexAt(grid.centers, grid.size, x, y);
        if (exact >= 0) return exact;
        // The corners between the inscribed circles still belong to the nearest tile.
        let best = -1;
        let nearest = grid.size;
        grid.centers.forEach(([cx, cy], index) => {
          const d = Math.hypot(x - cx, y - cy);
          if (d <= nearest) {
            nearest = d;
            best = index;
          }
        });
        return best;
      },
      hover: (index) => {
        const cell = cells[index];
        const center = grid.centers[index];
        if (!cell || !center) return null;
        return {
          title: cell.tile.name,
          rows: [{ id: "value", name, value: text(cell), color: cell.color }],
          x: center[0],
          y: center[1] - grid.size * 0.8,
          side: "top",
        };
      },
      nav: (index, intent) => directionalNav(grid.centers, index, intent),
      maxHoverRows: 1,
      snapshot: () => ({
        title: this.getAttribute("label") || "",
        categoryHeader: labels.region,
        categories: cells.map((cell) => cell.tile.name),
        series: [
          {
            id: "value",
            name,
            color: ctx.color(0),
            values: cells.map((cell) => cell.value),
            text: cells.map((cell) => text(cell)),
          },
        ],
        ...legendFor(options, scale.domain, ctx.format, name),
      }),
    };
  }
}

/** Registers `<ui-hex-tile-map>` (or `<prefix>-hex-tile-map`) and returns the tag. */
export function defineHexTileMap(options?: DefineOptions): string {
  return defineElement("hex-tile-map", UiHexTileMap, options);
}
