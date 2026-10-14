import { layoutGauge, showEndLabels } from "@jcsoftdev/ui-core/chart/gauge";
import { type ChartTone, TONE_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { angleOf, arcLine, degToRad, polarPoint, radToDeg } from "@jcsoftdev/ui-core/chart/polar";
import { type DefineOptions, defineElement, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import gaugeCss from "../internal/e20-gauge.css.js";
import {
  adoptPolar,
  clamp,
  EASE,
  fadeIn,
  jsonAttr,
  numberAttr,
  SideKeeper,
  signed,
  Tween,
  text,
} from "../internal/e20-polar.js";

export interface GaugeRange {
  from: number;
  to: number;
  /** Name in the tooltip and data table, e.g. "Optimal". */
  label?: string;
  /** Status color family; ignored when `color` is set. */
  tone?: ChartTone;
  /** Any CSS color. */
  color?: string;
}

export interface GaugeCenterContext {
  /** Latest value. */
  value: number;
  /** Value being displayed while it animates. */
  shown: number;
  /** Formatted `shown`. */
  text: string;
  /** Color of the band the value is in. */
  color: string;
  /** Name of the band the value is in, if it has one. */
  band?: string;
  /** Caption passed as `caption`. */
  caption?: string;
}

const rangeColor = (range: GaugeRange): string =>
  range.color ?? TONE_COLORS[range.tone ?? "accent"].ink;
const off = (host: Element, name: string) =>
  host.getAttribute(name) === "off" || host.getAttribute(name) === "false";
const CUSTOM_HEIGHT = 72;

/**
 * `<ui-gauge-chart>`: a semi or three-quarter arc with colored range bands, a filled progress arc
 * or a needle, min and max under the ends, optional ticks and a value that counts up. React
 * `GaugeChart`.
 *
 * ARIA: a `group` named by `label` and described by the value and its band; with `ranges`, each
 * band is a named image (one tab stop, arrows, Home, End) whose details show the range; without,
 * one image shows the value.
 *
 * Attributes: `value`, `min` (0), `max` (100), `variant` (`semi` default, `three-quarter`), `mode`
 * (`progress` default, `needle`), `ranges` (JSON `{ from, to, label?, tone?, color? }[]`),
 * `thickness` (px, 18), `rounded-caps="off"`, `ticks` (divisions, 0 = none), `tick-marks`,
 * `minor-ticks` (4), `min-max-labels="off"`, `caption` (under the value), plus the chart
 * attributes (`label`, `height`, `aspect-ratio`, `locale`, `value-format`, `currency`,
 * `animate`...). The height defaults to 230 (`semi`) or 290.
 * Properties: `value`, `ranges`, `centerContent(context)` (returns a Node, or text, shown in place
 * of the value; sized to the arc), `labels` (`value`).
 * Events: `chart-hover`, `chart-select`, `chart-data`.
 */
export class UiGaugeChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "value",
    "min",
    "max",
    "variant",
    "mode",
    "ranges",
    "thickness",
    "rounded-caps",
    "ticks",
    "tick-marks",
    "minor-ticks",
    "min-max-labels",
    "caption",
  ];
  #value: number | undefined;
  #ranges: readonly GaugeRange[] | undefined;
  #tween = new Tween();
  readonly #keeper = new SideKeeper();
  readonly #uid = uid("gauge");
  /** Replaces the value and caption in the middle with your own content. */
  centerContent: ((context: GaugeCenterContext) => Node | string) | undefined;

  get value(): number {
    return this.#value ?? numberAttr(this, "value", Number.NaN);
  }
  set value(next: number) {
    this.#value = next;
    this.requestDraw();
  }
  get ranges(): readonly GaugeRange[] {
    return this.#ranges ?? jsonAttr<GaugeRange[]>(this, "ranges", []);
  }
  set ranges(next: readonly GaugeRange[]) {
    this.#ranges = next;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "gauge-chart";
    adoptPolar(this, gaugeCss);
    // TODO(E20): default height 230 (290 for three-quarter) through the base natural-height hook.
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.#tween.stop();
    super.disconnectedCallback();
  }

  protected override isEmpty(): boolean {
    return (
      !Number.isFinite(this.value) || !(numberAttr(this, "max", 100) > numberAttr(this, "min", 0))
    );
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, format } = ctx;
    const value = this.value;
    const min = numberAttr(this, "min", 0);
    const max = numberAttr(this, "max", 100);
    const variant = this.getAttribute("variant") === "three-quarter" ? "three-quarter" : "semi";
    const mode = this.getAttribute("mode") === "needle" ? "needle" : "progress";
    const bands = this.ranges;
    const thickness = numberAttr(this, "thickness", 18);
    const roundedCaps = !off(this, "rounded-caps");
    const ticks = Math.max(0, numberAttr(this, "ticks", 0));
    const tickMarks = this.hasAttribute("tick-marks") && !off(this, "tick-marks");
    const minorTicks = Math.max(0, Math.round(numberAttr(this, "minor-ticks", 4)));
    const caption = this.getAttribute("caption") ?? undefined;
    const title = this.getAttribute("label") ?? text(this, "value");
    const center = this.centerContent;

    if (!ctx.transient)
      this.#tween.to(
        new Map([["v", value]]),
        ctx.motion && ctx.phase !== "resize",
        () => this.requestDraw("transient"),
        {
          duration: 900,
          from: min,
        },
      );
    const shown = this.#tween.get("v", value);

    const half = variant === "semi" ? 90 : 135;
    const a0 = degToRad(-half);
    const a1 = degToRad(half);
    const span = a1 - a0;
    const endLabels = showEndLabels(!off(this, "min-max-labels"), ticks);
    const valueChars = Math.max(format(min).length, format(max).length, format(value).length);
    const layout = layoutGauge({
      width,
      height,
      variant,
      mode,
      thickness,
      endLabels,
      customCenter: Boolean(center),
      caption: Boolean(caption),
      bandLabel: bands.length > 0,
      valueChars,
    });
    const { radius, band, cx, cy, mid, valueSize } = layout;
    const angleFor = (v: number) => a0 + span * clamp((v - min) / (max - min), 0, 1);
    const capAngle = roundedCaps ? band / 2 / mid : 0;
    const fraction = clamp((shown - min) / (max - min), 0, 1);
    // Colour and label follow the target value, so they do not flip band by band while the arc
    // or the needle sweeps towards it.
    const active = bands.find((item) => value >= item.from && value <= item.to);
    const valueColor = active ? rangeColor(active) : "var(--accent-word)";
    const progressEnd = a0 + capAngle + (span - 2 * capAngle) * fraction;
    const needle = mode === "needle";
    const rangeText = (item: GaugeRange) => `${format(item.from)} – ${format(item.to)}`;
    const bandName = (item: GaugeRange) => item.label ?? rangeText(item);

    const track = svg("path", {
      d: arcLine(cx, cy, mid, a0 + capAngle, a1 - capAngle),
      fill: "none",
      "stroke-width": band,
      "stroke-linecap": roundedCaps ? "round" : "butt",
      style: "stroke:var(--chart-grid)",
    });
    const maskId = `${this.#uid}-track`;
    if (roundedCaps && bands.length > 0)
      root.append(
        svg(
          "defs",
          {},
          svg(
            "mask",
            { id: maskId, maskUnits: "userSpaceOnUse", x: 0, y: 0, width, height },
            svg("path", {
              d: arcLine(cx, cy, mid, a0 + capAngle, a1 - capAngle),
              fill: "none",
              stroke: "white",
              "stroke-width": band,
              "stroke-linecap": "round",
            }),
          ),
        ),
      );
    if (bands.length === 0 || !needle) root.append(track);

    // In progress mode the bands behind the arc would show as a patchwork of tints next to it, so
    // they stay invisible and only appear while explored (`[data-active]`).
    const bandEls = bands.map((item) => {
      const from = angleFor(Math.min(item.from, item.to)) + 0.006;
      const to = angleFor(Math.max(item.from, item.to)) - 0.006;
      return svg("path", {
        "data-band": "",
        "data-quiet": needle ? undefined : "",
        d: arcLine(cx, cy, mid, from, Math.max(from + 0.002, to)),
        fill: "none",
        "stroke-width": band,
        "stroke-linecap": "butt",
        style: `stroke:${rangeColor(item)}`,
      });
    });
    if (bandEls.length) {
      const group = svg("g", {
        "data-bands": "",
        mask: roundedCaps ? `url(#${maskId})` : undefined,
      });
      group.append(...bandEls);
      root.append(group);
    }

    if (!needle && fraction > 0)
      root.append(
        svg("path", {
          d: arcLine(cx, cy, mid, a0 + capAngle, Math.max(progressEnd, a0 + capAngle + 1e-3)),
          fill: "none",
          "stroke-width": band,
          "stroke-linecap": roundedCaps ? "round" : "butt",
          "data-pointer-none": "",
          style: `stroke:${valueColor}`,
        }),
      );

    const fades: SVGElement[] = [];
    if (tickMarks) {
      const divisions = Math.max(1, ticks);
      const steps = divisions * (minorTicks + 1);
      const inner = radius - band - 3;
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const major = i % (minorTicks + 1) === 0;
        const angle = angleFor(min + ((max - min) * i) / steps);
        const a = polarPoint(cx, cy, inner, angle);
        const b = polarPoint(cx, cy, inner - (major ? 8 : 4), angle);
        d += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
      }
      root.append(
        svg("path", {
          d,
          fill: "none",
          "stroke-width": 1.4,
          "stroke-linecap": "round",
          "aria-hidden": "true",
          style: "stroke:var(--ink-3);stroke-opacity:.7",
        }),
      );
    }
    for (let i = 0; ticks >= 1 && i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks;
      const point = polarPoint(cx, cy, radius - band - (tickMarks ? 20 : 12), angleFor(v));
      const label = svg(
        "text",
        {
          x: point.x,
          y: point.y,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "aria-hidden": "true",
          style:
            "fill:var(--ink-3);font-size:10px;font-weight:500;font-variant-numeric:tabular-nums",
        },
        format(v),
      );
      root.append(label);
      fades.push(label);
    }

    if (needle) {
      const hub = svg(
        "g",
        {
          "data-pointer-none": "",
          style: `transform:rotate(${Math.round(radToDeg(angleFor(shown)) * 100) / 100}deg);transform-origin:${cx}px ${cy}px`,
        },
        svg("path", {
          d: `M${cx - 4} ${cy} L${cx} ${cy - layout.needleLength} L${cx + 4} ${cy} Z`,
          style: "fill:var(--ink)",
        }),
        svg("circle", { cx, cy, r: 8, style: "fill:var(--ink)" }),
        svg("circle", { cx, cy, r: 3, style: "fill:var(--surface)" }),
      );
      root.append(hub);
    }

    if (endLabels) {
      const ends = svg("g", { "aria-hidden": "true", "data-pointer-none": "" });
      for (const [angle, v] of [
        [a0, min],
        [a1, max],
      ] as const) {
        const point = polarPoint(cx, cy, mid, angle);
        ends.append(
          svg(
            "text",
            {
              x: point.x,
              y: point.y + band / 2 + 15,
              "text-anchor": "middle",
              style:
                "fill:var(--ink-3);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums",
            },
            format(v),
          ),
        );
      }
      root.append(ends);
    }

    if (center) {
      const area = layout.customWidth;
      const y =
        layout.customAnchor === "above"
          ? cy + layout.customDy - CUSTOM_HEIGHT
          : layout.customAnchor === "middle"
            ? cy - CUSTOM_HEIGHT / 2
            : cy + layout.customDy;
      const box = document.createElement("div");
      box.style.cssText =
        "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;pointer-events:none";
      const content = center({
        value,
        shown,
        text: format(shown),
        color: valueColor,
        band: active?.label,
        caption,
      });
      box.append(content);
      const holder = svg("foreignObject", {
        x: cx - area / 2,
        y,
        width: area,
        height: CUSTOM_HEIGHT,
        "data-pointer-none": "",
      });
      holder.append(box);
      root.append(holder);
      fades.push(holder);
    } else {
      const group = svg("g", {
        "aria-hidden": "true",
        "text-anchor": "middle",
        "data-pointer-none": "",
      });
      group.append(
        svg(
          "text",
          {
            x: cx,
            y: cy + layout.valueDy,
            style: `fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;font-size:${valueSize}px`,
          },
          format(shown),
        ),
      );
      if (caption)
        group.append(
          svg(
            "text",
            {
              x: cx,
              y: cy + layout.captionDy,
              style: "fill:var(--ink-3);font-weight:600;font-size:12px",
            },
            caption,
          ),
        );
      if (active?.label && bands.length > 0)
        group.append(
          svg(
            "text",
            {
              x: cx,
              y: cy + layout.labelDy,
              style: `fill:${valueColor};font-weight:700;font-size:11px`,
            },
            active.label,
          ),
        );
      root.append(group);
      fades.push(group);
    }

    if (ctx.animate) {
      bandEls.forEach(
        (el, i) =>
          void el.animate([{ opacity: 0 }, { opacity: getComputedStyle(el).opacity }], {
            duration: 500,
            delay: i * 90,
            easing: EASE,
            fill: "backwards",
          }),
      );
      for (const node of fades) fadeIn(node, 420, 200);
    }

    const valueLabel = `${caption ?? title}: ${format(value)}${active?.label ? `, ${active.label}` : ""}`;
    const marks = bands.length
      ? bandEls.map((el, index) => ({
          el,
          label: `${bandName(bands[index] as GaugeRange)}${bands[index]?.label ? ` ${rangeText(bands[index] as GaugeRange)}` : ""}`,
        }))
      : [{ el: track, label: valueLabel }];
    const anchorOf = (index: number) =>
      bands.length
        ? polarPoint(
            cx,
            cy,
            mid,
            angleFor(((bands[index] as GaugeRange).from + (bands[index] as GaugeRange).to) / 2),
          )
        : polarPoint(cx, cy, mid, needle ? angleFor(value) : progressEnd);

    return {
      summary: valueLabel,
      marks,
      hit: (x, y, _target, pointerRadius) => {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const reach = band / 2 + (pointerRadius > 12 ? 12 : 2);
        if (Math.abs(r - mid) > reach) return -1;
        const angle = signed(angleOf(0, 0, dx, dy));
        const slack = (reach / mid) * 0.5;
        if (angle < a0 - slack || angle > a1 + slack) return -1;
        if (!bands.length) return 0;
        const v = min + ((clamp(angle, a0, a1) - a0) / span) * (max - min);
        return bands.findIndex(
          (item) => v >= Math.min(item.from, item.to) && v <= Math.max(item.from, item.to),
        );
      },
      hover: (index) => {
        const item = bands[index];
        const point = anchorOf(index);
        const common = { x: point.x, y: point.y, side: this.#keeper.pick(point.x, width) };
        if (bands.length && item)
          return {
            ...common,
            rows: [
              {
                id: `${index}`,
                name: bandName(item),
                value: rangeText(item),
                color: rangeColor(item),
                shape: "square" as const,
                note: value >= item.from && value <= item.to ? text(this, "value") : undefined,
              },
            ],
          };
        return {
          ...common,
          rows: [
            {
              id: "value",
              name: caption ?? title,
              value: format(value),
              color: valueColor,
              shape: "dot" as const,
            },
          ],
        };
      },
      maxHoverRows: 1,
      snapshot: () => ({
        title,
        categoryHeader: text(this, "category"),
        categories: [text(this, "value"), ...bands.map(bandName)],
        series: [
          {
            id: "value",
            name: text(this, "value"),
            color: valueColor,
            values: [value, ...bands.map(rangeText)],
            text: [format(value), ...bands.map(rangeText)],
          },
        ],
      }),
    };
  }
}

/** Registers `<ui-gauge-chart>` (or `<prefix>-gauge-chart`) and returns the tag. */
export function defineGaugeChart(options?: DefineOptions): string {
  return defineElement("gauge-chart", UiGaugeChart, options);
}
