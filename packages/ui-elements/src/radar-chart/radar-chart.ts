import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import {
  angleOf,
  arcPath,
  degToRad,
  niceRadarMax,
  polarPoint,
  slotAt,
  TAU,
} from "@jcsoftdev/ui-core/chart/polar";
import { type DefineOptions, defineElement } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  svg,
} from "../internal/chart-base.js";
import {
  adoptPolar,
  EASE,
  fadeIn,
  jsonAttr,
  numberAttr,
  paint,
  round2,
  SideKeeper,
  text,
  truncate,
  valueFormatOf,
  warnDuplicates,
} from "../internal/e20-polar.js";
import radarCss from "../internal/e20-radar.css.js";

export interface RadarSeries {
  /** Stable identity, used for the legend and for hiding the series. */
  id: string;
  name: string;
  /** One value per axis; `null` counts as the minimum. */
  data: ReadonlyArray<number | null>;
  color?: string;
  /** Overrides the chart `value-format` for this series. */
  format?: ValueFormat;
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
const off = (host: Element, name: string) =>
  host.getAttribute(name) === "off" || host.getAttribute(name) === "false";

/**
 * `<ui-radar-chart>`: several series over shared spokes, a polygon or circular grid, translucent
 * areas, markers, and a tooltip that lists every series for the hovered or focused axis. React
 * `RadarChart`. The marks are the axes: one tab stop, arrows (wrapping), Home and End move between
 * them; the pointer picks the spoke whose wedge it is in, so there is no gap between spokes.
 *
 * Attributes: `axes` (JSON array of names, at least 3), `series` (JSON `{ id, name, data, color? }[]`),
 * `max` (value at the outer ring, rounded up from the data by default), `min` (0), `levels` (grid
 * rings, 4), `grid-shape` (`polygon`, `circle`), `fill="off"`, `fill-opacity` (.18), `markers="off"`,
 * `show-values="off"` (ring values along the first spoke), `start-angle` (degrees from 12 o'clock),
 * `initial-hidden` (series ids), plus the chart attributes. Height defaults to 340.
 * Properties: `axes`, `series` (a series may carry its own `format`), `valueFormat`, `palette`.
 * Events: `chart-hover`, `chart-select` (`{ index, category }`: the pinned axis), `chart-series`.
 */
export class UiRadarChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "axes",
    "series",
    "max",
    "min",
    "levels",
    "grid-shape",
    "fill",
    "fill-opacity",
    "markers",
    "show-values",
    "start-angle",
  ];
  #axes: readonly string[] | undefined;
  #series: readonly RadarSeries[] | undefined;
  readonly #keeper = new SideKeeper();

  constructor() {
    super();
    const sync = () => this.#paint();
    this.addEventListener(CHART_EVENT.hover, sync);
  }

  get axes(): readonly string[] {
    return this.#axes ?? jsonAttr<string[]>(this, "axes", []);
  }
  set axes(value: readonly string[]) {
    this.#axes = value;
    this.requestDraw();
  }
  get series(): readonly RadarSeries[] {
    return this.#series ?? jsonAttr<RadarSeries[]>(this, "series", []);
  }
  set series(value: readonly RadarSeries[]) {
    this.#series = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "radar-chart";
    adoptPolar(this, radarCss);
    // TODO(E20): default height 340 through the base natural-height hook (no host writes);
    // seed `initial-hidden` with the base hook once it lands.
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return (
      this.axes.length < 3 ||
      this.series.every((item) => item.data.every((value) => !finite(value)))
    );
  }

  /** Marks the axis in the details (the spoke, its label and its markers). */
  #paint(): void {
    const index = (this.hover as HoverInfo | null)?.index ?? -1;
    for (const node of this.querySelectorAll<SVGElement>("[data-axis]"))
      node.toggleAttribute("data-on", Number(node.dataset.axis) === index);
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const axes = this.axes;
    const count = axes.length;
    const levels = Math.max(1, Math.round(numberAttr(this, "levels", 4)));
    const gridShape = this.getAttribute("grid-shape") === "circle" ? "circle" : "polygon";
    const fill = !off(this, "fill");
    const fillOpacity = numberAttr(this, "fill-opacity", 0.18);
    const markers = !off(this, "markers");
    const showValues = !off(this, "show-values");
    const startAngle = degToRad(numberAttr(this, "start-angle", 0));
    const min = numberAttr(this, "min", 0);
    const currency = this.getAttribute("currency") || undefined;
    const axisFormat = resolveAxisFormat(valueFormatOf(this), { locale, currency });
    warnDuplicates(
      this,
      this.series.map((item) => item.id),
    );
    const items = this.series.map((item, index) => ({
      ...item,
      color: ctx.color(index, item.color),
      fmt: item.format ? resolveFormat(item.format, { locale, currency }) : ctx.format,
    }));
    const visible = items.filter((item) => !this.isHidden(item.id));
    const compact = width < 420;
    const fontSize = compact ? 10 : 11;
    const maxChars = compact ? 10 : 18;
    const shownAxes = axes.map((axis) => truncate(axis, maxChars));

    let top = 0;
    for (const item of visible)
      for (const value of item.data) if (finite(value) && value > top) top = value;
    const max = this.hasAttribute("max")
      ? numberAttr(this, "max", 1)
      : niceRadarMax(top - Math.min(0, min), levels) + Math.min(0, min);
    let labelWidth = 0;
    for (const axis of shownAxes)
      labelWidth = Math.max(labelWidth, estimateTextWidth(axis, fontSize));
    const radius = Math.max(
      36,
      Math.min(width / 2 - Math.min(labelWidth, width * 0.24) - 16, height / 2 - 26),
    );
    const cx = width / 2;
    const cy = height / 2;
    const scale = (value: number) =>
      (radius * (Math.min(max, Math.max(min, finite(value) ? value : min)) - min)) /
      (max - min || 1);
    const angleAt = (i: number) => startAngle + (TAU * i) / count;
    const pt = (r: number, angle: number) => {
      const p = polarPoint(cx, cy, r, angle);
      return `${round2(p.x)} ${round2(p.y)}`;
    };

    // Grid ----------------------------------------------------------------------------------
    const grid = svg("g", { fill: "none", "stroke-width": 1, "aria-hidden": "true" });
    const rings = Array.from({ length: levels }, (_, level) => {
      const r = (radius * (level + 1)) / levels;
      const d =
        gridShape === "circle"
          ? `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
          : `${Array.from({ length: count }, (_, i) => `${i === 0 ? "M" : "L"}${pt(r, angleAt(i))}`).join("")}Z`;
      grid.append(svg("path", { d, style: "stroke:var(--chart-grid)" }));
      return { r, value: min + ((max - min) * (level + 1)) / levels };
    });
    for (let i = 0; i < count; i++) {
      const end = polarPoint(cx, cy, radius, angleAt(i));
      grid.append(
        svg("line", { "data-axis": i, "data-spoke": "", x1: cx, y1: cy, x2: end.x, y2: end.y }),
      );
    }
    root.append(grid);
    const fades: SVGElement[] = [];
    if (showValues) {
      const values = svg("g", { "aria-hidden": "true" });
      for (const ring of rings)
        values.append(
          svg(
            "text",
            {
              x: cx + 4,
              y: cy - ring.r - 2,
              style: "fill:var(--ink-3);font-size:9.5px;font-variant-numeric:tabular-nums",
            },
            axisFormat(ring.value),
          ),
        );
      root.append(values);
      fades.push(values);
    }

    // Series --------------------------------------------------------------------------------
    const shapes: SVGElement[] = [];
    const activeIndex = ctx.hover;
    for (const item of items) {
      if (this.isHidden(item.id)) continue;
      const points = axes.map((_, i) => polarPoint(cx, cy, scale(item.data[i] ?? min), angleAt(i)));
      const group = svg("g", {
        "data-shape": "",
        "data-series": item.id,
        "aria-hidden": "true",
        "data-pointer-none": "",
        style: `transform-origin:${cx}px ${cy}px`,
      });
      group.append(
        paint(
          paint(
            svg("path", {
              d: `${points.map((p, i) => `${i === 0 ? "M" : "L"}${round2(p.x)} ${round2(p.y)}`).join("")}Z`,
              "stroke-width": 2,
              "stroke-linejoin": "round",
              style: `fill-opacity:${fillOpacity}`,
            }),
            "stroke",
            item.color,
          ),
          "fill",
          fill ? item.color : "none",
        ),
      );
      if (markers)
        points.forEach(
          (p, i) =>
            void group.append(
              paint(
                svg("circle", {
                  "data-marker": "",
                  "data-axis": i,
                  "data-on": activeIndex === i ? "" : undefined,
                  cx: p.x,
                  cy: p.y,
                  r: 3.5,
                  "stroke-width": 2,
                  style: "stroke:var(--surface)",
                }),
                "fill",
                item.color,
              ),
            ),
        );
      shapes.push(group);
      root.append(group);
    }

    // Axis labels and the focusable wedges ---------------------------------------------------
    const labels = svg("g", { "aria-hidden": "true" });
    axes.forEach((_, i) => {
      const angle = angleAt(i);
      const point = polarPoint(cx, cy, radius + 12, angle);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      labels.append(
        svg(
          "text",
          {
            "data-axis": i,
            "data-axis-label": "",
            "data-on": activeIndex === i ? "" : undefined,
            x: point.x,
            y: point.y + (cos > 0.3 ? -2 : cos < -0.3 ? 10 : 4),
            "text-anchor": sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle",
            style: `fill:var(--ink-2);font-weight:600;font-size:${fontSize}px`,
          },
          shownAxes[i] ?? "",
        ),
      );
    });
    root.append(labels);
    fades.push(labels);
    const slot = TAU / count;
    const wedges = axes.map((_, i) =>
      svg("path", {
        "data-wedge": "",
        d: arcPath({
          cx,
          cy,
          innerRadius: 0,
          outerRadius: radius + 36,
          startAngle: angleAt(i) - slot / 2,
          endAngle: angleAt(i) + slot / 2,
        }),
        fill: "transparent",
      }),
    );
    root.append(...wedges);

    if (ctx.animate) {
      shapes.forEach(
        (shape, i) =>
          void shape.animate(
            [
              { opacity: 0, transform: "scale(.15)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 800, delay: i * 120, easing: EASE, fill: "backwards" },
          ),
      );
      for (const node of fades) fadeIn(node, 420, 300);
    }

    const valueAt = (item: (typeof items)[number], i: number) => {
      const value = item.data[i];
      return finite(value) ? item.fmt(value) : "–";
    };
    const title = this.getAttribute("label") ?? "";
    return {
      summary: axes
        .map(
          (axis, i) =>
            `${axis}: ${visible.map((item) => `${item.name} ${valueAt(item, i)}`).join(", ")}`,
        )
        .join("; "),
      marks: wedges.map((el, i) => ({
        el,
        label: `${axes[i] ?? ""}: ${visible.map((item) => `${item.name} ${valueAt(item, i)}`).join(", ")}`,
      })),
      hit: (x, y) =>
        Math.hypot(x - cx, y - cy) > radius + 36
          ? -1
          : slotAt(angleOf(cx, cy, x, y), count, startAngle),
      hover: (i) => {
        const point = polarPoint(cx, cy, radius * 0.6, angleAt(i));
        return {
          title: axes[i],
          rows: visible.map((item) => ({
            id: item.id,
            name: item.name,
            value: valueAt(item, i),
            color: item.color,
            shape: "square" as const,
          })),
          x: point.x,
          y: point.y,
          side: this.#keeper.pick(point.x, width),
        };
      },
      nav: (i, intent) => {
        if (intent === "home") return 0;
        if (intent === "end") return count - 1;
        if (intent === "left" || intent === "up") return (i - 1 + count) % count;
        if (intent === "right" || intent === "down") return (i + 1) % count;
        return undefined;
      },
      maxHoverRows: items.length,
      snapshot: () => ({
        title,
        categoryHeader: text(this, "category"),
        categories: axes,
        series: items.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
          shape: "square" as const,
          values: axes.map((_, i) => (finite(item.data[i]) ? (item.data[i] as number) : null)),
          text: axes.map((_, i) => {
            const value = item.data[i];
            return finite(value) ? item.fmt(value) : "";
          }),
        })),
      }),
    };
  }
}

/** Registers `<ui-radar-chart>` (or `<prefix>-radar-chart`) and returns the tag. */
export function defineRadarChart(options?: DefineOptions): string {
  return defineElement("radar-chart", UiRadarChart, options);
}
