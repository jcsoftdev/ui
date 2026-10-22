import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { glyph } from "../internal/e1-icons.js";
import { formatTrend, trendDirection, trendTone } from "../internal/e1-trend.js";
import css from "./trend-chip.css.js";

const TONE_WORDS = { positive: "favorable", negative: "desfavorable", neutral: "sin cambio" };
const DIRECTION_WORDS = { up: "sube", down: "baja", flat: "estable" };

/**
 * `<ui-trend-chip>`: a compact change indicator with an arrow, a signed percent and a good/bad
 * tone, never colour alone: a visually hidden "sube, favorable: " prefix (Spanish, as in the React
 * kit) carries the meaning.
 * Attributes: `value` (the change in percent, 12.5 is +12.5%), `invert` (lower is better),
 * `epsilon` (changes within it stay flat), `label` (text after the number), `locale` (default
 * `es-PE`). `data-direction` (`up`, `down`, `flat`) and `data-tone` (`positive`, `negative`,
 * `neutral`) are reflected for styling.
 */
export class UiTrendChip extends ElementBase {
  static observedAttributes = ["value", "invert", "epsilon", "label", "locale"];

  readonly #arrow: HTMLElement;
  readonly #words: HTMLElement;
  readonly #value: HTMLElement;
  readonly #label: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<span part="arrow"></span><span part="sr"></span><span part="value"></span><span part="label"></span>';
    const [arrow, words, value, label] = root.children as unknown as HTMLElement[];
    this.#arrow = arrow as HTMLElement;
    this.#words = words as HTMLElement;
    this.#value = value as HTMLElement;
    this.#label = label as HTMLElement;
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const value = Number(this.getAttribute("value") ?? Number.NaN);
    const direction = trendDirection(value, Number(this.getAttribute("epsilon") ?? 0) || 0);
    const tone = trendTone(direction, this.hasAttribute("invert"));
    this.dataset.direction = direction;
    this.dataset.tone = tone;
    this.#arrow.innerHTML = glyph(direction, 2.2);
    this.#words.textContent = `${DIRECTION_WORDS[direction]}, ${TONE_WORDS[tone]}: `;
    this.#value.textContent = formatTrend(value, this.getAttribute("locale") ?? undefined);
    const label = this.getAttribute("label");
    this.#label.textContent = label ?? "";
    this.#label.hidden = !label;
  }
}

/** Registers `<ui-trend-chip>` (or `<prefix-trend-chip>`) and returns the tag. */
export function defineTrendChip(options?: DefineOptions): string {
  return defineElement("trend-chip", UiTrendChip, options);
}
