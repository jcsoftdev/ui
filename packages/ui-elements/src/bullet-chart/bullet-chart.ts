import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { bandOpacity, bulletBands, bulletLevel, bulletMax } from "@jcsoftdev/ui-core/chart/bullet";
import { resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { type DefineOptions, defineElement } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type SnapshotSeries,
  svg,
  type TooltipRow,
  type VirtualMarks,
} from "../internal/chart-base.js";
import { CANVAS_HEIGHT, CANVAS_MARKS, colorResolver } from "../internal/e18-canvas.js";
import {
  AutoHeight,
  adoptPlot,
  axisBottom,
  axisFormatter,
  axisLeft,
  fadeIn,
  finite,
  fitLabel,
  flag,
  gridLines,
  grow,
  hitRect,
  jsonAttr,
  numAttr,
  text,
} from "../internal/e18-plot.js";

export interface BulletItem {
  id?: string;
  label: string;
  /** The measured value: the thin bar. */
  actual: number;
  /** The goal: a tick across the bar. */
  target?: number;
  /** Upper bounds of the qualitative ranges, ascending (e.g. `[60, 85, 100]`). */
  ranges?: readonly number[];
  /** Overrides the chart `value-format` for this row. */
  format?: ValueFormat;
}

const PAD = { top: 8, bottom: 8 };
const VALUE_STYLE =
  "fill:var(--ink-2);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums";

/** The item with only finite numbers: a bad `actual` is 0, a bad `target` or range bound is left out. */
const clean = (item: BulletItem): BulletItem => ({
  ...item,
  label: String(item.label ?? ""),
  actual: finite(item.actual),
  target: Number.isFinite(item.target) ? item.target : undefined,
  ranges: item.ranges?.filter((bound) => Number.isFinite(bound)),
});

const bandFill = (index: number, count: number) =>
  `color-mix(in srgb, var(--ink-3) ${Math.round(bandOpacity(index, count) * 100)}%, transparent)`;

/**
 * `<ui-bullet-chart>`: a bullet graph. One thin measured bar against a target tick, on
 * qualitative bands (poor, fair, good). Many rows compare KPIs in little space; each row has its
 * own 0-to-max scale unless `scale="shared"`. Rows run top to bottom, or columns left to right with
 * `orientation="vertical"`, and size themselves unless `height` or `aspect-ratio` is set. Hover,
 * arrow keys (Up/Down, or Left/Right when vertical) and a tap show the actual, the target and the
 * band reached; the legend (`<ui-chart-legend readonly>`) names bar, tick and bands.
 *
 * Attributes (React props in brackets): `actual-label`, `target-label` (`actualLabel`,
 * `targetLabel`), `range-labels` (JSON array, `rangeLabels`), `color`, `orientation`, `scale`
 * (`row`, `shared`), `row-height`, `value-labels="off"`, `category-label`, `items` (JSON), plus the
 * chart attributes (`label` is the React `title`, `description`, `height`, `aspect-ratio`,
 * `loading`, `locale`, `value-format` ...). Properties: `items`, `rangeLabels`.
 */
export class UiBulletChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "items",
    "actual-label",
    "target-label",
    "range-labels",
    "color",
    "orientation",
    "scale",
    "row-height",
    "value-labels",
    "category-label",
  ];
  #items: readonly BulletItem[] | undefined;
  #rangeLabels: readonly string[] | undefined;
  readonly #height = new AutoHeight(this);

  get items(): readonly BulletItem[] {
    return this.#items ?? jsonAttr<BulletItem[]>(this, "items") ?? [];
  }
  set items(value: readonly BulletItem[]) {
    this.#items = value;
    this.#fit();
    this.requestDraw();
  }
  get rangeLabels(): readonly string[] {
    return this.#rangeLabels ?? jsonAttr<string[]>(this, "range-labels") ?? [];
  }
  set rangeLabels(value: readonly string[]) {
    this.#rangeLabels = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    adoptPlot(this);
    this.#fit();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "items" || name === "orientation" || name === "row-height" || name === "scale")
      this.#fit();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.items.length === 0;
  }

  get #vertical(): boolean {
    return this.getAttribute("orientation") === "vertical";
  }
  get #shared(): boolean {
    return this.getAttribute("scale") === "shared";
  }
  get #rowHeight(): number {
    return numAttr(this, "row-height", 46) || 46;
  }

  /** Rows size themselves unless the author fixed the height or an aspect ratio. */
  #fit(): void {
    const rows = this.items.length;
    const natural = Math.max(
      100,
      rows * this.#rowHeight + PAD.top + (this.#shared ? 30 : PAD.bottom),
    );
    this.#height.apply(
      this.#vertical ? 300 : rows > CANVAS_MARKS ? Math.min(natural, CANVAS_HEIGHT) : natural,
    );
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, animate } = ctx;
    const items = this.items.map(clean);
    const count = items.length;
    // Above the threshold the marks are painted on the canvas layer.
    const big = count > CANVAS_MARKS;
    const vertical = this.#vertical;
    const shared = this.#shared;
    const rangeLabels = this.rangeLabels;
    const actualLabel = this.getAttribute("actual-label") ?? "Actual";
    const targetLabel = this.getAttribute("target-label") ?? "Target";
    const color = ctx.color(0, this.getAttribute("color") ?? undefined);
    const valueLabels = flag(this, "value-labels", true);
    const currency = this.getAttribute("currency") || undefined;

    const fmtOf = (item: BulletItem) =>
      item.format ? resolveFormat(item.format, { locale, currency }) : ctx.format;
    let bandCount = 0;
    let sharedMax = 0;
    for (const item of items) {
      bandCount = Math.max(bandCount, bulletBands(item.ranges).length);
      sharedMax = Math.max(sharedMax, bulletMax(item));
    }
    const maxOf = (item: BulletItem) => (shared ? sharedMax : bulletMax(item));

    // Plot box and the value-to-pixel map.
    const tickFormat = axisFormatter(this);
    let top: number;
    let left: number;
    let innerWidth: number;
    let innerHeight: number;
    let slot: number;
    let thick: number;
    let valueColumn = 0;
    let ticks: Array<{ key: number; position: number; label: string }> = [];
    let toPx: (item: BulletItem, value: number) => number;
    const fraction = (ratio: number) => Math.min(1, Math.max(0, finite(ratio)));
    if (vertical) {
      top = valueLabels ? 22 : PAD.top;
      innerHeight = Math.max(40, height - top - 28);
      if (shared) {
        const scale = linearScale({
          domain: [0, sharedMax],
          range: [innerHeight, 0],
          tickCount: Math.max(2, Math.round(innerHeight / 52)),
        });
        ticks = scale.ticks().map((tick) => ({
          key: tick,
          position: scale.map(tick),
          label: tickFormat(tick),
        }));
      }
      left = shared
        ? ticks.reduce((wide, tick) => Math.max(wide, estimateTextWidth(tick.label)), 16) + 14
        : 4;
      innerWidth = Math.max(40, width - left - 8);
      slot = innerWidth / Math.max(1, count);
      thick = Math.min(56, slot * 0.62);
      toPx = (item, value) => innerHeight - fraction(value / maxOf(item)) * innerHeight;
    } else {
      const wideLabels =
        items.reduce((wide, item) => Math.max(wide, estimateTextWidth(item.label, 12)), 40) + 14;
      left = Math.min(width * 0.34, wideLabels);
      if (valueLabels && width >= 380 && !big) {
        let widest = 40;
        for (const item of items) {
          const fmt = fmtOf(item);
          widest = Math.max(
            widest,
            estimateTextWidth(
              item.target == null ? fmt(item.actual) : `${fmt(item.actual)} / ${fmt(item.target)}`,
              11,
            ),
          );
        }
        valueColumn = Math.min(120, widest + 14);
      } else valueColumn = 8;
      top = PAD.top;
      innerWidth = Math.max(40, width - left - valueColumn);
      innerHeight = Math.max(40, height - PAD.top - (shared ? 30 : PAD.bottom));
      slot = innerHeight / Math.max(1, count);
      thick = Math.min(30, slot * 0.7);
      if (shared) {
        const scale = linearScale({
          domain: [0, sharedMax],
          range: [0, innerWidth],
          tickCount: Math.max(2, Math.round(innerWidth / 100)),
        });
        ticks = scale.ticks().map((tick) => ({
          key: tick,
          position: scale.map(tick),
          label: tickFormat(tick),
        }));
      }
      toPx = (item, value) => fraction(value / maxOf(item)) * innerWidth;
    }

    const plot = svg("g", { transform: `translate(${left},${top})` });
    root.append(plot);
    if (shared)
      plot.append(
        gridLines(ticks, vertical ? "horizontal" : "vertical", vertical ? innerWidth : innerHeight),
        vertical ? axisLeft(ticks, 0) : axisBottom(ticks, innerHeight),
      );
    // On the canvas layer a label shows only when a row is tall enough, for at most ~300 rows.
    const labelSkip = big ? Math.ceil(count / 300) : 1;
    const labelled: Array<{ key: number; position: number; label: string }> = [];
    if (!big || slot >= 14)
      for (let i = 0; i < count; i += labelSkip)
        labelled.push({
          key: i,
          position: i * slot + slot / 2,
          label: fitLabel(
            (items[i] as BulletItem).label,
            vertical ? slot * labelSkip - 4 : left - 14,
          ),
        });
    plot.append(vertical ? axisBottom(labelled, innerHeight) : axisLeft(labelled, 0));

    const rangeName = (item: BulletItem) => {
      const level = bulletLevel(item.actual, item.ranges);
      return level < 0 ? undefined : (rangeLabels[level] ?? `#${level + 1}`);
    };
    const describe = (item: BulletItem) => {
      const fmt = fmtOf(item);
      const level = rangeName(item);
      return `${item.label}: ${actualLabel} ${fmt(item.actual)}${
        item.target == null ? "" : `, ${targetLabel} ${fmt(item.target)}`
      }${level ? `, ${level}` : ""}`;
    };

    const canvasMarks = (): VirtualMarks => {
      const resolve = colorResolver(this.drawing);
      const g = ctx.canvas();
      g.save();
      g.translate(left, top);
      const bands: Path2D[] = Array.from({ length: bandCount }, () => new Path2D());
      const bars = new Path2D();
      const ticks = new Path2D();
      const barThick = Math.max(1, thick * 0.34);
      const bandThick = Math.max(1, thick);
      items.forEach((item, i) => {
        const centre = i * slot + slot / 2;
        for (const band of bulletBands(item.ranges)) {
          const a = toPx(item, band.from);
          const b = toPx(item, band.to);
          const path = bands[band.index] as Path2D;
          if (vertical)
            path.rect(centre - bandThick / 2, Math.min(a, b), bandThick, Math.abs(a - b));
          else path.rect(Math.min(a, b), centre - bandThick / 2, Math.abs(a - b), bandThick);
        }
        const actual = toPx(item, item.actual);
        if (vertical)
          bars.rect(centre - barThick / 2, actual, barThick, Math.max(1, innerHeight - actual));
        else bars.rect(0, centre - barThick / 2, Math.max(1, actual), barThick);
        if (item.target != null) {
          const target = toPx(item, item.target);
          const half = Math.max(1, thick * 0.36);
          if (vertical) {
            ticks.moveTo(centre - half, target);
            ticks.lineTo(centre + half, target);
          } else {
            ticks.moveTo(target, centre - half);
            ticks.lineTo(target, centre + half);
          }
        }
      });
      bands.forEach((path, index) => {
        g.fillStyle = resolve(bandFill(index, bandCount));
        g.fill(path);
      });
      g.fillStyle = resolve(color);
      g.fill(bars);
      g.strokeStyle = resolve("var(--ink)");
      g.lineWidth = Math.max(1, Math.min(3, thick * 0.3));
      g.stroke(ticks);
      g.restore();

      // One row-shaped band, moved to the mark that has focus or hover.
      const bandNode = svg("rect", { rx: 4, "data-band": "", style: "fill:var(--chart-grid)" });
      plot.prepend(svg("g", { "data-row": "", "aria-hidden": "true" }, bandNode));
      return {
        count,
        label: (i) => describe(items[i] as BulletItem),
        element: (i) => {
          const size = Math.max(2, slot);
          const start = i * slot - (size - slot) / 2;
          bandNode.setAttribute("x", String(vertical ? start : 0));
          bandNode.setAttribute("y", String(vertical ? 0 : start));
          bandNode.setAttribute("width", String(vertical ? size : innerWidth));
          bandNode.setAttribute("height", String(vertical ? innerHeight : size));
          return bandNode;
        },
      };
    };

    const marks: ChartMark[] | VirtualMarks = big
      ? canvasMarks()
      : items.map((item, i) => {
          const fmt = fmtOf(item);
          const centre = i * slot + slot / 2;
          const actualPx = toPx(item, item.actual);
          const targetPx = item.target == null ? null : toPx(item, item.target);
          const barThick = thick * 0.34;
          const group = svg("g", { "data-row": "" });
          plot.append(group);
          const cell = vertical
            ? { x: i * slot, y: -top, width: slot, height: innerHeight + top + 28 }
            : { x: -left, y: i * slot, width: width, height: slot };
          group.append(
            svg("rect", {
              ...(vertical
                ? { x: cell.x + 1, y: 0, width: slot - 2, height: innerHeight }
                : { x: 0, y: cell.y + 1, width: innerWidth, height: slot - 2 }),
              rx: 6,
              "data-band": "",
              style: "fill:var(--chart-grid)",
            }),
          );

          for (const band of bulletBands(item.ranges)) {
            const a = toPx(item, band.from);
            const b = toPx(item, band.to);
            group.append(
              svg("rect", {
                x: vertical ? centre - thick / 2 : Math.min(a, b),
                y: vertical ? Math.min(a, b) : centre - thick / 2,
                width: Math.max(0, vertical ? thick : Math.abs(a - b)),
                height: Math.max(0, vertical ? Math.abs(a - b) : thick),
                "aria-hidden": "true",
                style: `fill:${bandFill(band.index, bandCount)}`,
              }),
            );
          }
          const bar = svg("rect", {
            "data-bar": "",
            x: vertical ? centre - barThick / 2 : 0,
            y: vertical ? Math.min(actualPx, innerHeight - 1) : centre - barThick / 2,
            width: vertical ? barThick : Math.max(1, actualPx),
            height: vertical ? Math.max(1, innerHeight - actualPx) : barThick,
            rx: 2,
            "aria-hidden": "true",
            style: `fill:${color};transform-box:fill-box;transform-origin:${vertical ? "center bottom" : "left center"}`,
          });
          group.append(bar);
          if (animate)
            grow(bar, vertical ? "y" : "x", i, { duration: 620, step: Math.min(60, 420 / count) });

          const fade = (node: Element) => {
            if (animate) fadeIn(node, 360, 520);
            group.append(node);
          };
          if (targetPx != null)
            fade(
              svg("line", {
                x1: vertical ? centre - thick * 0.36 : targetPx,
                x2: vertical ? centre + thick * 0.36 : targetPx,
                y1: vertical ? targetPx : centre - thick * 0.36,
                y2: vertical ? targetPx : centre + thick * 0.36,
                "stroke-width": 3,
                "stroke-linecap": "round",
                "aria-hidden": "true",
                style: "stroke:var(--ink)",
              }),
            );
          if (valueLabels && vertical)
            fade(
              text(
                fmt(item.actual),
                { x: centre, y: -8, "text-anchor": "middle", "aria-hidden": "true" },
                VALUE_STYLE,
              ),
            );
          else if (!vertical && valueColumn > 20)
            fade(
              text(
                item.target == null
                  ? fmt(item.actual)
                  : `${fmt(item.actual)} / ${fmt(item.target)}`,
                { x: innerWidth + 10, y: centre, dy: "0.34em", "aria-hidden": "true" },
                VALUE_STYLE,
              ),
            );

          const el = hitRect(cell.x, cell.y, cell.width, cell.height);
          group.append(el);
          return { el, label: describe(item) };
        });

    const rows = (item: BulletItem): TooltipRow[] => {
      const fmt = fmtOf(item);
      const level = rangeName(item);
      const out: TooltipRow[] = [
        { id: "actual", name: actualLabel, value: fmt(item.actual), color, shape: "square" },
      ];
      if (item.target != null)
        out.push({
          id: "target",
          name: targetLabel,
          value: fmt(item.target),
          color: "var(--ink)",
          shape: "line",
        });
      if (level)
        out.push({
          id: "range",
          name: level,
          value: "",
          color: bandFill(bulletLevel(item.actual, item.ranges), bandCount),
          shape: "square",
          emphasis: true,
        });
      return out;
    };

    return {
      summary: `${count} ${count === 1 ? "row" : "rows"}: ${actualLabel}, ${targetLabel}`,
      marks,
      maxHoverRows: 3,
      hit: (x, y) => {
        if (!count) return -1;
        const px = x - left;
        const py = y - top;
        if (py < 0 || py > innerHeight) return -1;
        if (vertical && (px < 0 || px > innerWidth)) return -1;
        return Math.min(count - 1, Math.max(0, Math.floor((vertical ? px : py) / slot)));
      },
      hover: (index) => {
        const item = items[index];
        if (!item) return null;
        return {
          title: item.label,
          rows: rows(item),
          x: vertical ? left + index * slot + slot / 2 : left + toPx(item, item.actual),
          y: vertical ? top + toPx(item, item.actual) : top + index * slot + slot / 2,
        };
      },
      snapshot: () => {
        const columns: SnapshotSeries[] = [
          {
            id: "actual",
            name: actualLabel,
            color,
            shape: "square",
            values: items.map((item) => item.actual),
            text: items.map((item) => fmtOf(item)(item.actual)),
          },
          {
            id: "target",
            name: targetLabel,
            color: "var(--ink)",
            shape: "line",
            values: items.map((item) => item.target ?? null),
            text: items.map((item) => (item.target == null ? "" : fmtOf(item)(item.target))),
          },
        ];
        for (let index = 0; index < bandCount; index++) {
          const bound = (item: BulletItem) => bulletBands(item.ranges)[index]?.to;
          columns.push({
            id: `range-${index}`,
            name: rangeLabels[index] ?? `#${index + 1}`,
            color: bandFill(index, bandCount),
            shape: "square",
            values: items.map((item) => bound(item) ?? null),
            text: items.map((item) => {
              const to = bound(item);
              return to == null ? "" : fmtOf(item)(to);
            }),
          });
        }
        return {
          title: this.getAttribute("label") ?? "Bullet chart",
          categoryHeader: this.getAttribute("category-label") ?? "Category",
          categories: items.map((item) => item.label),
          series: columns,
        };
      },
    };
  }
}

/** Registers `<ui-bullet-chart>` (or `<prefix>-bullet-chart`) and returns the tag. */
export function defineBulletChart(options?: DefineOptions): string {
  return defineElement("bullet-chart", UiBulletChart, options);
}
