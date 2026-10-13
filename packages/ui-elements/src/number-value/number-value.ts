import { animateNumber, formatNumber, type NumberFormatConfig } from "@jcsoftdev/ui-core/number";
import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { attrJson, attrNumber, attrOn } from "../internal/e2-attrs.js";
import css from "./number-value.css.js";

/**
 * `<ui-number-value>`: a number that counts up to `value`, formatted with `Intl.NumberFormat`.
 * Assistive technology reads the final value at once: the animated text is `aria-hidden` and a
 * visually hidden copy carries the final text, so it is never announced digit by digit. The math
 * (formatting, easing, reduced motion) is `@jcsoftdev/ui-core/number`.
 *
 * Attributes: `value`, `locale` (default `es-PE`), `format` (a JSON object of Intl options, e.g.
 * `{"style":"currency","currency":"PEN"}`; also the `format` property), `duration` (ms, default
 * 900; 0 shows the value at once), `from` (start of the first count, default 0), `animate-on-mount`
 * (`"false"` shows the value at once on first render and animates only later changes).
 * No animation under `prefers-reduced-motion`.
 */
export class UiNumberValue extends ElementBase {
  static observedAttributes = ["value", "locale", "format", "duration", "from", "animate-on-mount"];

  readonly #visual: HTMLElement;
  readonly #text: HTMLElement;
  #config: NumberFormatConfig | undefined;
  #shown = 0;
  #started = false;
  #cancel: (() => void) | undefined;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<span part="value" aria-hidden="true"></span><span part="text"></span>';
    this.#visual = root.querySelector("[part=value]") as HTMLElement;
    this.#text = root.querySelector("[part=text]") as HTMLElement;
  }

  get value(): number {
    return attrNumber(this, "value", 0);
  }
  set value(value: number) {
    this.setAttribute("value", String(value));
  }
  /** Intl options plus `locale`; overrides the `format` / `locale` attributes when set. */
  get format(): NumberFormatConfig | undefined {
    return this.#config;
  }
  set format(value: NumberFormatConfig | undefined) {
    this.#config = value;
    if (this.isConnected) this.#update();
  }

  connectedCallback(): void {
    this.#update();
  }

  disconnectedCallback(): void {
    this.#cancel?.();
    this.#started = false;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#update();
  }

  #formatConfig(): NumberFormatConfig {
    const locale = this.getAttribute("locale");
    return {
      ...attrJson<NumberFormatConfig>(this, "format"),
      ...(locale ? { locale } : {}),
      ...this.#config,
    };
  }

  #update(): void {
    const config = this.#formatConfig();
    const value = this.value;
    this.#text.textContent = formatNumber(value, config);
    this.#cancel?.();
    if (!this.#started) {
      this.#started = true;
      this.#shown = attrOn(this, "animate-on-mount") ? attrNumber(this, "from", 0) : value;
    }
    this.#cancel = animateNumber({
      from: this.#shown,
      to: value,
      duration: attrNumber(this, "duration", 900),
      onFrame: (frame) => {
        this.#shown = frame;
        this.#visual.textContent = formatNumber(frame, config);
      },
    });
  }
}

/** Registers `<ui-number-value>` (or `<prefix-number-value>`) and returns the tag. */
export function defineNumberValue(options?: DefineOptions): string {
  return defineElement("number-value", UiNumberValue, options);
}
