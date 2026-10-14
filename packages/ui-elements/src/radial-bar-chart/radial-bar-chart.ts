import { formatPercent, resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import {
  angleOf,
  arcLine,
  degToRad,
  normalizeAngle,
  polarPoint,
} from "@jcsoftdev/ui-core/chart/polar";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
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
  flagOrText,
  jsonAttr,
  listAttr,
  numberAttr,
  SideKeeper,
  seedHidden,
  text,
  truncate,
} from "../internal/e20-polar.js";

export interface RadialBarDatum {
  id: string;
  name: string;
  value: number;
  /** Value that fills the ring. Defaults to the chart `max`. */
  max?: number;
  color?: string;
  /** Overrides the chart `value-format` for this ring. */
  format?: ValueFormat;
}

interface Item {
  datum: RadialBarDatum;
  color: string;
  format: (value: number) => string;
  fraction: number;
}

interface View {
  items: readonly Item[];
  holeRadius: number;
  cx: number;
  cy: number;
  centerValue: string | undefined;
  centerLabel: string | undefined;
  parts: { value: SVGTextElement; caption: SVGTextElement } | undefined;
}

const off = (host: Element, name: string) =>
  host.getAttribute(name) === "off" || host.getAttribute(name) === "false";

/**
 * `<ui-radial-bar-chart>`: concentric progress rings, one per entry, each with a track, rounded
 * caps, an optional gradient, a label at its start and a centre readout that follows the hovered,
 * focused or legend-highlighted ring. React `RadialBarChart`. The marks are the rings (arrows wrap,
 * Home, End); the pointer picks the nearest ring, so the gaps between rings belong to a ring too.
 *
 * Attributes: `data` (JSON `{ id, name, value, max?, color? }[]`, rings from the outside in), `max`
 * (value of a full ring, 100), `start-angle` (0) and `end-angle` (270), in degrees from 12 o'clock,
 * `thickness` (px; derived by default), `gap` (px, 6), `track="off"`, `rounded-caps="off"`,
 * `gradient="off"`, `ring-labels` (flag or `off`; automatic by default), `center-value`,
 * `center-label` (shown while nothing is hovered), `initial-hidden`, plus the chart attributes.
 * Height defaults to 320. Properties: `data`, `valueFormat`, `palette`.
 * Events: `chart-hover`, `chart-select`, `chart-series`.
 */
export class UiRadialBarChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "max",
    "start-angle",
    "end-angle",
    "thickness",
    "gap",
    "track",
    "rounded-caps",
    "gradient",
    "ring-labels",
    "center-value",
    "center-label",
  ];
  #data: readonly RadialBarDatum[] | undefined;
  #view: View | undefined;
  #lit: string | null = null;
  #seeded = false;
  readonly #keeper = new SideKeeper();
  readonly #uid = uid("radial");

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, () => this.#paintCenter());
    this.addEventListener(CHART_EVENT.series, (event) => {
      const detail = (event as CustomEvent<{ highlight?: string | null }>).detail;
      if (detail && "highlight" in detail) {
        this.#lit = detail.highlight ?? null;
        this.#paintCenter();
      }
    });
  }

  get data(): readonly RadialBarDatum[] {
    return this.#data ?? jsonAttr<RadialBarDatum[]>(this, "data", []);
  }
  set data(value: readonly RadialBarDatum[]) {
    this.#data = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "radial-bar-chart";
    adoptPolar(this);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", "320");
    super.connectedCallback();
    if (!this.#seeded) {
      this.#seeded = true;
      seedHidden(this, listAttr(this, "initial-hidden"));
    }
  }

  protected override teardown(): void {
    this.#view = undefined;
  }

  protected override isEmpty(): boolean {
    return this.data.length === 0;
  }

  #paintCenter(): void {
    const view = this.#view;
    const parts = view?.parts;
    if (!view || !parts) return;
    const info = this.hover;
    const lit = this.#lit ? view.items.findIndex((item) => item.datum.id === this.#lit) : -1;
    const focus = info ? info.category : lit >= 0 ? lit : null;
    const item = focus != null ? view.items[focus] : undefined;
    const main = item ? item.format(item.datum.value) : view.centerValue;
    const caption = item ? item.datum.name : view.centerLabel;
    const valueSize = Math.round(Math.min(30, Math.max(14, view.holeRadius * 0.5)));
    const captionSize = view.holeRadius > 46 ? 12 : 10.5;
    const block = valueSize + (caption ? 6 + captionSize : 0);
    parts.value.textContent = truncate(
      main ?? "",
      Math.max(4, Math.floor((view.holeRadius * 1.7) / (valueSize * 0.58))),
    );
    parts.value.setAttribute("y", `${view.cy - block / 2 + valueSize * 0.82}`);
    parts.value.style.fontSize = `${valueSize}px`;
    parts.caption.textContent = caption
      ? truncate(caption, Math.max(4, Math.floor((view.holeRadius * 1.6) / (captionSize * 0.58))))
      : "";
    parts.caption.setAttribute("y", `${view.cy - block / 2 + valueSize + 6 + captionSize * 0.82}`);
    parts.caption.style.fontSize = `${captionSize}px`;
    parts.value.parentElement?.toggleAttribute("hidden", main == null);
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const max = numberAttr(this, "max", 100);
    const startAngle = numberAttr(this, "start-angle", 0);
    const endAngle = numberAttr(this, "end-angle", 270);
    const gap = numberAttr(this, "gap", 6);
    const track = !off(this, "track");
    const roundedCaps = !off(this, "rounded-caps");
    const gradient = !off(this, "gradient");
    const ringLabels = off(this, "ring-labels")
      ? false
      : flagOrText(this, "ring-labels")
        ? true
        : undefined;
    const currency = this.getAttribute("currency") || undefined;
    const items: Item[] = this.data.map((datum, index) => {
      const full = datum.max ?? max;
      const fraction = full > 0 ? clamp(datum.value / full, 0, 1) : 0;
      return {
        datum,
        color: ctx.color(index, datum.color),
        format: datum.format ? resolveFormat(datum.format, { locale, currency }) : ctx.format,
        fraction: Number.isFinite(fraction) ? fraction : 0,
      };
    });
    const visible = items
      .map((_, index) => index)
      .filter((index) => !this.isHidden(items[index]?.datum.id ?? ""));
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.max(30, Math.min(width, height) / 2 - 4);
    const count = Math.max(1, visible.length);
    const hole = outer * 0.26;
    const thickness = this.hasAttribute("thickness") ? numberAttr(this, "thickness", 0) : undefined;
    const band = thickness || Math.max(8, Math.min(28, (outer - hole - gap * (count - 1)) / count));
    const a0 = degToRad(startAngle);
    const span = degToRad(endAngle) - a0;
    const showLabels =
      (ringLabels ?? true) &&
      width >= 360 &&
      (ringLabels === true || (Math.abs(endAngle - startAngle) <= 280 && startAngle === 0));

    const rings = visible.map((index, position) => {
      const radius = outer - band / 2 - position * (band + gap);
      const cap = roundedCaps ? band / 2 / Math.max(radius, 1) : 0;
      const from = a0 + cap;
      const room = span - 2 * cap;
      const fraction = items[index]?.fraction ?? 0;
      const to = fraction > 0 ? from + Math.max(room * fraction, 1e-3) : from;
      return {
        index,
        radius,
        trackPath: arcLine(cx, cy, radius, from, a0 + span - cap),
        valuePath: fraction > 0 ? arcLine(cx, cy, radius, from, to) : "",
      };
    });

    if (gradient) {
      const defs = svg("defs");
      for (const ring of rings) {
        const color = items[ring.index]?.color ?? "var(--accent-word)";
        defs.append(
          svg(
            "linearGradient",
            {
              id: `${this.#uid}-g${ring.index}`,
              gradientUnits: "userSpaceOnUse",
              x1: cx + outer,
              y1: cy - outer,
              x2: cx - outer,
              y2: cy + outer,
            },
            svg("stop", {
              offset: 0,
              style: `stop-color:color-mix(in oklab, ${color}, white 42%)`,
            }),
            svg("stop", { offset: 1, style: `stop-color:${color}` }),
          ),
        );
      }
      root.append(defs);
    }

    const cap = roundedCaps ? "round" : "butt";
    const group = svg("g", { "data-rings": "" });
    const hitEls = new Map<number, SVGPathElement>();
    const valueEls: SVGPathElement[] = [];
    for (const ring of rings) {
      const item = items[ring.index];
      if (!item) continue;
      const one = svg("g", { "data-ring-group": "", "data-series": item.datum.id });
      if (track && ring.trackPath)
        one.append(
          svg("path", {
            d: ring.trackPath,
            fill: "none",
            "stroke-width": band,
            "stroke-linecap": cap,
            style: "stroke:var(--chart-grid)",
          }),
        );
      if (ring.valuePath) {
        const value = svg("path", {
          "data-ring": "",
          d: ring.valuePath,
          pathLength: 1,
          fill: "none",
          "stroke-width": band,
          "stroke-linecap": cap,
          style: `stroke:${gradient ? `url(#${this.#uid}-g${ring.index})` : item.color}`,
        });
        valueEls.push(value);
        one.append(value);
      }
      const hit = svg("path", {
        d: ring.trackPath,
        fill: "none",
        stroke: "transparent",
        "stroke-width": band + 4,
        "stroke-linecap": "butt",
      });
      hitEls.set(ring.index, hit);
      one.append(hit);
      group.append(one);
    }
    root.append(group);

    const fades: SVGElement[] = [];
    if (showLabels) {
      const labels = svg("g", { "aria-hidden": "true", "data-pointer-none": "" });
      for (const ring of rings) {
        const item = items[ring.index];
        if (!item) continue;
        const valueText = item.format(item.datum.value);
        const maxChars = Math.max(4, Math.floor((cx - 14) / 6.4) - valueText.length);
        labels.append(
          svg(
            "text",
            {
              "data-series": item.datum.id,
              x: cx - 8,
              y: cy - ring.radius,
              "text-anchor": "end",
              "dominant-baseline": "central",
              style: "font-size:11px",
            },
            svg(
              "tspan",
              { style: "fill:var(--ink-2);font-weight:500" },
              `${truncate(item.datum.name, maxChars)} `,
            ),
            svg(
              "tspan",
              { style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums" },
              valueText,
            ),
          ),
        );
      }
      root.append(labels);
      fades.push(labels);
    }

    const holeRadius = outer - count * band - (count - 1) * gap;
    let parts: View["parts"];
    const centerValue = this.getAttribute("center-value") ?? undefined;
    if (holeRadius > 22) {
      const center = svg("g", {
        "aria-hidden": "true",
        "data-pointer-none": "",
        "text-anchor": "middle",
      });
      parts = {
        value: svg("text", {
          x: cx,
          style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums",
        }),
        caption: svg("text", { x: cx, style: "fill:var(--ink-3);font-weight:600" }),
      };
      center.append(parts.value, parts.caption);
      root.append(center);
      fades.push(center);
    }
    this.#view = {
      items,
      holeRadius,
      cx,
      cy,
      centerValue,
      centerLabel: this.getAttribute("center-label") ?? undefined,
      parts,
    };
    this.#paintCenter();

    if (ctx.animate) {
      valueEls.forEach(
        (node, i) =>
          void node.animate(
            [
              { strokeDasharray: "0 1", opacity: 0.2 },
              { strokeDasharray: "1 1", opacity: 1 },
            ],
            { duration: 1000, delay: i * 110, easing: EASE, fill: "backwards" },
          ),
      );
      for (const node of fades) fadeIn(node, 400, 500);
    }

    const share = (fraction: number) => formatPercent(fraction, { decimals: 0, locale });
    const marks = rings.map((ring) => {
      const item = items[ring.index] as Item;
      return {
        el: hitEls.get(ring.index) as SVGPathElement,
        label: `${item.datum.name}: ${item.format(item.datum.value)}, ${share(item.fraction)}`,
      };
    });
    const title = this.getAttribute("label") ?? "";
    return {
      summary: items.map((item) => `${item.datum.name} ${share(item.fraction)}`).join(", "),
      marks,
      hit: (x, y, _target, pointerRadius) => {
        if (!rings.length) return -1;
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        // The nearest ring wins, so the gap between two rings belongs to one of them.
        let best = -1;
        let distance = Number.POSITIVE_INFINITY;
        rings.forEach((ring, position) => {
          const d = Math.abs(r - ring.radius);
          if (d < distance) {
            distance = d;
            best = position;
          }
        });
        if (distance > band / 2 + gap / 2 + (pointerRadius > 12 ? 8 : 0)) return -1;
        const ringAt = rings[best] as (typeof rings)[number];
        const tolerance = (band / 2 / Math.max(ringAt.radius, 1)) * (roundedCaps ? 1 : 0.5);
        const rel = normalizeAngle(angleOf(0, 0, dx, dy) - a0);
        const sweep = Math.abs(span);
        const inside =
          span >= 0 ? rel <= sweep + tolerance || rel >= 2 * Math.PI - tolerance : false;
        return inside || sweep >= 2 * Math.PI - 1e-3 ? best : -1;
      },
      hover: (position) => {
        const ring = rings[position];
        const item = ring ? items[ring.index] : undefined;
        if (!ring || !item) return null;
        const point = polarPoint(cx, cy, ring.radius, a0 + span * item.fraction * 0.5);
        return {
          rows: [
            {
              id: item.datum.id,
              name: item.datum.name,
              value: item.format(item.datum.value),
              color: item.color,
              shape: "dot",
              note: share(item.fraction),
            },
          ],
          x: point.x,
          y: point.y,
          side: this.#keeper.pick(point.x, width),
          category: ring.index,
        };
      },
      nav: (position, intent) => {
        const total = rings.length;
        if (intent === "home") return 0;
        if (intent === "end") return total - 1;
        if (intent === "left" || intent === "up") return (position - 1 + total) % total;
        if (intent === "right" || intent === "down") return (position + 1) % total;
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
            values: items.map((item) => item.fraction),
            text: items.map((item) => share(item.fraction)),
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

/** Registers `<ui-radial-bar-chart>` (or `<prefix>-radial-bar-chart`) and returns the tag. */
export function defineRadialBarChart(options?: DefineOptions): string {
  return defineElement("radial-bar-chart", UiRadialBarChart, options);
}
