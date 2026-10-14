import { formatPercent, resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import { clamp, EASE, jsonAttr, numberAttr, text, truncate } from "../internal/e20-polar.js";
import type * as Shapes from "../internal/e20-unit-shapes.js";
import type { ResolvedUnitShape, UnitIcon } from "../internal/e20-unit-shapes.js";

/** The default silhouette ships with the chart; the others load on demand. */
const DROPLET: ResolvedUnitShape = {
  path: "M12 1.8c3.9 4.8 7.5 9 7.5 13a7.5 7.5 0 0 1-15 0c0-4 3.6-8.2 7.5-13z",
  width: 24,
  height: 24,
  fillRule: "nonzero",
  fill: "up",
  labelY: 12,
};

export interface FillGaugeItem {
  id: string;
  name: string;
  value: number;
  /** Value of a full shape; the chart `max` by default. */
  max?: number;
  color?: string;
  /** Shape of this gauge; the chart `shape` by default. */
  shape?: UnitIcon;
}

const NAME_SPACE = 24;

/**
 * Liquid surface from one wavelength before the shape to one after it, so sliding it left by one
 * wavelength loops without a seam.
 */
function wavePath(width: number, height: number, top: number, amplitude: number): string {
  const wavelength = width / 2;
  const half = wavelength / 2;
  const halves = Math.ceil((width + 2 * wavelength) / half);
  let d = `M${-wavelength} ${top}`;
  for (let i = 0; i < halves; i += 1) {
    const x0 = -wavelength + i * half;
    const crest = i % 2 === 0 ? top - amplitude : top + amplitude;
    d += `Q${x0 + half / 2} ${crest} ${x0 + half} ${top}`;
  }
  return `${d}V${height + 2}H${-wavelength}Z`;
}

/**
 * `<ui-fill-gauge-chart>`: silhouettes filled to a level (stock left in a bottle, a battery of
 * capacity, a droplet of water). Several gauges sit side by side and wrap to new rows in narrow
 * containers. The value inside switches color where the liquid crosses it, so it reads on both.
 * React `FillGaugeChart`. It is a picture with a data table for screen readers (`label` names it);
 * it has no pointer or keyboard details.
 *
 * Attributes: `data` (JSON `{ id, name, value, max?, color?, shape? }[]`), `shape` (`droplet` by
 * default; `battery`, `bottle`, `person`, `target`, `shield`, `star`, `heart`, `tree`, `house`,
 * `car`, `scissors`, `comb`... or an SVG path of a 24 x 24 box), `max` (value of a full shape, 1),
 * `level` (`wave` default, `flat`), `min-item-width` (px, 104), plus the chart attributes. With
 * `value-format` the label inside the shape is the formatted value; otherwise it is the fill
 * share. Height defaults to 200. Properties: `data`, `valueFormat`.
 */
export class UiFillGaugeChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "shape",
    "max",
    "level",
    "min-item-width",
  ];
  #data: readonly FillGaugeItem[] | undefined;
  /** Fill ratios of the last draw, so a new value rises from where the liquid was. */
  #ratios = new Map<string, number>();
  readonly #uid = uid("fill");

  get data(): readonly FillGaugeItem[] {
    return this.#data ?? jsonAttr<FillGaugeItem[]>(this, "data", []);
  }
  set data(value: readonly FillGaugeItem[]) {
    this.#data = value;
    this.#load();
    this.requestDraw();
  }

  #shapes: typeof Shapes | undefined;
  #loading: Promise<void> | undefined;

  #wanted(): boolean {
    const named = this.getAttribute("shape");
    return (!!named && named !== "droplet") || this.data.some((item) => item.shape !== undefined);
  }
  #load(): Promise<void> | undefined {
    if (this.#shapes || !this.#wanted()) return undefined;
    this.#loading ??= import("../internal/e20-unit-shapes.js").then((module) => {
      this.#shapes = module;
      if (this.isConnected) this.requestDraw();
    });
    return this.#loading;
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (this.isConnected) this.#load();
  }

  override connectedCallback(): void {
    this.dataset.ui = "fill-gauge-chart";
    // TODO(E20): default height 200 once the base has a natural-height hook (no host writes).
    const pending = this.#load();
    if (pending) void pending.then(() => this.isConnected && super.connectedCallback());
    else super.connectedCallback();
  }

  #shape(icon: UnitIcon): ResolvedUnitShape {
    return icon === "droplet" ? DROPLET : (this.#shapes?.resolveUnitShape(icon) ?? DROPLET);
  }

  protected override isEmpty(): boolean {
    return this.data.length === 0;
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const data = this.data;
    const shapeName = (this.getAttribute("shape") || "droplet") as UnitIcon;
    const max = numberAttr(this, "max", 1);
    const wave = this.getAttribute("level") !== "flat";
    const minItemWidth = Math.max(40, numberAttr(this, "min-item-width", 104));
    const explicit = this.valueFormat !== undefined || this.hasAttribute("value-format");
    const raw = ctx.format;
    const currency = this.getAttribute("currency") || undefined;
    const rawOf = (item: FillGaugeItem, value: number) =>
      (item as { format?: ValueFormat }).format
        ? resolveFormat((item as { format?: ValueFormat }).format, { locale, currency })(value)
        : raw(value);
    const ratioOf = (item: FillGaugeItem) => {
      const full = item.max ?? max;
      if (!(full > 0) || !Number.isFinite(item.value)) return 0;
      return clamp(item.value / full, 0, 1);
    };
    const labelOf = (item: FillGaugeItem) =>
      explicit ? rawOf(item, item.value) : formatPercent(ratioOf(item), { decimals: 0, locale });

    const columns = Math.max(1, Math.min(data.length, Math.floor(width / minItemWidth)));
    const rows = Math.ceil(data.length / columns);
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const size = Math.max(16, Math.min(cellWidth * 0.8, cellHeight - NAME_SPACE - 6));
    const blockTop = (row: number) => row * cellHeight + (cellHeight - NAME_SPACE - size) / 2;
    const rise = ctx.motion && ctx.phase === "update";
    const next = new Map<string, number>();

    data.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const ratio = ratioOf(item);
      next.set(item.id, ratio);
      const shape = this.#shape(item.shape ?? shapeName);
      const x = column * cellWidth + (cellWidth - size) / 2;
      const y = blockTop(row);
      const id = `${this.#uid}-${index}`;
      const color = ctx.color(index, item.color);
      const sideways = shape.fill === "right";
      const waving = wave && !sideways && ratio > 0 && ratio < 1;
      const scale = size / Math.max(shape.width, shape.height);
      const dx = x + (size - shape.width * scale) / 2;
      const dy = y + (size - shape.height * scale) / 2;
      const top = shape.height * (1 - ratio);
      const amplitude = shape.height * 0.025;
      const fontSize = Math.max(12, Math.min(28, size * 0.2)) / scale;
      const label = labelOf(item);
      const rule = { "fill-rule": shape.fillRule };

      const liquid = svg("g", {
        "data-liquid": "",
        style: `transform-box:fill-box;transform-origin:${sideways ? "left center" : "center bottom"}`,
      });
      let surface: SVGElement;
      if (waving) {
        surface = svg("path", {
          "data-wave": "",
          d: wavePath(shape.width, shape.height, top, amplitude),
          style: `fill:${color}`,
        });
      } else {
        surface = svg("rect", {
          x: 0,
          y: sideways ? 0 : top,
          width: sideways ? shape.width * ratio : shape.width,
          height: sideways ? shape.height : shape.height - top,
          style: `fill:${color}`,
        });
      }
      liquid.append(surface);

      const group = svg(
        "g",
        { transform: `translate(${dx} ${dy}) scale(${scale})`, "aria-hidden": "true" },
        svg(
          "defs",
          {},
          svg("clipPath", { id: `${id}-shape` }, svg("path", { d: shape.path, ...rule })),
          svg(
            "clipPath",
            { id: `${id}-level` },
            sideways
              ? svg("rect", { x: 0, y: 0, width: shape.width * ratio, height: shape.height })
              : svg("rect", { x: 0, y: top, width: shape.width, height: shape.height - top }),
          ),
        ),
        svg("path", { d: shape.path, ...rule, style: "fill:var(--track)" }),
        svg("g", { "clip-path": `url(#${id}-shape)` }, liquid),
      );
      if (shape.detail)
        group.append(
          svg("path", {
            d: shape.detail,
            "vector-effect": "non-scaling-stroke",
            "stroke-width": 1.5,
            style: "fill:none;stroke:var(--surface);stroke-opacity:.7",
          }),
        );
      group.append(
        svg("path", {
          d: shape.path,
          ...rule,
          "vector-effect": "non-scaling-stroke",
          "stroke-width": 1.25,
          style: "fill:none;stroke:var(--line-strong)",
        }),
        svg(
          "text",
          {
            x: shape.width / 2,
            y: shape.labelY,
            "dominant-baseline": "central",
            "text-anchor": "middle",
            style: `fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;font-size:${fontSize}px`,
          },
          label,
        ),
        svg(
          "text",
          {
            x: shape.width / 2,
            y: shape.labelY,
            "dominant-baseline": "central",
            "text-anchor": "middle",
            "clip-path": `url(#${id}-level)`,
            style: `fill:var(--surface);font-weight:700;font-variant-numeric:tabular-nums;font-size:${fontSize}px`,
          },
          label,
        ),
      );
      root.append(
        group,
        svg(
          "text",
          {
            x: column * cellWidth + cellWidth / 2,
            y: blockTop(row) + size + 2 + NAME_SPACE / 2,
            "text-anchor": "middle",
            "dominant-baseline": "central",
            "aria-hidden": "true",
            style: "fill:var(--ink-2);font-size:12px;font-weight:600",
          },
          truncate(item.name, Math.max(3, Math.floor((cellWidth - 8) / (12 * 0.58)))),
        ),
      );

      if (
        ctx.animate ||
        (rise && this.#ratios.has(item.id) && this.#ratios.get(item.id) !== ratio)
      ) {
        const before = ctx.animate ? 0 : (this.#ratios.get(item.id) ?? 0);
        const from = sideways
          ? `scaleX(${ratio > 0 ? before / ratio : 0})`
          : `translateY(${shape.height * (ratio - before)}px)`;
        liquid.animate([{ transform: from }, { transform: "none" }], {
          duration: 1100,
          easing: EASE,
          fill: "backwards",
        });
      }
      if (waving && ctx.motion)
        surface.animate(
          [{ transform: "translateX(0)" }, { transform: `translateX(${-shape.width / 2}px)` }],
          { duration: 1800, iterations: Number.POSITIVE_INFINITY, easing: "linear" },
        );
    });
    this.#ratios = next;

    const title = this.getAttribute("label") ?? "";
    return {
      summary: data.map((item) => `${item.name} ${labelOf(item)}`).join(", "),
      snapshot: () => ({
        title,
        categoryHeader: text(this, "category"),
        categories: data.map((item) => item.name),
        series: [
          {
            id: "value",
            name: title || text(this, "value"),
            color: "",
            values: data.map((item) => item.value),
            text: data.map((item) => rawOf(item, item.value)),
          },
          {
            id: "max",
            name: text(this, "max"),
            color: "",
            values: data.map((item) => item.max ?? max),
            text: data.map((item) => rawOf(item, item.max ?? max)),
          },
          {
            id: "share",
            name: text(this, "share"),
            color: "",
            values: data.map(ratioOf),
            text: data.map((item) => formatPercent(ratioOf(item), { locale })),
          },
        ],
      }),
    };
  }
}

/** Registers `<ui-fill-gauge-chart>` (or `<prefix>-fill-gauge-chart`) and returns the tag. */
export function defineFillGaugeChart(options?: DefineOptions): string {
  return defineElement("fill-gauge-chart", UiFillGaugeChart, options);
}
