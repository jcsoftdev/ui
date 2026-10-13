import { snapToStep } from "@jcsoftdev/ui-core/pointer-drag";
import { createPressRepeat } from "@jcsoftdev/ui-core/press-repeat";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ensureId,
  toggleAttr,
} from "../internal/base.js";
import { icon, numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import { syncControlAria } from "../internal/form-controls.js";
import css from "./number-stepper.css.js";

/**
 * `<ui-number-stepper>`: counter with minus and plus buttons and a typeable value (WAI-ARIA
 * spinbutton on a native text input). ArrowUp/ArrowDown step it, Home/End jump to `min`/`max`,
 * Enter or blur commits what was typed (snapped to `step` and kept inside the limits). The
 * buttons repeat while held (ui-core `press-repeat`) and stay out of the tab order, as in the React
 * kit. The value is submitted under `name`.
 *
 * Parsing is React parity: a typed value accepts a comma as the decimal mark and anything that is
 * not a finite number is ignored on commit.
 *
 * Attributes: `value` (0), `name`, `min`, `max`, `step` (1), `unit` (text after the number, read
 * through `aria-valuetext`), `decrement-label` ("Decrease"), `increment-label` ("Increase"),
 * `aria-label`, `label`, `disabled`, `invalid`. Events: `input` and `change` on every step.
 */
export class UiNumberStepper extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "min",
    "max",
    "step",
    "unit",
    "decrement-label",
    "increment-label",
    "aria-label",
    "label",
    "aria-describedby",
    "invalid",
  ];

  readonly #input: HTMLInputElement;
  readonly #down: HTMLButtonElement;
  readonly #up: HTMLButtonElement;
  readonly #unit: HTMLElement;
  #draft: string | null = null;
  #releases: (() => void)[] = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = `<div part="root"><button part="decrement" type="button" tabindex="-1">${icon("minus")}</button><input part="input" role="spinbutton" inputmode="decimal" autocomplete="off"><span part="unit" aria-hidden="true"></span><button part="increment" type="button" tabindex="-1">${icon("plus")}</button></div>`;
    this.#input = root.querySelector("input") as HTMLInputElement;
    this.#down = root.querySelector("[part=decrement]") as HTMLButtonElement;
    this.#up = root.querySelector("[part=increment]") as HTMLButtonElement;
    this.#unit = root.querySelector("[part=unit]") as HTMLElement;
    const controls = ensureId(this.#input, "stepper-input");
    for (const button of [this.#down, this.#up]) {
      button.setAttribute("aria-controls", controls);
      // Keep the caret where it is: pressing a button must not steal focus from the field.
      button.addEventListener("mousedown", (event) => event.preventDefault());
    }
    // A `<label>` click reaches the host itself (not a child); `delegatesFocus` would pick a button.
    this.addEventListener("click", (event) => {
      if (event.composedPath()[0] === this) this.focus();
    });
    this.#input.addEventListener("input", (event) => {
      // The native event is composed and would leak out with half-typed text: the host's own
      // `input`/`change` (from `commit`) are the only ones consumers see.
      event.stopPropagation();
      this.#draft = this.#input.value;
    });
    this.#input.addEventListener("blur", () => this.#commitDraft());
    this.#input.addEventListener("keydown", (event) => this.#onKey(event));
  }

  get valueAsNumber(): number {
    return this.#number;
  }

  override get value(): string {
    return String(this.#number);
  }
  override set value(value: string) {
    super.value = value;
  }

  override focus(options?: FocusOptions): void {
    this.#input.focus(options);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#releases.length === 0)
      for (const [button, direction] of [
        [this.#down, -1],
        [this.#up, 1],
      ] as const)
        this.#releases.push(
          createPressRepeat(button, {
            onRepeat: () => {
              this.#commitDraft();
              this.#apply(this.#number + direction * this.#limits.step);
            },
            disabled: () => this.disabled || this.#atLimit(direction),
            minInterval: 30,
          }),
        );
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    for (const release of this.#releases.splice(0)) release();
  }

  protected override update(): void {
    this.#input.disabled = this.disabled;
    syncControlAria(this, this.#input, this.internals.labels as NodeListOf<HTMLLabelElement>);
    super.update();
    // Submit the number that is shown (clamped), not the raw attribute.
    this.internals.setFormValue(this.name ? String(this.#number) : null);
  }

  protected render(): void {
    const { min, max } = this.#limits;
    const value = this.#number;
    const unit = this.getAttribute("unit");
    const input = this.#input;
    input.value = this.#draft ?? String(value);
    input.setAttribute("aria-valuenow", String(value));
    for (const [name, limit] of [
      ["aria-valuemin", min],
      ["aria-valuemax", max],
    ] as const) {
      if (Number.isFinite(limit)) input.setAttribute(name, String(limit));
      else input.removeAttribute(name);
    }
    if (unit) input.setAttribute("aria-valuetext", `${value} ${unit}`);
    else input.removeAttribute("aria-valuetext");
    this.#unit.textContent = unit ?? "";
    toggleAttr(this.#unit, "hidden", !unit);
    this.#down.setAttribute("aria-label", this.getAttribute("decrement-label") ?? "Decrease");
    this.#up.setAttribute("aria-label", this.getAttribute("increment-label") ?? "Increase");
    for (const [button, direction] of [
      [this.#down, -1],
      [this.#up, 1],
    ] as const) {
      button.disabled = this.disabled;
      if (this.#atLimit(direction)) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
    }
  }

  protected override validate(): undefined {
    return undefined;
  }

  get #limits() {
    return {
      min: numberAttr(this, "min", Number.NEGATIVE_INFINITY),
      max: numberAttr(this, "max", Number.POSITIVE_INFINITY),
      step: numberAttr(this, "step", 1),
    };
  }

  get #number(): number {
    const { min, max } = this.#limits;
    const parsed = Number(super.value);
    const value = super.value.trim() !== "" && Number.isFinite(parsed) ? parsed : 0;
    return Math.min(max, Math.max(min, value));
  }

  #atLimit(direction: 1 | -1): boolean {
    const { min, max } = this.#limits;
    return direction === 1 ? this.#number >= max : this.#number <= min;
  }

  #apply(raw: number): void {
    if (this.disabled) return;
    const { min, max, step } = this.#limits;
    const next = Number.isFinite(raw) ? snapToStep(raw, min, max, step) : this.#number;
    if (next !== this.#number) this.commit(String(next));
  }

  #commitDraft(): void {
    const draft = this.#draft;
    if (draft === null) return;
    this.#draft = null;
    if (draft.trim() !== "") this.#apply(Number(draft.replace(",", ".")));
    this.update();
  }

  #onKey(event: KeyboardEvent): void {
    const { min, max, step } = this.#limits;
    const value = this.#number;
    if (event.key === "Enter") {
      this.#commitDraft();
      return;
    }
    if (event.key === "ArrowUp") this.#apply(value + step);
    else if (event.key === "ArrowDown") this.#apply(value - step);
    else if (event.key === "Home" && Number.isFinite(min)) this.#apply(min);
    else if (event.key === "End" && Number.isFinite(max)) this.#apply(max);
    else return;
    this.#draft = null;
    event.preventDefault();
    this.update();
  }
}

/** Registers `<ui-number-stepper>` (or `<prefix-number-stepper>`) and returns the tag. */
export function defineNumberStepper(options?: DefineOptions): string {
  return defineElement("number-stepper", UiNumberStepper, options);
}
