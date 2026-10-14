import { fitUnitGrid, unitCount, unitFractions } from "@jcsoftdev/ui-core/chart/units";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import { type DrawContext, type DrawResult, svg } from "../internal/chart-base.js";
import { UNIT_ATTRIBUTES, UnitChartElement } from "../internal/e22-unit-chart.js";
import {
  type ResolvedUnitShape,
  resolveUnitShape,
  type UnitIcon,
} from "../internal/e22-unit-icons.js";
import {
  glyph,
  type Lattice,
  latticeHit,
  MIXED_KEY,
  navigate,
  popUnits,
  setUnitKey,
} from "../internal/e22-units.js";

interface Placed {
  key: string;
  category: number;
  fill: number;
  column: number;
  line: number;
  shape: ResolvedUnitShape;
}

const number = (value: string | null, fallback: number): number => {
  const parsed = value === null || value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * `<ui-pictogram-chart>`: an isotype pictogram. Every icon stands for `per-unit` of something
 * (clients, services, bottles) and the last icon of a category is cut to its remainder. Icons grow
 * to the largest size that fits the box, up to `unit-size`. Each category is one mark: hovering any
 * of its icons or the gaps between them keeps it highlighted until the pointer reaches another
 * category or leaves the chart. The arrows move over the plane (left and right walk the categories,
 * up and down go to the category in the row above or below).
 *
 * Attributes: `per-unit` (1), `icon` (a built-in name such as `person`, or a 24 x 24 SVG path),
 * `layout` (`grid`: categories flow one after the other; `rows`: each starts a new row), `columns`,
 * `total` (capacity drawn as empty icons after the data, in `grid`), `unit-size` (32), `gap` (0.25),
 * `unit-label` (what the values count, for the key and the tooltip), `show-key` (`off` hides the
 * "icon = N units" line; shown by default when `per-unit` is not 1), `data` (JSON), plus the chart
 * attributes (`label`, `height` (default 200), `value-format`, `locale` ...). Properties: `data`, an
 * array of `{ id, name, value, color?, icon? }`, and `icon` (a name, a path or a shape).
 */
export class UiPictogramChart extends UnitChartElement {
  static override observedAttributes = [
    ...UNIT_ATTRIBUTES,
    "per-unit",
    "icon",
    "layout",
    "columns",
    "total",
    "unit-size",
    "gap",
    "show-key",
  ];
  protected readonly kind = "pictogram-chart";
  readonly #clips = uid("pictogram");
  #icon: UnitIcon | undefined;

  get icon(): UnitIcon {
    return this.#icon ?? this.getAttribute("icon") ?? "person";
  }
  set icon(value: UnitIcon) {
    this.#icon = value;
    this.requestDraw();
  }

  protected draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, color, animate } = ctx;
    const data = this.data;
    const format = this.unitFormat(ctx);
    const perUnit = number(this.getAttribute("per-unit"), 1);
    const icon = this.icon;
    const layout = this.getAttribute("layout") === "rows" ? "rows" : "grid";
    const columnsAttr = number(this.getAttribute("columns"), 0);
    const totalAttr = number(this.getAttribute("total"), Number.NaN);
    const unitSize = number(this.getAttribute("unit-size"), 32);
    const gap = Math.max(0, number(this.getAttribute("gap"), 0.25));
    const unitLabel = this.unitLabel;
    const sum = this.total();
    const colors = data.map((item, index) => color(index, item.color));
    const share = (value: number) => this.percent(ctx, sum ? value / sum : 0);

    const runs = data.map((item) => unitFractions(item.value, perUnit));
    const used = runs.reduce((acc, run) => acc + run.length, 0);
    const spare =
      layout === "grid" && Number.isFinite(totalAttr)
        ? Math.max(0, unitCount(totalAttr, perUnit).units - used)
        : 0;
    const count = used + spare;
    const rowsFor =
      layout === "rows"
        ? (cols: number) => runs.reduce((acc, run) => acc + Math.ceil(run.length / cols), 0)
        : (cols: number) => Math.ceil(count / cols);
    const fit = fitUnitGrid({
      width,
      height,
      gap,
      maxSize: unitSize,
      maxColumns:
        layout === "rows" ? Math.max(1, ...runs.map((run) => run.length)) : Math.max(1, count),
      rowsFor,
      columns: columnsAttr > 0 ? columnsAttr : undefined,
    });
    const size = fit.size;
    const pitch = size * (1 + gap);

    const placed: Placed[] = [];
    let slot = 0;
    let row = 0;
    const place = (category: number, fill: number, shape: ResolvedUnitShape, index: number) => {
      placed.push({
        key: `${category}-${index}`,
        category,
        fill,
        column: layout === "rows" ? index % fit.columns : slot % fit.columns,
        line:
          layout === "rows"
            ? row + Math.floor(index / fit.columns)
            : Math.floor(slot / fit.columns),
        shape,
      });
      slot += 1;
    };
    runs.forEach((run, category) => {
      const shape = resolveUnitShape(data[category]?.icon ?? icon);
      run.forEach((fill, index) => {
        place(category, fill, shape, index);
      });
      if (layout === "rows") row += Math.ceil(run.length / fit.columns);
    });
    const spareShape = resolveUnitShape(icon);
    for (let index = 0; index < spare; index += 1) place(-1, 0, spareShape, used + index);

    const visible = data.flatMap((item, index) =>
      item.value > 0 && (runs[index]?.length ?? 0) > 0 && !this.isHidden(item.id) ? [index] : [],
    );
    const markOf = new Map(visible.map((index, mark) => [index, mark]));
    const lines = placed.reduce((acc, unit) => Math.max(acc, unit.line + 1), 0);
    const owners = Array.from({ length: Math.max(1, fit.columns * lines) }, () => -1);
    for (const unit of placed)
      owners[unit.line * fit.columns + unit.column] = markOf.get(unit.category) ?? -1;
    if (layout === "rows")
      for (let line = 0; line < lines; line += 1) {
        const first = owners
          .slice(line * fit.columns, (line + 1) * fit.columns)
          .find((o) => o >= 0);
        if (first === undefined) continue;
        for (let column = 0; column < fit.columns; column += 1)
          if (owners[line * fit.columns + column] === -1)
            owners[line * fit.columns + column] = first;
      }
    const lattice: Lattice = { x: 0, y: 0, pitch, size, columns: fit.columns, rows: lines, owners };

    const at = (unit: Placed) => ({ x: unit.column * pitch, y: unit.line * pitch });
    const draw = (unit: Placed, fill: number, paint: string) => {
      const { x, y } = at(unit);
      return glyph(unit.shape, x, y, size, fill, paint, `${this.#clips}-${unit.key}`);
    };
    const rest = svg("g");
    for (const unit of placed) {
      if (unit.category === -1) rest.append(draw(unit, 0, "var(--track)"));
      else if (!markOf.has(unit.category)) rest.append(draw(unit, 0, "var(--track)"));
    }
    root.append(rest);

    const anchors: Array<{ x: number; y: number }> = [];
    const centers: Array<{ x: number; y: number }> = [];
    const marks = visible.map((index, mark) => {
      const item = data[index];
      const own = placed.filter((unit) => unit.category === index);
      const group = svg("g", { "data-cat": mark, "data-series": item?.id });
      for (const unit of own) group.append(draw(unit, unit.fill, colors[index] as string));
      root.append(group);
      const lastUnit = own[own.length - 1] as Placed;
      anchors.push({ x: at(lastUnit).x + size, y: at(lastUnit).y + size / 2 });
      centers.push({
        x: own.reduce((acc, unit) => acc + at(unit).x, 0) / own.length + size / 2,
        y: own.reduce((acc, unit) => acc + at(unit).y, 0) / own.length + size / 2,
      });
      const value = item?.value ?? 0;
      return { el: group, label: `${item?.name}: ${format(value)} (${share(value)})` };
    });
    if (animate) popUnits(root);

    const mixed = new Set(data.map((item) => JSON.stringify(item.icon ?? icon))).size > 1;
    const keyed =
      this.getAttribute("show-key") !== "off" && (this.hasAttribute("show-key") || perUnit !== 1);
    setUnitKey(
      this,
      keyed
        ? {
            shape: resolveUnitShape(mixed ? MIXED_KEY : icon),
            text: `= ${this.number(ctx, perUnit)} ${unitLabel}`,
          }
        : null,
    );

    const pick = latticeHit(lattice, ctx.hover);
    return {
      summary: data.map((item) => `${item.name} ${format(item.value)}`).join(", "),
      marks,
      maxHoverRows: 1,
      hit: (x, y) => pick(x, y),
      hover: (mark) => {
        const index = visible[mark];
        const item = index === undefined ? undefined : data[index];
        const anchor = anchors[mark];
        if (index === undefined || !item || !anchor) return null;
        return {
          title: item.name,
          rows: [
            {
              id: item.id,
              name: unitLabel,
              value: format(item.value),
              color: colors[index] as string,
              note: share(item.value),
            },
          ],
          x: anchor.x,
          y: anchor.y,
          category: index,
        };
      },
      nav: (mark, intent) => navigate(centers, mark, intent),
      snapshot: () => ({
        title: this.getAttribute("label") ?? this.resolvedLabels.chart,
        categoryHeader: this.getAttribute("category-header") ?? "Category",
        categories: data.map((item) => item.name),
        series: [
          {
            id: "value",
            name: unitLabel,
            color: color(0),
            values: data.map((item) => item.value),
            text: data.map((item) => format(item.value)),
          },
          {
            id: "units",
            name: `÷ ${this.number(ctx, perUnit)}`,
            color: color(0),
            values: data.map((item) => item.value / perUnit),
            text: data.map((item) => this.number(ctx, item.value / perUnit)),
          },
        ],
        legend: data.map((item, index) => ({
          id: item.id,
          name: item.name,
          color: colors[index] as string,
          shape: "dot",
        })),
      }),
    };
  }

  override disconnectedCallback(): void {
    setUnitKey(this, null);
    super.disconnectedCallback();
  }
}

/** Registers `<ui-pictogram-chart>` (or `<prefix>-pictogram-chart`) and returns the tag. */
export function definePictogramChart(options?: DefineOptions): string {
  return defineElement("pictogram-chart", UiPictogramChart, options);
}
