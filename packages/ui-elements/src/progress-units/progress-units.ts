import { formatNumber, type ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import { type ChartTone, TONE_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { progressFractions, roundToStep } from "@jcsoftdev/ui-core/chart/units";
import { adoptStyles, type DefineOptions, defineElement, rootOf, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import css from "../internal/e22-units.css.js";
import { flag, glyph, paint, popUnits, textWidth } from "../internal/e22-units.js";
import {
  type ResolvedUnitShape,
  resolveUnitShape,
  type UnitIcon,
} from "../internal/unit-shapes.js";

const number = (value: string | null, fallback: number): number => {
  const parsed = value === null || value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function segmentShape(width: number, height: number): ResolvedUnitShape {
  const r = height / 2;
  return {
    path: `M${r} 0H${width - r}A${r} ${r} 0 0 1 ${width - r} ${height}H${r}A${r} ${r} 0 0 1 ${r} 0Z`,
    width,
    height,
    fillRule: "nonzero",
    fill: "right",
    labelY: height / 2,
  };
}

/**
 * `<ui-progress-units>`: segmented progress. A rating of 4.5 out of 5 stars with a half star, the
 * steps of a booking, the cells of a battery. Partial units are clipped exactly and the row shrinks
 * to fit narrow containers. It is one image named by `label` and described by its value ("4.5 /
 * 5"); there is nothing to hover.
 *
 * Attributes: `value`, `max` (5, the value of a full row), `count` (5, units drawn), `step`
 * (rounds the value before drawing, 0.5 for half stars), `variant` (`icons`, `segments`), `icon`
 * (a built-in name such as `star`, or a 24 x 24 SVG path), `color` (a CSS color), `tone`
 * (`neutral`, `accent`, `danger`, `warning`, `success`; `color` wins), `size` (24, the unit side and
 * the height in pixels), `gap` (fraction of the unit, 0.18), `show-value="off"` (hides "4.5 / 5"), plus
 * the chart attributes (`label`, `value-format`, `locale` ...). Properties: `icon`.
 */
export class UiProgressUnits extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "value",
    "max",
    "count",
    "step",
    "variant",
    "icon",
    "color",
    "tone",
    "size",
    "gap",
    "show-value",
  ];
  readonly #clips = uid("progress");
  #icon: UnitIcon | undefined;

  get icon(): UnitIcon {
    return this.#icon ?? this.getAttribute("icon") ?? "star";
  }
  set icon(value: UnitIcon) {
    this.#icon = value;
    this.requestDraw();
  }

  get #size(): number {
    return Math.max(1, number(this.getAttribute("size"), 24));
  }

  #syncHeight(): void {
    if (this.getAttribute("height") === "fill") return;
    const next = `${this.#size}`;
    if (this.getAttribute("height") !== next) this.setAttribute("height", next);
  }

  override connectedCallback(): void {
    this.dataset.ui = "progress-units";
    this.toggleAttribute("data-unit-chart", true);
    adoptStyles(rootOf(this), css);
    this.#syncHeight();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "size") this.#syncHeight();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    const value = number(this.getAttribute("value"), Number.NaN);
    return (
      !Number.isFinite(value) ||
      !(number(this.getAttribute("max"), 5) > 0) ||
      number(this.getAttribute("count"), 5) < 1
    );
  }

  protected draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale, color, animate } = ctx;
    const value = number(this.getAttribute("value"), 0);
    const max = number(this.getAttribute("max"), 5);
    const step = number(this.getAttribute("step"), 0) || undefined;
    const unitsCount = Math.max(1, Math.floor(number(this.getAttribute("count"), 5)));
    const segments = this.getAttribute("variant") === "segments";
    const gap = Math.max(0, number(this.getAttribute("gap"), 0.18));
    const showValue = flag(this.getAttribute("show-value"), true);
    const format: ValueFormatter =
      this.valueFormat || this.hasAttribute("value-format")
        ? ctx.format
        : (n) => formatNumber(n, { locale, maximumFractionDigits: 1 });
    const tone = this.getAttribute("tone") as ChartTone | null;
    const raw =
      this.getAttribute("color") ??
      (tone && Object.hasOwn(TONE_COLORS, tone) ? TONE_COLORS[tone].ink : color(0));
    const ink = paint(raw, color(0));
    const shown = Math.min(max, Math.max(0, roundToStep(value, step)));
    const text = `${format(shown)} / ${format(max)}`;
    const fractions = progressFractions(value, max, unitsCount, step);

    const valueWidth = showValue ? Math.ceil(textWidth(text, 13) * 1.15) + 12 : 0;
    const area = Math.max(8, width - valueWidth);
    const count = fractions.length;
    let unitWidth: number;
    let spacing = gap;
    let shape: ResolvedUnitShape;
    if (segments) {
      const pitchGap = Math.max(3, height * 0.18);
      unitWidth = Math.max(4, Math.min(height * 2, (area - (count - 1) * pitchGap) / count));
      shape = segmentShape(unitWidth, Math.max(4, Math.min(height * 0.42, unitWidth)));
      spacing = pitchGap / unitWidth;
    } else {
      unitWidth = Math.max(4, Math.min(height, area / (count + (count - 1) * spacing)));
      shape = resolveUnitShape(this.icon, () => this.requestDraw());
    }
    const pitch = unitWidth * (1 + spacing);
    const used = count ? (count - 1) * pitch + unitWidth : 0;

    fractions.forEach((amount, index) => {
      root.append(
        glyph(
          shape,
          index * pitch,
          (height - unitWidth) / 2,
          unitWidth,
          amount,
          ink,
          `${this.#clips}-${index}`,
        ),
      );
    });
    if (showValue)
      root.append(
        svg(
          "text",
          {
            x: used + 10,
            y: height / 2,
            "dominant-baseline": "central",
            "data-unit-value": "",
            "aria-hidden": "true",
            style: "font-size:13px",
          },
          text,
        ),
      );
    if (animate) popUnits(root, { duration: 360, budget: 420 });

    return {
      summary: text,
      snapshot: () => ({
        title: this.getAttribute("label") ?? this.resolvedLabels.chart,
        categoryHeader: "Item",
        categories: [this.getAttribute("label") ?? this.resolvedLabels.chart],
        series: [{ id: "value", name: "Value", color: ink, values: [shown], text: [text] }],
      }),
    };
  }
}

/** Registers `<ui-progress-units>` (or `<prefix>-progress-units`) and returns the tag. */
export function defineProgressUnits(options?: DefineOptions): string {
  return defineElement("progress-units", UiProgressUnits, options);
}
