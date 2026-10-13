import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { DIRECTION_COLORS, directionOf, seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type SnapshotSeries,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import {
  AutoHeight,
  adoptPlot,
  axisBottom,
  axisFormatter,
  axisLeft,
  fadeIn,
  fitLabel,
  flag,
  gridLines,
  grow,
  hitRect,
  jsonAttr,
  percentChange,
  resolveBound,
  text,
  type ValueAxis,
} from "../internal/e18-plot.js";

export interface DumbbellItem {
  id?: string;
  label: string;
  /** First value (the left or bottom dot). Not needed with `values`. */
  from?: number;
  /** Last value (the right or top dot). Not needed with `values`. */
  to?: number;
  /** Any number of measures per row, in the order of `measures`; wins over `from` and `to`. */
  values?: readonly number[];
}

export interface DumbbellMeasure {
  name: string;
  /** CSS color; defaults to the palette slot of the measure. */
  color?: string;
}

export type DumbbellSort = "none" | "delta" | "abs-delta" | "to";

interface Row {
  id: string;
  label: string;
  values: readonly number[];
}

const MARGIN = { top: 8, bottom: 30 };
const DELTA_COLUMN = 64;
const DOT_PAD = 40;
const VALUE_STYLE =
  "fill:var(--ink-2);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums";

const firstOf = (row: Row) => row.values[0] ?? 0;
const lastOf = (row: Row) => row.values[row.values.length - 1] ?? 0;
const diffOf = (row: Row) => lastOf(row) - firstOf(row);

function sortRows(rows: readonly Row[], sort: string | null): Row[] {
  const list = [...rows];
  if (sort === "delta") list.sort((a, b) => diffOf(b) - diffOf(a));
  else if (sort === "abs-delta") list.sort((a, b) => Math.abs(diffOf(b)) - Math.abs(diffOf(a)));
  else if (sort === "to") list.sort((a, b) => lastOf(b) - lastOf(a));
  return list;
}

/**
 * `<ui-dumbbell-chart>`: two or more values per category joined by a bar. The length of the bar is
 * the spread and the change is the last value minus the first. Rows run top to bottom, or columns
 * left to right with `orientation="vertical"`. Hover, arrow keys (Up/Down, or Left/Right when
 * vertical) and a tap show every measure and the change; the legend (`<ui-chart-legend readonly>`)
 * names the dots.
 *
 * Attributes (React props in brackets): `from-label` and `to-label` (`fromLabel`, `toLabel`),
 * `from-color`, `to-color`, `orientation`, `sort` (`none`, `delta`, `abs-delta`, `to`),
 * `row-height`, `delta` (`absolute`, `percent`, `off`), `value-labels="off"`, `lower-is-better`,
 * `grid="off"`, `delta-label`, `category-label`, `items` (JSON), plus the chart attributes (`label`
 * is the React `title`, `description`, `height`, `aspect-ratio`, `loading`, `locale`, `value-format`
 * ...). Properties: `items`, `measures`, `xAxis` (`min`, `max`, `tickCount`, `format`).
 */
export class UiDumbbellChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "items",
    "from-label",
    "to-label",
    "from-color",
    "to-color",
    "orientation",
    "sort",
    "row-height",
    "delta",
    "value-labels",
    "lower-is-better",
    "grid",
    "delta-label",
    "category-label",
  ];
  #items: readonly DumbbellItem[] | undefined;
  #measures: readonly DumbbellMeasure[] | undefined;
  #axis: ValueAxis | undefined;
  readonly #height = new AutoHeight(this);

  get items(): readonly DumbbellItem[] {
    return this.#items ?? jsonAttr<DumbbellItem[]>(this, "items") ?? [];
  }
  set items(value: readonly DumbbellItem[]) {
    this.#items = value;
    this.#fit();
    this.requestDraw();
  }
  get measures(): readonly DumbbellMeasure[] | undefined {
    return this.#measures;
  }
  set measures(value: readonly DumbbellMeasure[] | undefined) {
    this.#measures = value;
    this.requestDraw();
  }
  get xAxis(): ValueAxis | undefined {
    return this.#axis;
  }
  set xAxis(value: ValueAxis | undefined) {
    this.#axis = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    this.#fit();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "items" || name === "orientation" || name === "row-height") this.#fit();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.items.length === 0;
  }

  get #vertical(): boolean {
    return this.getAttribute("orientation") === "vertical";
  }
  get #rowHeight(): number {
    return Number(this.getAttribute("row-height")) || 38;
  }

  /** Rows size themselves unless the author fixed the height or an aspect ratio. */
  #fit(): void {
    this.#height.apply(
      this.#vertical
        ? 320
        : Math.max(this.items.length * this.#rowHeight + MARGIN.top + MARGIN.bottom, 120),
    );
  }

  #rows(): Row[] {
    return sortRows(
      this.items.map((item) => ({
        id: item.id ?? item.label,
        label: item.label,
        values: item.values ?? [item.from ?? 0, item.to ?? 0],
      })),
      this.getAttribute("sort"),
    );
  }

  #measureList(rows: readonly Row[]): Array<Required<DumbbellMeasure>> {
    const widest = Math.max(2, ...rows.map((row) => row.values.length));
    const given = this.#measures;
    if (given && given.length > 0)
      return Array.from({ length: Math.max(widest, given.length) }, (_, index) => ({
        name: given[index]?.name ?? `#${index + 1}`,
        color: given[index]?.color ?? seriesColor(index),
      }));
    if (widest === 2)
      return [
        {
          name: this.getAttribute("from-label") ?? "Before",
          color: this.getAttribute("from-color") ?? seriesColor(6),
        },
        {
          name: this.getAttribute("to-label") ?? "After",
          color: this.getAttribute("to-color") ?? seriesColor(0),
        },
      ];
    return Array.from({ length: widest }, (_, index) => ({
      name: `#${index + 1}`,
      color: seriesColor(index),
    }));
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, format, locale, animate } = ctx;
    const rows = this.#rows();
    const measures = this.#measureList(rows);
    const vertical = this.#vertical;
    const modeAttr = this.getAttribute("delta");
    const delta: "absolute" | "percent" | false =
      modeAttr === "off" || modeAttr === "false"
        ? false
        : modeAttr === "percent"
          ? "percent"
          : "absolute";
    const deltaLabel = this.getAttribute("delta-label") ?? "Change";
    const lowerIsBetter = flag(this, "lower-is-better");
    const grid = flag(this, "grid", true);
    const narrow = width < 440;
    const dotPad = narrow ? 14 : DOT_PAD;
    const deltaColumn = narrow ? 50 : DELTA_COLUMN;
    const colors = measures.map((measure) => measure.color);
    const axis = this.#axis ?? {};
    const stretch = this.#height.author;
    const height = ctx.height;
    const rowHeight = stretch
      ? Math.max(20, (height - MARGIN.top - MARGIN.bottom) / Math.max(1, rows.length))
      : this.#rowHeight;

    const changeText = (row: Row, mode: "absolute" | "percent") => {
      const diff = diffOf(row);
      return mode === "percent"
        ? percentChange(firstOf(row), lastOf(row), locale)
        : `${diff > 0 ? "+" : ""}${format(diff)}`;
    };
    const mode = delta || "absolute";

    // Scale and plot box.
    const all = rows.flatMap((row) => row.values);
    const lo = all.length ? Math.min(...all) : 0;
    const hi = all.length ? Math.max(...all) : 1;
    const domain: [number, number] = [
      resolveBound(axis.min, lo > 0 && lo < hi * 0.4 ? 0 : lo),
      resolveBound(axis.max, hi),
    ];
    const tickFormat = axisFormatter(this, axis.format);
    let top: number;
    let left: number;
    let innerWidth: number;
    let innerHeight: number;
    let column = 0;
    let scale: ReturnType<typeof linearScale>;
    if (vertical) {
      top = delta ? 26 : 12;
      innerHeight = Math.max(60, height - top - 30);
      const pad = 14;
      scale = linearScale({
        domain,
        range: [innerHeight - pad, pad],
        tickCount: axis.tickCount ?? Math.max(3, Math.round(innerHeight / 52)),
      });
      const labels = scale.ticks().map((tick) => tickFormat(tick));
      left = Math.max(...labels.map((label) => estimateTextWidth(label)), 16) + 18;
      innerWidth = Math.max(60, width - left - 8);
      column = innerWidth / Math.max(1, rows.length);
    } else {
      left = Math.min(
        Math.max(72, width * (narrow ? 0.3 : 0.28)),
        Math.max(...rows.map((row) => estimateTextWidth(row.label, 13)), 40) + 16,
      );
      top = MARGIN.top;
      innerWidth = Math.max(60, width - left - (delta ? deltaColumn : 8));
      innerHeight = rows.length * rowHeight;
      scale = linearScale({
        domain,
        range: [dotPad, innerWidth - dotPad],
        tickCount: axis.tickCount ?? Math.max(3, Math.round(innerWidth / 90)),
      });
    }
    const ticks = scale.ticks().map((tick) => ({
      key: tick,
      position: scale.map(tick),
      label: tickFormat(tick),
    }));

    const plot = svg("g", { transform: `translate(${left},${top})` });
    root.append(plot);
    if (vertical) {
      if (grid) plot.append(gridLines(ticks, "horizontal", innerWidth));
      plot.append(
        axisLeft(ticks, 0, axis.title),
        axisBottom(
          rows.map((row, i) => ({
            key: row.id,
            position: i * column + column / 2,
            label: fitLabel(row.label, column - 6),
          })),
          innerHeight,
        ),
      );
    } else {
      if (grid) plot.append(gridLines(ticks, "vertical", innerHeight));
      plot.append(axisBottom(ticks, innerHeight));
    }

    const goodUp = !lowerIsBetter;
    const deltaColor = (row: Row) => {
      const direction = directionOf(diffOf(row));
      if (direction === "flat") return DIRECTION_COLORS.flat;
      return (direction === "up") === goodUp ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
    };
    const showValues = flag(this, "value-labels", true) && (vertical ? column >= 64 : !narrow);
    const pixels = (row: Row) => row.values.map((value) => scale.map(value));
    const centerOf = (row: Row) => {
      const px = pixels(row);
      return px.reduce((sum, value) => sum + value, 0) / Math.max(1, px.length) || 0;
    };
    const measureText = (row: Row) =>
      measures
        .map((measure, index) => `${measure.name} ${format(row.values[index] ?? 0)}`)
        .join(", ");

    const marks: ChartMark[] = rows.map((row, i) => {
      const px = pixels(row);
      const group = svg("g", { "data-row": "" });
      plot.append(group);
      const cross = vertical ? i * column + column / 2 : i * rowHeight + rowHeight / 2;
      const band = vertical
        ? { x: i * column + 2, y: 0, width: column - 4, height: innerHeight }
        : {
            x: 0,
            y: cross - (rowHeight - 4) / 2,
            width: innerWidth + (delta ? deltaColumn : 0),
            height: rowHeight - 4,
          };
      group.append(
        svg("rect", { ...band, rx: 8, "data-band": "", style: "fill:var(--chart-grid)" }),
      );

      // The bar and the dots; a gradient joins two measures, a neutral bar joins more.
      const points = px.map((p) => (vertical ? { x: cross, y: p } : { x: p, y: cross }));
      const a = points[0] ?? { x: 0, y: 0 };
      const z = points[points.length - 1] ?? a;
      const gradient = points.length === 2 ? uid("dumbbell") : null;
      if (gradient)
        group.append(
          svg(
            "defs",
            {},
            svg(
              "linearGradient",
              {
                id: gradient,
                gradientUnits: "userSpaceOnUse",
                x1: a.x,
                y1: a.y,
                x2: z.x === a.x && z.y === a.y ? z.x + 1 : z.x,
                y2: z.y,
              },
              svg("stop", { offset: "0%", style: `stop-color:${colors[0]}` }),
              svg("stop", { offset: "100%", style: `stop-color:${colors[colors.length - 1]}` }),
            ),
          ),
        );
      const bar = svg("line", {
        "data-bar": "",
        x1: Math.min(...points.map((p) => p.x)),
        x2: Math.max(...points.map((p) => p.x)),
        y1: Math.min(...points.map((p) => p.y)),
        y2: Math.max(...points.map((p) => p.y)),
        "stroke-width": 4,
        "stroke-linecap": "round",
        "aria-hidden": "true",
        style: `stroke:${gradient ? `url(#${gradient})` : "var(--line-strong)"};transform-box:fill-box;transform-origin:center`,
      });
      group.append(bar);
      for (const [index, p] of points.entries())
        group.append(
          svg("circle", {
            cx: p.x,
            cy: p.y,
            r: 6 + (index === points.length - 1 ? 0.5 : 0),
            "stroke-width": 2,
            "aria-hidden": "true",
            style: `fill:${colors[index]};stroke:var(--surface)`,
          }),
        );
      if (animate)
        grow(bar, vertical ? "y" : "x", i, {
          duration: 560,
          step: Math.min(50, 400 / Math.max(1, rows.length)),
        });

      // Labels.
      const fade = (node: Element) => {
        if (animate) fadeIn(node, 360, 420);
        return node;
      };
      if (!vertical)
        group.append(
          text(
            fitLabel(row.label, left - 14),
            { x: -12, y: cross, dy: "0.34em", "text-anchor": "end" },
            "fill:var(--ink-2);font-size:12px;font-weight:600",
          ),
        );
      if (showValues) {
        const values = svg("g", { "aria-hidden": "true" });
        if (vertical)
          for (const [index, value] of row.values.entries())
            values.append(
              text(
                format(value),
                { x: cross + 12, y: px[index] as number, dy: "0.34em", "text-anchor": "start" },
                VALUE_STYLE,
              ),
            );
        else if (row.values.length === 2) {
          const [p0, p1] = px as [number, number];
          const low = Math.min(p0, p1);
          const high = Math.max(p0, p1);
          const [v0, v1] = row.values as [number, number];
          values.append(
            text(
              format(p0 === low ? v0 : v1),
              { x: low - 12, y: cross, dy: "0.34em", "text-anchor": "end" },
              VALUE_STYLE,
            ),
            text(
              format(p0 === low ? v1 : v0),
              { x: high + 12, y: cross, dy: "0.34em", "text-anchor": "start" },
              VALUE_STYLE,
            ),
          );
        } else
          for (const [index, value] of row.values.entries())
            values.append(
              text(
                format(value),
                { x: px[index] as number, y: cross - 12, "text-anchor": "middle" },
                VALUE_STYLE,
              ),
            );
        group.append(fade(values));
      }
      if (delta)
        group.append(
          fade(
            text(
              changeText(row, delta),
              vertical
                ? { x: cross, y: -10, "text-anchor": "middle" }
                : { x: innerWidth + deltaColumn - 4, y: cross, dy: "0.34em", "text-anchor": "end" },
              `fill:${deltaColor(row)};font-size:12px;font-weight:700;font-variant-numeric:tabular-nums`,
            ),
          ),
        );

      // The keyboard stop and hit area of the row.
      const el = hitRect(band.x, band.y, band.width, band.height);
      group.append(el);
      return {
        el,
        label: `${row.label}. ${measureText(row)}, ${deltaLabel} ${changeText(row, mode)}`,
      };
    });

    const rowRows = (row: Row): TooltipRow[] => [
      ...measures.map((measure, index) => ({
        id: String(index),
        name: measure.name,
        value: format(row.values[index] ?? 0),
        color: measure.color,
        shape: "dot" as const,
      })),
      {
        id: "delta",
        name: deltaLabel,
        value: changeText(row, mode),
        color: "transparent",
        emphasis: true,
      },
    ];

    const names = rows.map((row) => row.label);
    return {
      summary: `${rows.length} ${rows.length === 1 ? "row" : "rows"}: ${measures.map((m) => m.name).join(", ")}`,
      marks,
      maxHoverRows: measures.length + 1,
      hit: (x, y) => {
        if (!rows.length) return -1;
        const px = x - left;
        const py = y - top;
        if (py < 0 || py > innerHeight) return -1;
        if (vertical && (px < 0 || px > innerWidth)) return -1;
        const index = vertical ? Math.floor(px / column) : Math.floor(py / rowHeight);
        return Math.min(rows.length - 1, Math.max(0, index));
      },
      hover: (index) => {
        const row = rows[index];
        if (!row) return null;
        return {
          title: row.label,
          rows: rowRows(row),
          x: vertical ? left + index * column + column / 2 : left + centerOf(row),
          y: vertical ? top + centerOf(row) : top + index * rowHeight + rowHeight / 2,
        };
      },
      snapshot: () => {
        const columns: SnapshotSeries[] = measures.map((measure, index) => ({
          id: `m${index}`,
          name: measure.name,
          color: measure.color,
          shape: "dot",
          values: rows.map((row) => row.values[index] ?? null),
          text: rows.map((row) => (row.values[index] == null ? "" : format(row.values[index]))),
        }));
        columns.push({
          id: "delta",
          name: deltaLabel,
          color: "transparent",
          values: rows.map(diffOf),
          text: rows.map((row) => changeText(row, mode)),
        });
        return {
          title: this.getAttribute("label") ?? "Dumbbell chart",
          categoryHeader: this.getAttribute("category-label") ?? "Category",
          categories: names,
          series: columns,
          legend: measures.map((measure, index) => ({
            id: `m${index}`,
            name: measure.name,
            color: measure.color,
            shape: "dot" as const,
          })),
        };
      },
    };
  }
}

/** Registers `<ui-dumbbell-chart>` (or `<prefix>-dumbbell-chart`) and returns the tag. */
export function defineDumbbellChart(options?: DefineOptions): string {
  return defineElement("dumbbell-chart", UiDumbbellChart, options);
}
