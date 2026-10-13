import { adoptStyles, type DefineOptions, defineElement, emit } from "../internal/base.js";
import { FormElement } from "../internal/form.js";
import { innerValidity, syncControlAria } from "../internal/form-controls.js";
import css from "./textarea.css.js";

/** Attributes copied as they are onto the inner `<textarea>`. */
const FORWARDED = [
  "placeholder",
  "readonly",
  "minlength",
  "maxlength",
  "rows",
  "cols",
  "wrap",
  "autocomplete",
  "autocapitalize",
  "spellcheck",
  "enterkeyhint",
  "inputmode",
] as const;

/**
 * `<ui-textarea>`: a native `<textarea>` in a shadow root (focus is delegated to it), on the
 * `FormElement` base. It submits its value under `name`, takes its constraint validity from the
 * inner control (`required`, `minlength`, `maxlength`), restores the `value` attribute on
 * `form.reset()` and follows a disabled fieldset.
 *
 * Accessible name: `aria-label` or `label` on the host, else the `<label>`s that point at the host.
 * `aria-describedby` on the host is resolved in the host's root and handed to the inner control;
 * `invalid` sets `aria-invalid`. Events: `input` (per keystroke) and `change` (on commit), as native.
 */
export class UiTextarea extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    ...FORWARDED,
    "invalid",
    "label",
    "aria-label",
    "aria-describedby",
  ];

  readonly #inner: HTMLTextAreaElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = '<textarea part="textarea"></textarea>';
    this.#inner = root.querySelector("textarea") as HTMLTextAreaElement;
    this.#inner.addEventListener("input", () => {
      this.value = this.#inner.value;
    });
    // `change` is not composed: re-dispatch it from the host.
    this.#inner.addEventListener("change", () => emit(this, "change"));
  }

  /** The inner native textarea, for selection APIs. */
  get textarea(): HTMLTextAreaElement {
    return this.#inner;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  protected override update(): void {
    const inner = this.#inner;
    for (const name of FORWARDED) {
      const value = this.getAttribute(name);
      if (value === null) inner.removeAttribute(name);
      else inner.setAttribute(name, value);
    }
    inner.required = this.required;
    inner.disabled = this.disabled;
    if (inner.value !== this.value) inner.value = this.value;
    syncControlAria(this, inner, this.internals.labels as NodeListOf<HTMLLabelElement>);
    super.update();
  }

  protected render(): void {}

  protected override validate() {
    return innerValidity(this.#inner);
  }
}

/** Registers `<ui-textarea>` (or `<prefix-textarea>`) and returns the tag. */
export const defineTextarea = (options?: DefineOptions) =>
  defineElement("textarea", UiTextarea, options);
