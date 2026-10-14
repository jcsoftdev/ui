import { estimateTextWidth, thinTicks } from "@jcsoftdev/ui-core/chart/axis";
import { resolveAxisFormat, resolveFormat } from "@jcsoftdev/ui-core/chart/format";
import { bandScale, linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  join,
  svg,
} from "../internal/chart-base.js";
import { axisBottom, axisCategoryLeft, axisLeft, gridLines } from "../internal/e17-axes.js";
import css from "../internal/e17-chart.css.js";
import type { ValueAxisOptions } from "../internal/e17-layout.js";

export type { ValueAxisOptions };

export interface LollipopItem {
  id?: string;
  label: string;
  value: number;
  /** CSS color or token for this stick; defaults to the chart color. */
  color?: string;
}

const PAD = { top: 12, bottom: 28 };

const fitLabel = (text: string, room: number): string => {
  const max = Math.max(3, Math.floor(room / 6.6));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

/**
 * `<ui-lollipop-chart>`: a stick and a dot per category, the quiet cousin of the bar chart for many
 * categories or when the end value matters more than the area. Negative values hang from the zero
 * line. Set `height` for long lists (the rows share it).
 *
 * Attributes: `orientation="horizontal|vertical"`, `sort="none|asc|desc"`, `dot-size` (7),
 * `data-labels="off"`, `series-name`, `color`, `grid="off"`, plus the chart attributes. Properties:
 * `items`, `yAxis`, `valueFormat`. Mark index is the (sorted) row order.
 */
export class UiLollipopChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "orientation",
    "sort",
    "dot-size",
    "data-labels",
    "series-name",
    "color",
    "grid",
  ];
  static override retain = true;

  yAxis: ValueAxisOptions = {};

  #items: readonly LollipopItem[] = [];
  #g: SVGGElement | undefined;
  #rows: SVGGElement[] = [];
  #dot = 7;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#paintActive(info ? info.index : null);
    });
  }

  get items(): readonly LollipopItem[] {
    return this.#items;
  }
  set items(value: readonly LollipopItem[]) {
    this.#items = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.#items.length === 0;
  }

  #paintActive(index: number | null): void {
    this.#rows.forEach((row, i) => {
      row.style.opacity = index != null && index !== i ? "0.4" : "1";
      const dot = row.querySelector("circle");
      dot?.setAttribute("r", `${index === i ? this.#dot + 1.5 : this.#dot}`);
    });
  }

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height } = context;
    const vertical = this.getAttribute("orientation") === "vertical";
    const sort = this.getAttribute("sort");
    const dot = Number(this.getAttribute("dot-size")) || 7;
    this.#dot = dot;
    const dataLabels = this.getAttribute("data-labels") !== "off";
    const grid = this.getAttribute("grid") !== "off";
    const seriesName = this.getAttribute("series-name") ?? "Value";
    const currency = this.getAttribute("currency") || undefined;
    const locale = context.locale;
    const fmt = resolveFormat(this.valueFormat, { locale, currency });
    const axisFmt = resolveAxisFormat(this.yAxis.format ?? this.valueFormat, { locale, currency });
    const color = context.color(0, this.getAttribute("color") ?? undefined);
    const rows = [...this.#items];
    if (sort === "desc") rows.sort((a, b) => b.value - a.value);
    else if (sort === "asc") rows.sort((a, b) => a.value - b.value);

    const values = rows.map((row) => row.value);
    const bound = (b: ValueAxisOptions["min"], value: number) =>
      typeof b === "function" ? b(value) : (b ?? value);
    let lo = bound(this.yAxis.min, Math.min(0, ...values));
    let hi = bound(this.yAxis.max, Math.max(0, ...values));
    if (lo === hi) hi = lo + 1;
    if (lo > hi) [lo, hi] = [hi, lo];
    const top = PAD.top + (vertical && dataLabels ? 8 : 0);
    const innerHeight = Math.max(40, height - top - PAD.bottom);
    let left: number;
    let innerWidth: number;
    let scale: ReturnType<typeof linearScale>;
    let band: ReturnType<typeof bandScale>;
    let ticks: Array<{ key: number; position: number; label: string }>;
    let catTicks: Array<{ key: string | number; position: number; label: string }>;
    if (vertical) {
      scale = linearScale({
        domain: [lo, hi],
        range: [innerHeight, 0],
        tickCount: this.yAxis.tickCount ?? Math.max(2, Math.round(innerHeight / 52)),
      });
      ticks = scale.ticks().map((t) => ({ key: t, position: scale.map(t), label: axisFmt(t) }));
      left = Math.max(...ticks.map((t) => estimateTextWidth(t.label)), 16) + 14;
      innerWidth = Math.max(40, width - left - 10);
      band = bandScale({
        count: rows.length,
        range: [0, innerWidth],
        paddingInner: 0.3,
        paddingOuter: 0.15,
      });
      catTicks = thinTicks(
        rows.map((row, i) => ({
          key: row.id ?? row.label,
          position: band.center(i),
          label: row.label,
        })),
        12,
      );
    } else {
      left = Math.min(
        width * 0.36,
        Math.max(48, ...rows.map((row) => estimateTextWidth(row.label, 12))) + 14,
      );
      innerWidth = Math.max(40, width - left - (dataLabels ? 56 : 14));
      scale = linearScale({
        domain: [lo, hi],
        range: [0, innerWidth],
        tickCount: this.yAxis.tickCount ?? Math.max(2, Math.round(innerWidth / 110)),
      });
      ticks = scale.ticks().map((t) => ({ key: t, position: scale.map(t), label: axisFmt(t) }));
      band = bandScale({
        count: rows.length,
        range: [0, innerHeight],
        paddingInner: 0.2,
        paddingOuter: 0.1,
      });
      catTicks = rows.map((row, i) => ({
        key: row.id ?? row.label,
        position: band.center(i),
        label: fitLabel(row.label, left - 14),
      }));
    }
    const zero = scale.map(0);

    this.#g ??= svg("g");
    const g = this.#g;
    g.setAttribute("transform", `translate(${left},${top})`);
    if (!g.isConnected) root.append(g);
    g.replaceChildren();
    if (grid)
      g.append(
        gridLines(
          ticks,
          vertical ? "horizontal" : "vertical",
          vertical ? innerWidth : innerHeight,
          zero,
        ),
      );
    if (vertical) g.append(axisLeft(ticks, 0, this.yAxis.title), axisBottom(catTicks, innerHeight));
    else g.append(axisCategoryLeft(catTicks), axisBottom(ticks, innerHeight));

    const layer = svg("g");
    g.append(layer);
    const built = join(
      layer,
      rows,
      (row) => row.id ?? row.label,
      () => svg("g"),
      (el, row) => {
        const i = rows.indexOf(row);
        const fill = context.color(0, row.color ?? this.getAttribute("color") ?? undefined);
        const c = band.center(i);
        const end = scale.map(row.value);
        const negative = row.value < 0;
        const cx = vertical ? c : end;
        const cy = vertical ? end : c;
        el.replaceChildren(
          svg("line", {
            "data-stick": "",
            x1: vertical ? c : zero,
            x2: cx,
            y1: vertical ? zero : c,
            y2: cy,
            "stroke-width": 2.5,
            "stroke-linecap": "round",
            style: `stroke:${fill};transform-box:fill-box;transform-origin:${vertical ? (negative ? "center top" : "center bottom") : negative ? "right center" : "left center"}`,
          }),
          svg("circle", {
            cx,
            cy,
            r: dot,
            "stroke-width": 2,
            style: `fill:${fill};stroke:var(--surface)`,
          }),
          ...(dataLabels
            ? [
                svg(
                  "text",
                  {
                    "data-e17": "label",
                    x: vertical ? cx : cx + (negative ? -(dot + 6) : dot + 6),
                    y: vertical ? cy + (negative ? dot + 14 : -(dot + 6)) : cy,
                    dy: vertical ? undefined : "0.34em",
                    "text-anchor": vertical ? "middle" : negative ? "end" : "start",
                    "aria-hidden": "true",
                  },
                  fmt(row.value),
                ),
              ]
            : []),
        );
        el.setAttribute("style", "transition:opacity .15s");
      },
    ) as SVGGElement[];
    this.#rows = built;
    if (context.animate && rows.length <= 200) {
      const per = Math.min(40, 360 / Math.max(1, rows.length));
      built.forEach((el, i) => {
        el.querySelector("[data-stick]")?.animate(
          [
            { transform: vertical ? "scaleY(0)" : "scaleX(0)" },
            { transform: vertical ? "scaleY(1)" : "scaleX(1)" },
          ],
          {
            duration: 520,
            delay: i * per,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          },
        );
      });
    }
    this.#paintActive(context.hover);

    const labelOf = (i: number) =>
      `${(rows[i] as LollipopItem).label}: ${fmt((rows[i] as LollipopItem).value)}`;
    return {
      summary: `${rows.length} items from ${fmt(Math.min(...values))} to ${fmt(Math.max(...values))}`,
      marks: {
        count: rows.length,
        label: labelOf,
        element: (i) => (built[i] as SVGElement | undefined) ?? null,
      },
      maxHoverRows: 1,
      hit: (x, y) => {
        if (!rows.length) return -1;
        return band.indexAt(vertical ? x - left : y - top);
      },
      hover: (i) => {
        const row = rows[i];
        if (!row) return null;
        return {
          title: row.label,
          rows: [
            {
              id: "value",
              name: seriesName,
              value: fmt(row.value),
              color: context.color(0, row.color ?? this.getAttribute("color") ?? undefined),
              shape: "dot",
            },
          ],
          x: vertical ? left + band.center(i) : left + scale.map(row.value),
          y: vertical ? top + scale.map(row.value) : top + band.center(i),
        };
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? "",
        categoryHeader: "Category",
        categories: rows.map((row) => row.label),
        series: [
          {
            id: "value",
            name: seriesName,
            color,
            values: rows.map((row) => row.value),
            text: rows.map((row) => fmt(row.value)),
          },
        ],
      }),
    };
  }
}

/** Registers `<ui-lollipop-chart>` (or `<prefix>-lollipop-chart`) and returns the tag. */
export function defineLollipopChart(options?: DefineOptions): string {
  return defineElement("lollipop-chart", UiLollipopChart, options);
}
