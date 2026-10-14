import {
  assignUnits,
  type GridOrder,
  gridCell,
  waffleCounts,
} from "@jcsoftdev/ui-core/chart/units";
import type { DefineOptions } from "../internal/base.js";
import { defineElement } from "../internal/base.js";
import { type DrawContext, type DrawResult, svg } from "../internal/chart-base.js";
import { UNIT_ATTRIBUTES, UnitChartElement } from "../internal/e22-unit-chart.js";
import { type Lattice, latticeHit, navigate, popUnits } from "../internal/e22-units.js";

type CellShape = "square" | "rounded" | "circle";

const number = (value: string | null, fallback: number): number => {
  const parsed = value === null || value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function cell(x: number, y: number, size: number, shape: CellShape, color: string): SVGGElement {
  const style = `fill:${color}`;
  return svg(
    "g",
    { "data-unit": "", style: "transform-box:fill-box;transform-origin:center" },
    shape === "circle"
      ? svg("circle", { cx: x + size / 2, cy: y + size / 2, r: size / 2, style })
      : svg("rect", {
          x,
          y,
          width: size,
          height: size,
          rx: shape === "rounded" ? size * 0.28 : Math.min(2, size * 0.08),
          style,
        }),
  );
}

/**
 * `<ui-waffle-chart>`: proportions as a grid of cells (10 x 10 by default, so one cell is 1%).
 * Cells are shared with the largest remainder method, so they always add up. Each category is one
 * mark: hovering any of its cells (or the gaps between them), moving with the arrows or focusing a
 * legend item highlights it; hidden categories leave their cells empty. The arrows move over the
 * plane: left and right walk the categories, up and down go to the category in the row above or
 * below.
 *
 * Attributes: `rows`, `columns` (10), `total` (what the whole grid stands for; the rest stays
 * empty), `cell-shape` (`square`, `rounded`, `circle`), `order` (`row`: left to right from the top;
 * `column`: bottom to top from the left), `gap` (fraction of the cell, 0.14), `data` (JSON), plus the
 * chart attributes (`label`, `description`, `height` (default 260), `value-format`, `locale` ...).
 * Property: `data`, an array of `{ id, name, value, color? }`. Place a `ui-chart-legend` and a
 * `ui-chart-tooltip` inside for the legend and the details.
 */
export class UiWaffleChart extends UnitChartElement {
  static override observedAttributes = [
    ...UNIT_ATTRIBUTES,
    "rows",
    "columns",
    "total",
    "cell-shape",
    "order",
    "gap",
  ];
  protected readonly kind = "waffle-chart";
  protected override readonly defaultHeight = 260;

  protected draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, color, animate } = ctx;
    const data = this.data;
    const format = this.unitFormat(ctx);
    const rows = Math.max(1, Math.floor(number(this.getAttribute("rows"), 10)));
    const columns = Math.max(1, Math.floor(number(this.getAttribute("columns"), 10)));
    const gap = Math.max(0, number(this.getAttribute("gap"), 0.14));
    const attr = this.getAttribute("cell-shape");
    const shape: CellShape = attr === "square" || attr === "circle" ? attr : "rounded";
    const order: GridOrder = this.getAttribute("order") === "column" ? "column" : "row";
    const totalAttr = this.getAttribute("total");
    const total = totalAttr === null ? undefined : number(totalAttr, Number.NaN);
    const sum = this.total();
    const whole = total != null && total > sum ? total : sum;
    const counts = waffleCounts(
      data.map((item) => item.value),
      rows * columns,
      total != null && Number.isFinite(total) ? total : undefined,
    );
    const owners = assignUnits(counts);
    const colors = data.map((item, index) => color(index, item.color));
    const share = (value: number) => this.percent(ctx, whole ? value / whole : 0);

    const across = columns + (columns - 1) * gap;
    const down = rows + (rows - 1) * gap;
    const size = Math.max(1, Math.min(width / across, height / down));
    const pitch = size * (1 + gap);
    const visible = data.flatMap((item, index) =>
      (counts[index] ?? 0) > 0 && !this.isHidden(item.id) ? [index] : [],
    );
    const markOf = new Map(visible.map((index, mark) => [index, mark]));

    const slots = Array.from({ length: rows * columns }, (_, index) => {
      const at = gridCell(index, columns, rows, order);
      const owner = owners[index] ?? -1;
      return { x: at.column * pitch, y: at.row * pitch, at, owner: markOf.has(owner) ? owner : -1 };
    });
    const lattice: Lattice = {
      x: 0,
      y: 0,
      pitch,
      size,
      columns,
      rows,
      owners: Array.from({ length: rows * columns }, () => -1),
    };
    for (const slot of slots)
      (lattice.owners as number[])[slot.at.row * columns + slot.at.column] =
        markOf.get(slot.owner) ?? -1;

    const track = svg("g");
    for (const slot of slots)
      if (slot.owner < 0) track.append(cell(slot.x, slot.y, size, shape, "var(--track)"));
    root.append(track);

    const anchors: Array<{ x: number; y: number }> = [];
    const centers: Array<{ x: number; y: number }> = [];
    const marks = visible.map((index, mark) => {
      const item = data[index];
      const own = slots.filter((slot) => slot.owner === index);
      const group = svg("g", { "data-cat": mark, "data-series": item?.id });
      for (const slot of own)
        group.append(cell(slot.x, slot.y, size, shape, colors[index] as string));
      root.append(group);
      const xs = own.map((slot) => slot.x);
      const ys = own.map((slot) => slot.y);
      anchors.push({
        x: Math.max(...xs) + size,
        y: (Math.min(...ys) + Math.max(...ys) + size) / 2,
      });
      centers.push({
        x: xs.reduce((acc, x) => acc + x, 0) / own.length + size / 2,
        y: ys.reduce((acc, y) => acc + y, 0) / own.length + size / 2,
      });
      const value = item?.value ?? 0;
      return { el: group, label: `${item?.name}: ${format(value)} (${share(value)})` };
    });
    if (animate) popUnits(root, { duration: 360, budget: 700 });

    const pick = latticeHit(lattice, ctx.hover);
    const dot = shape === "circle" ? "dot" : "square";
    return {
      summary: data.map((item) => `${item.name} ${share(item.value)}`).join(", "),
      marks,
      maxHoverRows: 1,
      hit: (x, y) => pick(x, y),
      hover: (mark) => {
        const index = visible[mark];
        const item = index === undefined ? undefined : data[index];
        const at = anchors[mark];
        if (index === undefined || !item || !at) return null;
        return {
          rows: [
            {
              id: item.id,
              name: item.name,
              value: format(item.value),
              color: colors[index] as string,
              shape: dot,
              note: share(item.value),
            },
          ],
          x: at.x,
          y: at.y,
          category: index,
        };
      },
      nav: (mark, intent) => navigate(centers, mark, intent),
      snapshot: () => {
        const label = this.getAttribute("label") ?? this.resolvedLabels.chart;
        return {
          title: label,
          categoryHeader: this.getAttribute("category-header") ?? "Category",
          categories: data.map((item) => item.name),
          series: [
            {
              id: "value",
              name: label,
              color: color(0),
              values: data.map((item) => item.value),
              text: data.map((item) => format(item.value)),
            },
            {
              id: "share",
              name: "%",
              color: color(0),
              values: data.map((item) => (whole ? item.value / whole : 0)),
              text: data.map((item) => share(item.value)),
            },
          ],
          legend: data.map((item, index) => ({
            id: item.id,
            name: item.name,
            color: colors[index] as string,
            shape: dot,
          })),
        };
      },
    };
  }
}

/** Registers `<ui-waffle-chart>` (or `<prefix>-waffle-chart`) and returns the tag. */
export function defineWaffleChart(options?: DefineOptions): string {
  return defineElement("waffle-chart", UiWaffleChart, options);
}
