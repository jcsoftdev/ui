import { animateNumber, formatNumber, type NumberFormatConfig } from "@jcsoftdev/ui-core/number";
import { type DefineOptions, defineElement, ElementBase, isPart } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { glyph } from "../internal/e1-icons.js";
import { formatTrend, trendDirection, trendTone } from "../internal/e1-trend.js";
import { gather, part, upgradeProperties } from "../internal/e10.js";
import css from "./kpi-group.css.js";

const DURATION = 900;

/** Formats with the author's config; an invalid locale or option falls back to the defaults. */
function safeFormat(value: number, format?: NumberFormatConfig): string {
  try {
    return formatNumber(value, format);
  } catch {
    return formatNumber(value);
  }
}
const TONE_WORDS = { positive: "favorable", negative: "desfavorable", neutral: "sin cambio" };
const DIRECTION_WORDS = { up: "sube", down: "baja", flat: "estable" };

/**
 * `<ui-kpi-group>`: metrics that belong together in one card, divided by hairlines. Put
 * `<ui-kpi-item>` children in it. The columns follow the width of the group, not the viewport:
 * 1, then 2 from 24rem and 4 from 48rem.
 *
 * ARIA: a description list (`dl`) of terms (labels) and definitions (values, trend, description).
 * Attribute `animate="false"` turns the count-up off (on by default; it also stops for
 * `prefers-reduced-motion`).
 */
export class UiKpiGroup extends ElementBase {
  static observedAttributes = ["animate"];
  readonly #list = part("dl", "list");
  #stop: (() => void) | undefined;

  /** Whether numeric values count up (attribute `animate`, on unless `"false"`). */
  get animated(): boolean {
    return this.getAttribute("animate") !== "false";
  }

  connectedCallback(): void {
    connectLight(this, "kpi-group", css);
    this.prepend(this.#list);
    this.#stop = gather(
      this,
      (child) => (isPart(child, "kpi-item") ? this.#list : null),
      (child) => child === this.#list || !isPart(child, "kpi-item"),
    );
  }

  disconnectedCallback(): void {
    this.#stop?.();
  }
}

/**
 * `<ui-kpi-item>`: one metric of a KPI group. Attributes: `label`; `value` (a number is formatted
 * and counted up, any other text is shown as it is); `format` (JSON of `Intl.NumberFormat`
 * options plus `locale`, e.g. `{"style":"currency","currency":"PEN"}`; the `format` property takes
 * an object); `trend` (change in percent, shows a trend chip), `trend-label`, `invert-trend`
 * (lower is better); `description`. A child with `slot="value"` replaces the value text.
 */
export class UiKpiItem extends ElementBase {
  static observedAttributes = [
    "label",
    "value",
    "format",
    "trend",
    "trend-label",
    "invert-trend",
    "description",
  ];

  readonly #label = part("dt", "label");
  readonly #body = part("dd", "body");
  readonly #value = part("span", "value");
  readonly #text = part("span", "text");
  readonly #final = part("span", "sr");
  readonly #description = part("span", "description");
  #format: NumberFormatConfig | undefined;
  #shown: number | undefined;
  #cancel: (() => void) | undefined;
  #stop: (() => void) | undefined;

  /** `Intl.NumberFormat` options plus `locale`; overrides the `format` attribute. */
  get format(): NumberFormatConfig | undefined {
    if (this.#format) return this.#format;
    const raw = this.getAttribute("format");
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as NumberFormatConfig;
    } catch {
      return undefined;
    }
  }

  set format(value: NumberFormatConfig | undefined) {
    this.#format = value;
    if (this.isConnected) this.#render();
  }

  connectedCallback(): void {
    connectLight(this, "kpi-item", css);
    this.setAttribute("role", "none");
    upgradeProperties(this, ["format"]);
    this.#body.append(this.#value);
    this.#stop = gather(
      this,
      () => this.#value,
      (child) => child === this.#label || child === this.#body,
      () => this.#render(),
    );
    this.append(this.#label, this.#body);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#stop?.();
    this.#cancel?.();
    this.#shown = undefined;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #render(): void {
    this.#label.textContent = this.getAttribute("label") ?? "";
    const raw = this.getAttribute("value");
    const slotted = Array.from(this.#value.children).filter(
      (child) => child !== this.#text && child !== this.#final,
    );
    const number = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
    this.#cancel?.();
    this.#cancel = undefined;
    if (slotted.length > 0) {
      this.#text.remove();
      this.#final.remove();
    } else if (Number.isNaN(number)) {
      this.#value.replaceChildren(this.#text);
      this.#text.textContent = raw ?? "";
      this.#shown = undefined;
    } else {
      this.#showNumber(number);
    }
    const children: Node[] = [this.#value];
    const trend = this.getAttribute("trend");
    if (trend !== null && trend !== "") children.push(this.#trend(Number(trend)));
    const description = this.getAttribute("description");
    if (description) {
      this.#description.textContent = description;
      children.push(this.#description);
    }
    this.#body.replaceChildren(...children);
  }

  #showNumber(to: number): void {
    const format = this.format;
    const finalText = safeFormat(to, format);
    const group = this.closest('[data-ui="kpi-group"]') as UiKpiGroup | null;
    const animate = group ? group.animated : true;
    const from = this.#shown ?? 0;
    this.#final.textContent = finalText;
    this.#value.replaceChildren(this.#text, this.#final);
    this.#text.textContent = finalText;
    this.#shown = to;
    if (!animate || from === to) {
      this.#text.removeAttribute("aria-hidden");
      this.#final.remove();
      return;
    }
    this.#text.setAttribute("aria-hidden", "true");
    this.#text.textContent = safeFormat(from, format);
    this.#cancel = animateNumber({
      from,
      to,
      duration: DURATION,
      onFrame: (value) => {
        this.#text.textContent = safeFormat(value, format);
      },
    });
  }

  #trend(value: number): HTMLElement {
    const direction = trendDirection(value);
    const tone = trendTone(direction, this.hasAttribute("invert-trend"));
    const chip = part("span", "trend");
    chip.dataset.tone = tone;
    chip.dataset.direction = direction;
    const sr = part("span", "sr", `${DIRECTION_WORDS[direction]}, ${TONE_WORDS[tone]}: `);
    const arrow = part("span", "arrow");
    arrow.innerHTML = glyph(direction, 2.2);
    const label = this.getAttribute("trend-label");
    chip.append(arrow, sr, part("span", "trend-value", formatTrend(value)));
    if (label) chip.append(part("span", "trend-label", label));
    return chip;
  }
}

/** Registers `<ui-kpi-group>` and `<ui-kpi-item>` (or the same under another prefix); returns the group tag. */
export function defineKpiGroup(options?: DefineOptions): string {
  defineElement("kpi-item", UiKpiItem, options);
  return defineElement("kpi-group", UiKpiGroup, options);
}
