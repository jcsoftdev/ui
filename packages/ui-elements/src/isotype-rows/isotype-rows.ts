import { unitRuns } from "@jcsoftdev/ui-core/chart/units";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import { type DrawContext, type DrawResult, svg } from "../internal/chart-base.js";
import {
  UNIT_ATTRIBUTES,
  type UnitCategory,
  UnitChartElement,
} from "../internal/e22-unit-chart.js";
import {
  fitText,
  flag,
  glyph,
  navigate,
  paint,
  popUnits,
  setUnitKey,
  textWidth,
} from "../internal/e22-units.js";
import { resolveUnitShape, type UnitIcon } from "../internal/unit-shapes.js";

const LABEL_GAP = 12;
const FONT = 12;

const number = (value: string | null, fallback: number): number => {
  const parsed = value === null || value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * `<ui-isotype-rows>`: classic isotype rows. A name, then the same icon repeated in proportion to
 * the value, then the value. Every row shares one icon size, so lengths are comparable; icons
 * shrink together when the container is narrow. Each row is one mark; hovering anywhere along its
 * band keeps it highlighted until the pointer reaches another row or leaves the chart, and the
 * arrows walk the rows (up and down are the rows above and below).
 *
 * Attributes: `per-icon` (1), `icon` (a built-in name such as `scissors`, or a 24 x 24 SVG path),
 * `color-mode` (`single`: one color for every row; `category`: a palette color per row), `color`
 * (the color in `single` mode), `track` (pads every row with empty icons up to the longest one),
 * `row-height` (34; the chart height follows the number of rows, or set `height="fill"` to spread
 * the rows over the parent), `gap` (fraction of the icon, 0.18), `show-values="off"` (hides the value
 * at the end of each row), `unit-label`, `show-key`, `data` (JSON), plus the chart attributes
 * (`label`, `value-format`, `locale` ...). Properties: `data`, an array of `{ id, name, value,
 * color?, icon? }`, and `icon`.
 */
export class UiIsotypeRows extends UnitChartElement {
  static override observedAttributes = [
    ...UNIT_ATTRIBUTES,
    "per-icon",
    "icon",
    "color-mode",
    "color",
    "track",
    "row-height",
    "gap",
    "show-values",
    "show-key",
  ];
  protected readonly kind = "isotype-rows";
  readonly #clips = uid("isotype");
  #icon: UnitIcon | undefined;
  readonly #redraw = () => this.requestDraw();

  get icon(): UnitIcon {
    return this.#icon ?? this.getAttribute("icon") ?? "scissors";
  }
  set icon(value: UnitIcon) {
    this.#icon = value;
    this.requestDraw();
  }

  override get data(): readonly UnitCategory[] {
    return super.data;
  }
  override set data(value: readonly UnitCategory[]) {
    super.data = value;
    this.#syncHeight();
  }

  get #rowHeight(): number {
    return Math.max(1, number(this.getAttribute("row-height"), 34));
  }

  /** The chart is as tall as its rows, unless `height="fill"` hands the height to the parent. */
  #syncHeight(): void {
    if (this.getAttribute("height") === "fill") return;
    const next = `${Math.max(1, this.data.length) * this.#rowHeight}`;
    if (this.getAttribute("height") !== next) this.setAttribute("height", next);
  }

  override connectedCallback(): void {
    this.#syncHeight();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "data" || name === "row-height") this.#syncHeight();
    super.attributeChangedCallback(name);
  }

  protected draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, color, animate } = ctx;
    const data = this.data;
    const format = this.unitFormat(ctx);
    const perIcon = number(this.getAttribute("per-icon"), 1);
    const icon = this.icon;
    const gap = Math.max(0, number(this.getAttribute("gap"), 0.18));
    const track = flag(this.getAttribute("track"));
    const showValues = flag(this.getAttribute("show-values"), true);
    const unitLabel = this.unitLabel;
    const rowHeight =
      this.getAttribute("height") === "fill"
        ? Math.max(16, height / Math.max(1, data.length))
        : this.#rowHeight;
    const byCategory = this.getAttribute("color-mode") === "category";
    const single = this.getAttribute("color");
    const colors = data.map((item, index) =>
      paint(
        byCategory ? color(index, item.color) : (item.color ?? single ?? color(0)),
        color(index),
      ),
    );

    const runs = unitRuns(
      data.map((item) => item.value),
      perIcon,
    );
    const longest = Math.max(1, ...runs.map((run) => run.length));
    const longestName = Math.max(0, ...data.map((item) => textWidth(item.name, FONT)));
    const labelWidth = Math.min(Math.ceil(longestName) + 4, Math.max(64, width * 0.3));
    const valueWidth = showValues
      ? Math.ceil(Math.max(0, ...data.map((item) => textWidth(format(item.value), FONT)))) + 10
      : 0;
    const area = Math.max(10, width - labelWidth - LABEL_GAP - valueWidth);
    const size = Math.max(4, Math.min(rowHeight * 0.72, area / (longest + (longest - 1) * gap)));
    const pitch = size * (1 + gap);
    const left = labelWidth + LABEL_GAP;
    const trackEnd = left + (longest - 1) * pitch + size;

    const anchors: Array<{ x: number; y: number }> = [];
    const marks = data.map((item, index) => {
      const shape = resolveUnitShape(item.icon ?? icon, this.#redraw);
      const run = runs[index] ?? [];
      const top = index * rowHeight + (rowHeight - size) / 2;
      const center = index * rowHeight + rowHeight / 2;
      const end = left + (run.length ? (run.length - 1) * pitch + size : 0);
      const group = svg("g", { "data-cat": index, "data-series": item.id });
      group.append(
        svg("rect", {
          x: 0,
          y: index * rowHeight,
          width,
          height: rowHeight,
          style: "fill:transparent;pointer-events:none",
        }),
        svg(
          "text",
          {
            x: 0,
            y: center,
            "dominant-baseline": "central",
            "data-unit-label": "",
            "aria-hidden": "true",
          },
          fitText(item.name, labelWidth, FONT),
          ...(fitText(item.name, labelWidth, FONT) === item.name
            ? []
            : [svg("title", {}, item.name)]),
        ),
      );
      const slots = track ? longest : run.length;
      for (let unit = 0; unit < slots; unit += 1) {
        const fill = run[unit] ?? 0;
        group.append(
          glyph(
            shape,
            left + unit * pitch,
            top,
            size,
            fill,
            colors[index] as string,
            `${this.#clips}-${index}-${unit}`,
            {
              track: track || fill > 0,
            },
          ),
        );
      }
      if (showValues)
        group.append(
          svg(
            "text",
            {
              x: (track ? trackEnd : end) + 8,
              y: center,
              "dominant-baseline": "central",
              "data-unit-value": "",
              "aria-hidden": "true",
            },
            format(item.value),
          ),
        );
      root.append(group);
      anchors.push({ x: end, y: center });
      return { el: group, label: `${item.name}: ${format(item.value)} ${unitLabel}` };
    });
    if (animate) popUnits(root);

    const keyed = flag(this.getAttribute("show-key"), perIcon !== 1);
    setUnitKey(
      this,
      keyed
        ? {
            shape: resolveUnitShape(icon, this.#redraw),
            text: `= ${this.key(ctx, perIcon)} ${unitLabel}`,
          }
        : null,
    );

    return {
      summary: data.map((item) => `${item.name} ${format(item.value)}`).join(", "),
      marks,
      maxHoverRows: 1,
      hit: (_x, y) => {
        const row = Math.floor(y / rowHeight);
        return row >= 0 && row < data.length ? row : -1;
      },
      hover: (index) => {
        const item = data[index];
        const anchor = anchors[index];
        if (!item || !anchor) return null;
        return {
          title: item.name,
          rows: [
            {
              id: item.id,
              name: unitLabel,
              value: format(item.value),
              color: colors[index] as string,
            },
          ],
          x: anchor.x,
          y: anchor.y,
        };
      },
      nav: (index, intent) => navigate(anchors, index, intent),
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
        ],
      }),
    };
  }

  override disconnectedCallback(): void {
    setUnitKey(this, null);
    super.disconnectedCallback();
  }
}

/** Registers `<ui-isotype-rows>` (or `<prefix>-isotype-rows`) and returns the tag. */
export function defineIsotypeRows(options?: DefineOptions): string {
  return defineElement("isotype-rows", UiIsotypeRows, options);
}
