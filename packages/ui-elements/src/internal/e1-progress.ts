import { adoptStyles, ElementBase } from "./base.js";

const DEFAULT_MAX = 100;

const validMax = (max: number) => !Number.isNaN(max) && max > 0;
const validValue = (value: number, max: number) =>
  !Number.isNaN(value) && value >= 0 && value <= max;

/** Rounded percentage, the default `aria-valuetext`. */
export const percentLabel = (value: number, max: number) => `${Math.round((value / max) * 100)}%`;

/**
 * Shared engine of `<ui-progress>` and `<ui-meter>`: `role="progressbar"` on the host through
 * ElementInternals, a determinate or indeterminate bar. A missing or out-of-range `value` is
 * indeterminate (no `aria-valuenow`), an invalid `max` falls back to 100.
 */
export abstract class ProgressBase extends ElementBase {
  static observedAttributes = ["value", "max", "value-text"];

  /** Replaces the default percentage text; wins over `value-text`. */
  valueLabel: ((value: number, max: number) => string) | null = null;

  readonly #internals = this.attachInternals();
  readonly #bar: HTMLElement;

  constructor(css: string) {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<div part="indicator"></div>';
    this.#bar = root.firstElementChild as HTMLElement;
    this.#internals.role = "progressbar";
    this.#internals.ariaValueMin = "0";
  }

  get value(): number | null {
    const raw = this.getAttribute("value");
    return raw === null || raw.trim() === "" ? null : Number(raw);
  }
  set value(value: number | null) {
    if (value === null) this.removeAttribute("value");
    else this.setAttribute("value", String(value));
  }
  get max(): number {
    const raw = this.getAttribute("max");
    const max = raw === null ? DEFAULT_MAX : Number(raw);
    return validMax(max) ? max : DEFAULT_MAX;
  }
  set max(value: number) {
    this.setAttribute("max", String(value));
  }

  /** The text announced as `aria-valuetext`, or null while indeterminate. */
  get valueText(): string | null {
    return this.#internals.ariaValueText;
  }

  connectedCallback(): void {
    this.update();
  }

  attributeChangedCallback(): void {
    this.update();
  }

  /** Re-reads the attributes; call after changing `valueLabel`. */
  update(): void {
    const max = this.max;
    const raw = this.value;
    const current = raw !== null && validValue(raw, max) ? raw : null;
    const state = current === null ? "indeterminate" : current === max ? "complete" : "loading";
    const internals = this.#internals;
    internals.ariaValueMax = String(max);
    internals.ariaValueNow = current === null ? null : String(current);
    internals.ariaValueText =
      current === null
        ? null
        : (this.valueLabel?.(current, max) ??
          this.getAttribute("value-text") ??
          percentLabel(current, max));
    this.dataset.state = state;
    this.#bar.dataset.state = state;
    this.#bar.style.setProperty("--ui-progress-gap", `${100 - ((current ?? 0) / max) * 100}%`);
  }
}
