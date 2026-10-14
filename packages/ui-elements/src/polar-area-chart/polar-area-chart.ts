import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import { monochromeByValue } from "@jcsoftdev/ui-core/chart/palette";
import {
  angleOf,
  arcPath,
  degToRad,
  niceRadarMax,
  normalizeAngle,
  polarPoint,
  TAU,
} from "@jcsoftdev/ui-core/chart/polar";
import { type DefineOptions, defineElement } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import {
  adoptPolar,
  clamp,
  EASE,
  fadeIn,
  jsonAttr,
  numberAttr,
  paint,
  SideKeeper,
  text,
  truncate,
  valueFormatOf,
  warnDuplicates,
} from "../internal/e20-polar.js";
import slices from "../internal/e20-slices.css.js";

export interface PolarAreaDatum {
  id: string;
  name: string;
  value: number;
  color?: string;
  /** Overrides the chart `value-format` for this sector. */
  format?: ValueFormat;
}

const EXPLODE = 6;

/**
 * `<ui-polar-area-chart>`: a Nightingale rose. Equal-angle sectors whose radius, or area, follows
 * the value, with reference rings, rim names, hover and keyboard focus with a tooltip, and a legend
 * that toggles sectors by id. React `PolarAreaChart`. Marks are the sectors (arrows wrap, Home,
 * End); hit testing uses the resting geometry, which also covers the stepped-out area, so the
 * sector that steps out never moves off the pointer.
 *
 * Attributes: `data` (JSON `{ id, name, value, color? }[]`), `scale` (`radius`, `area`),
 * `inner-radius` (fraction of the outer radius, .1), `corner-radius` (4), `gap` (px, 3), `levels`
 * (reference rings, 4), `show-labels="off"`, `start-angle` (degrees from 12 o'clock),
 * `monochrome` (flag or a base color), `initial-hidden`, plus the chart attributes. Height
 * defaults to 340. Properties: `data`, `valueFormat`, `palette`.
 * Events: `chart-hover`, `chart-select`, `chart-series`.
 */
export class UiPolarAreaChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "scale",
    "inner-radius",
    "corner-radius",
    "gap",
    "levels",
    "show-labels",
    "start-angle",
    "monochrome",
  ];
  #data: readonly PolarAreaDatum[] | undefined;
  readonly #keeper = new SideKeeper();

  get data(): readonly PolarAreaDatum[] {
    return this.#data ?? jsonAttr<PolarAreaDatum[]>(this, "data", []);
  }
  set data(value: readonly PolarAreaDatum[]) {
    this.#data = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "polar-area-chart";
    adoptPolar(this, slices);
    // TODO(E20): default height 340 through the base natural-height hook (no host writes);
    // seed `initial-hidden` with the base hook once it lands.
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.data.every((datum) => !(datum.value > 0));
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const currency = this.getAttribute("currency") || undefined;
    const scale = this.getAttribute("scale") === "area" ? "area" : "radius";
    const innerRatio = numberAttr(this, "inner-radius", 0.1);
    const cornerRadius = numberAttr(this, "corner-radius", 4);
    const gap = numberAttr(this, "gap", 3);
    const levels = Math.max(1, Math.round(numberAttr(this, "levels", 4)));
    const showLabels = this.getAttribute("show-labels") !== "off";
    const startAngle = degToRad(numberAttr(this, "start-angle", 0));
    const mono = this.getAttribute("monochrome");
    const monochrome =
      mono === null || mono === "false" ? false : mono === "" || mono === "true" ? true : mono;
    const axisFormat = resolveAxisFormat(valueFormatOf(this), { locale, currency });

    const data = this.data.map((datum) =>
      Number.isFinite(datum.value) ? datum : { ...datum, value: 0 },
    );
    warnDuplicates(
      this,
      data.map((datum) => datum.id),
    );
    const shades = monochrome
      ? monochromeByValue(
          data.map((datum) => Math.max(0, datum.value || 0)),
          typeof monochrome === "string" ? monochrome : undefined,
        )
      : null;
    const items = data.map((datum, index) => ({
      datum,
      color:
        shades?.[index] && !datum.color ? (shades[index] as string) : ctx.color(index, datum.color),
      format: datum.format ? resolveFormat(datum.format, { locale, currency }) : ctx.format,
    }));
    const total = items.reduce((sum, item) => sum + Math.max(0, item.datum.value || 0), 0);
    const visible = items
      .map((_, index) => index)
      .filter((index) => {
        const item = items[index];
        return item && !this.isHidden(item.datum.id) && item.datum.value > 0;
      });

    const compact = width < 420;
    const rim = showLabels && !compact;
    let top = 0;
    for (const index of visible) top = Math.max(top, items[index]?.datum.value ?? 0);
    const ceiling = niceRadarMax(top, levels);
    let widest = 0;
    if (rim)
      for (const item of items)
        widest = Math.max(widest, estimateTextWidth(truncate(item.datum.name, 16)));
    const labelRoom = rim ? Math.min(130, widest + 14) : 0;
    const radius = Math.max(
      36,
      Math.min(width / 2 - labelRoom - EXPLODE - 4, height / 2 - EXPLODE - (rim ? 18 : 6)),
    );
    const inner = radius * clamp(innerRatio, 0, 0.5);
    const cx = width / 2;
    const cy = height / 2;
    const slot = TAU / Math.max(1, visible.length);
    const pad = gap / Math.max(1, radius * 0.7);
    const lengthAt = (value: number) => {
      const ratio = Math.min(1, value / ceiling);
      return inner + (radius - inner) * (scale === "area" ? Math.sqrt(ratio) : ratio);
    };

    const sectors = visible.map((index, position) => {
      const item = items[index] as (typeof items)[number];
      const outer = lengthAt(item.datum.value);
      return {
        index,
        mid: startAngle + slot * (position + 0.5),
        outer,
        item,
        position,
      };
    });

    const rings = Array.from({ length: levels }, (_, i) => {
      const ratio = (i + 1) / levels;
      return {
        r: inner + (radius - inner) * (scale === "area" ? Math.sqrt(ratio) : ratio),
        value: ceiling * ratio,
      };
    });
    const grid = svg("g", { fill: "none", "stroke-width": 1, "aria-hidden": "true" });
    for (const ring of rings)
      grid.append(
        svg("circle", {
          cx,
          cy,
          r: ring.r,
          "stroke-dasharray": ring.r === radius ? undefined : "2 4",
          style: "stroke:var(--chart-grid)",
        }),
      );
    root.append(grid);

    const group = svg("g", { "data-slices": "" });
    const sectorEls: SVGPathElement[] = [];
    for (const sector of sectors) {
      const shift = polarPoint(0, 0, EXPLODE, sector.mid);
      const path = svg("path", {
        "data-slice": "",
        "data-series": sector.item.datum.id,
        d: arcPath({
          cx,
          cy,
          innerRadius: inner,
          outerRadius: Math.max(sector.outer, inner + 1),
          startAngle: startAngle + slot * sector.position + pad / 2,
          endAngle: startAngle + slot * (sector.position + 1) - pad / 2,
          cornerRadius,
        }),
        style: `fill-opacity:.9;--ui-dx:${shift.x.toFixed(2)}px;--ui-dy:${shift.y.toFixed(2)}px;transform-origin:${cx}px ${cy}px`,
      });
      paint(path, "fill", sector.item.color);
      sectorEls.push(path);
      group.append(path);
    }
    root.append(group);

    const fades: SVGElement[] = [];
    const ringLabels = svg("g", { "aria-hidden": "true", "data-pointer-none": "" });
    for (const ring of rings)
      ringLabels.append(
        svg(
          "text",
          {
            x: cx + 4,
            y: cy - ring.r - 3,
            style:
              "fill:var(--ink-3);font-size:10px;font-variant-numeric:tabular-nums;paint-order:stroke;stroke:var(--surface);stroke-width:3",
          },
          axisFormat(ring.value),
        ),
      );
    root.append(ringLabels);
    fades.push(ringLabels);
    if (rim) {
      const names = svg("g", { "aria-hidden": "true", "data-pointer-none": "" });
      for (const sector of sectors) {
        const point = polarPoint(cx, cy, radius + EXPLODE + 8, sector.mid);
        const sin = Math.sin(sector.mid);
        const cos = Math.cos(sector.mid);
        names.append(
          svg(
            "text",
            {
              "data-series": sector.item.datum.id,
              x: point.x,
              y: point.y + (cos > 0.4 ? -2 : cos < -0.4 ? 10 : 4),
              "text-anchor": sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle",
              style: "fill:var(--ink-2);font-size:11px;font-weight:600",
            },
            truncate(sector.item.datum.name, 16),
          ),
        );
      }
      root.append(names);
      fades.push(names);
    }

    if (ctx.animate) {
      sectorEls.forEach(
        (node, i) =>
          void node.animate(
            [
              { opacity: 0, transform: "scale(.2)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 720, delay: i * 70, easing: EASE, fill: "backwards" },
          ),
      );
      for (const node of fades) fadeIn(node, 420, 380);
    }

    const share = (value: number) =>
      formatPercent(total > 0 ? Math.max(0, value) / total : 0, { decimals: 1, locale });
    const marks = sectors.map((sector, i) => ({
      el: sectorEls[i] as SVGPathElement,
      label: `${sector.item.datum.name}: ${sector.item.format(sector.item.datum.value)}, ${share(sector.item.datum.value)}`,
    }));
    const title = this.getAttribute("label") ?? "";
    return {
      summary: items.map((item) => `${item.datum.name} ${share(item.datum.value)}`).join(", "),
      marks,
      hit: (x, y, _target, pointerRadius) => {
        if (!sectors.length) return -1;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const rel = normalizeAngle(angleOf(0, 0, dx, dy) - startAngle);
        const position = Math.min(sectors.length - 1, Math.floor(rel / slot));
        const sector = sectors[position];
        if (!sector) return -1;
        const slack = pointerRadius > 12 ? 8 : 0;
        return r >= inner - slack && r <= Math.max(sector.outer, inner + 1) + EXPLODE + slack
          ? position
          : -1;
      },
      hover: (position) => {
        const sector = sectors[position];
        if (!sector) return null;
        const point = polarPoint(cx, cy, (inner + sector.outer) / 2, sector.mid);
        return {
          rows: [
            {
              id: sector.item.datum.id,
              name: sector.item.datum.name,
              value: sector.item.format(sector.item.datum.value),
              color: sector.item.color,
              shape: "dot",
              note: share(sector.item.datum.value),
            },
          ],
          x: point.x,
          y: point.y,
          side: this.#keeper.pick(point.x, width),
          category: sector.index,
        };
      },
      nav: (position, intent) => {
        const count = sectors.length;
        if (intent === "home") return 0;
        if (intent === "end") return count - 1;
        if (intent === "left" || intent === "up") return (position - 1 + count) % count;
        if (intent === "right" || intent === "down") return (position + 1) % count;
        return undefined;
      },
      maxHoverRows: 1,
      snapshot: () => ({
        title,
        categoryHeader: text(this, "category"),
        categories: items.map((item) => item.datum.name),
        series: [
          {
            id: "value",
            name: text(this, "value"),
            color: items[0]?.color ?? "",
            values: items.map((item) => item.datum.value),
            text: items.map((item) => item.format(item.datum.value)),
          },
          {
            id: "share",
            name: text(this, "share"),
            color: items[0]?.color ?? "",
            values: items.map((item) => (total > 0 ? Math.max(0, item.datum.value) / total : 0)),
            text: items.map((item) => share(item.datum.value)),
          },
        ],
        legend: items.map((item) => ({
          id: item.datum.id,
          name: item.datum.name,
          color: item.color,
          shape: "dot" as const,
        })),
      }),
    };
  }
}

/** Registers `<ui-polar-area-chart>` (or `<prefix>-polar-area-chart`) and returns the tag. */
export function definePolarAreaChart(options?: DefineOptions): string {
  return defineElement("polar-area-chart", UiPolarAreaChart, options);
}
