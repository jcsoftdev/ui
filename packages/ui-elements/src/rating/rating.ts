import { adoptStyles, type DefineOptions, defineElement } from "../internal/base.js";
import { controlName, icon, inlineRatio, numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import css from "./rating.css.js";

type Precision = 0.5 | 1;

/** Rounds a value to the nearest `precision` inside [0, max]. Same maths as the React kit. */
export function roundRating(value: number, max: number, precision: Precision = 1): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value / precision) * precision));
}

/** Fill of star `index` (0-based) for a rating: 0, 0.5 or 1. */
export function starFill(index: number, rating: number): 0 | 0.5 | 1 {
  const diff = rating - index;
  return diff >= 1 ? 1 : diff >= 0.5 ? 0.5 : 0;
}

/**
 * `<ui-rating>`: star rating. An editable rating is one `role="slider"` with a single tab stop
 * (arrows, Home/End), as in the React kit; a read-only or disabled one is a `role="img"` named
 * with its value. The left half of a star counts as .5 with `precision="0.5"`; pressing the
 * current value again clears it (the press is read on release over a star, as in the React kit,
 * so releasing elsewhere sets nothing). Arrows and the pointer are mirrored in RTL. The value is a number
 * as text, submitted under `name`.
 *
 * Attributes: `value` (0), `name`, `max` (5), `precision` (`1` or `0.5`), `readonly`, `disabled`,
 * `size` (`sm`, `md`, `lg`), `show-value`, `label` or `aria-label` ("Rating"), `required` (0 is
 * missing). Events: `input` and `change` when the rating changes.
 */
export class UiRating extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "max",
    "precision",
    "readonly",
    "show-value",
    "label",
    "aria-label",
    "aria-labelledby",
  ];

  readonly #root: HTMLElement;
  #shape = "";
  #hover: number | null = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = '<div part="root"><div part="stars"></div><span part="value"></span></div>';
    this.#root = root.querySelector("[part=root]") as HTMLElement;
    const stars = this.#stars();
    stars.addEventListener("keydown", (event) => this.#onKey(event));
    stars.addEventListener("pointermove", (event) => {
      const next = this.#pointerValue(event);
      if (this.interactive && next !== null && next !== this.#hover) {
        this.#hover = next;
        this.update();
      }
    });
    stars.addEventListener("pointerleave", () => {
      if (this.#hover === null) return;
      this.#hover = null;
      this.update();
    });
    stars.addEventListener("pointerup", (event) => {
      const next = this.#pointerValue(event);
      if (!this.interactive || next === null) return;
      // Pressing the current value again clears it.
      this.#set(next === this.valueAsNumber ? 0 : next);
    });
  }

  get max(): number {
    return Math.max(1, Math.floor(numberAttr(this, "max", 5)));
  }
  get precision(): Precision {
    return this.getAttribute("precision") === "0.5" ? 0.5 : 1;
  }
  get readOnly(): boolean {
    return this.hasAttribute("readonly");
  }
  /** Whether the rating can be changed. */
  get interactive(): boolean {
    return !this.readOnly && !this.disabled;
  }
  get valueAsNumber(): number {
    const parsed = Number(super.value);
    return roundRating(super.value.trim() === "" ? 0 : parsed, this.max, this.precision);
  }

  override get value(): string {
    return String(this.valueAsNumber);
  }
  override set value(value: string) {
    super.value = value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  protected override update(): void {
    super.update();
    this.internals.setFormValue(this.value);
  }

  protected override validate() {
    if (this.required && this.valueAsNumber === 0)
      return {
        flags: { valueMissing: true },
        message: "Select a rating.",
        anchor: this.#stars(),
      };
    return undefined;
  }

  protected render(): void {
    const { max, interactive } = this;
    const stars = this.#stars();
    const shape = `${max}|${interactive}`;
    if (shape !== this.#shape) {
      this.#shape = shape;
      stars.innerHTML = Array.from(
        { length: max },
        () =>
          `<span part="star">${icon("star")}<span part="fill">${icon("star", true)}</span></span>`,
      ).join("");
    }
    const value = this.valueAsNumber;
    const shown = this.#hover ?? value;
    stars.querySelectorAll<HTMLElement>("[part=fill]").forEach((fill, index) => {
      fill.style.inlineSize = `${starFill(index, shown) * 100}%`;
    });
    const label = controlName(this, this.internals.labels as NodeListOf<HTMLLabelElement>);
    const text = `${value} of ${max}`;
    stars.toggleAttribute("data-interactive", interactive);
    if (interactive) {
      stars.setAttribute("role", "slider");
      stars.tabIndex = 0;
      stars.setAttribute("aria-label", label || "Rating");
      stars.setAttribute("aria-valuemin", "0");
      stars.setAttribute("aria-valuemax", String(max));
      stars.setAttribute("aria-valuenow", String(value));
      stars.setAttribute("aria-valuetext", text);
      stars.removeAttribute("aria-disabled");
    } else {
      stars.setAttribute("role", "img");
      stars.removeAttribute("tabindex");
      stars.setAttribute("aria-label", `${label || "Rating"}: ${text}`);
      for (const name of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext"])
        stars.removeAttribute(name);
      if (this.disabled) stars.setAttribute("aria-disabled", "true");
      else stars.removeAttribute("aria-disabled");
    }
    const display = this.#root.querySelector("[part=value]") as HTMLElement;
    display.hidden = !this.hasAttribute("show-value");
    display.textContent = String(value);
  }

  #stars(): HTMLElement {
    return this.#root.querySelector("[part=stars]") as HTMLElement;
  }

  /** Rating under the pointer: the left half of a star counts as .5 when halves are allowed. */
  #pointerValue(event: PointerEvent): number | null {
    const star = (event.target as Element).closest<HTMLElement>("[part=star]");
    if (!star) return null;
    const index = [...this.#stars().children].indexOf(star);
    const rect = star.getBoundingClientRect();
    const offset = inlineRatio(this, (event.clientX - rect.left) / (rect.width || 1));
    const half = this.precision === 0.5 && offset < 0.5;
    return Math.min(this.max, index + (half ? 0.5 : 1));
  }

  #set(next: number): void {
    if (!this.interactive || next === this.valueAsNumber) return;
    this.commit(String(next));
  }

  #onKey(event: KeyboardEvent): void {
    if (!this.interactive || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(this).direction === "rtl";
    const { max, precision, valueAsNumber: value } = this;
    let key = event.key;
    if (rtl && (key === "ArrowLeft" || key === "ArrowRight"))
      key = key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (key === "ArrowRight" || key === "ArrowUp") next = Math.min(max, value + precision);
    else if (key === "ArrowLeft" || key === "ArrowDown") next = Math.max(0, value - precision);
    else if (key === "Home") next = 0;
    else if (key === "End") next = max;
    else return;
    event.preventDefault();
    this.#set(next);
  }
}

/** Registers `<ui-rating>` (or `<prefix-rating>`) and returns the tag. */
export function defineRating(options?: DefineOptions): string {
  return defineElement("rating", UiRating, options);
}
