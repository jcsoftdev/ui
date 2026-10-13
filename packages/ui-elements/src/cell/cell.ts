import { type DefineOptions, defineElement, ElementBase, emit, uid } from "../internal/base.js";
import { connectLight, RowParts } from "../internal/containers.js";
import css from "./cell.css.js";

type Variant = "switch" | "select" | "slider" | "color";

/**
 * `<ui-cell>`: a settings-list row with a ready-made control, laid out like `<ui-settings-row>`
 * (`heading`, `description`, divider, wrapping). The row title names the control through
 * `aria-labelledby`.
 *
 * Attributes: `variant` (`switch` | `select` | `slider` | `color`), `heading`, `description`,
 * `disabled`, and the control's initial state: `checked` (switch), `value` (select, slider,
 * color), `min` / `max` / `step` (slider, default 0 / 100 / 1).
 *
 * Choices (select, color) are child `<option value="..." >Label</option>` elements; a color option
 * also takes `data-swatch="<css color>"`, typically a variable such as `var(--accent)`. The
 * `switch` control is the sibling `<ui-switch>` (same prefix) when it is defined, and a native
 * `<input type="checkbox" role="switch">` otherwise, so the cell never imports it.
 *
 * Events: `change` with `detail.checked` (switch) or `detail.value` (select and color: the option
 * value string; slider: a number), and the native `input` of a slider while it moves. Properties
 * `checked` and `value` read the current state of the control.
 */
export class UiCell extends ElementBase {
  static observedAttributes = [
    "variant",
    "heading",
    "description",
    "disabled",
    "checked",
    "value",
    "min",
    "max",
    "step",
  ];

  readonly #row = new RowParts(this);
  readonly #titleId = uid("cell-title");
  #control: HTMLElement | undefined;
  #observer: MutationObserver | undefined;

  get variant(): Variant {
    const variant = this.getAttribute("variant");
    return variant === "select" || variant === "slider" || variant === "color" ? variant : "switch";
  }
  set variant(value: Variant) {
    this.setAttribute("variant", value);
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get checked(): boolean {
    const control = this.#control as (HTMLElement & { checked?: boolean }) | undefined;
    return control?.checked ?? this.hasAttribute("checked");
  }
  set checked(value: boolean) {
    const control = this.#control as (HTMLElement & { checked?: boolean }) | undefined;
    if (control && this.variant === "switch") control.checked = value;
    else this.toggleAttribute("checked", value);
  }
  get value(): string {
    if (this.variant === "color")
      return this.#control?.querySelector<HTMLInputElement>("input:checked")?.value ?? "";
    return this.#field()?.value ?? this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    this.setAttribute("value", value);
    this.#syncState("value");
  }
  /** Id of the title element, which labels the control. */
  get titleId(): string {
    return this.#titleId;
  }

  connectedCallback(): void {
    connectLight(this, "cell", css);
    this.#row.render(this.#titleId);
    this.#build();
    // Options parsed after the element upgraded (a streaming parser) rebuild the control.
    this.#observer ??= new MutationObserver((records) => {
      const options = (nodes: NodeList) =>
        [...nodes].some((node) => node instanceof HTMLOptionElement);
      if (records.some((r) => options(r.addedNodes) || options(r.removedNodes))) this.#build();
    });
    this.#observer.observe(this, { childList: true });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "heading" || name === "description") this.#row.render(this.#titleId);
    else if (name === "variant" || name === "min" || name === "max" || name === "step")
      this.#build();
    else this.#syncState(name);
  }

  #build(): void {
    this.#control?.remove();
    const control = this.#create();
    control.dataset.uiPart = "control";
    this.#control = control;
    this.append(control);
    control.addEventListener("change", (event) => {
      event.stopPropagation();
      this.#emitChange();
    });
    this.#syncState("disabled");
  }

  #create(): HTMLElement {
    switch (this.variant) {
      case "select":
        return this.#select();
      case "slider":
        return this.#slider();
      case "color":
        return this.#color();
      default:
        return this.#switch();
    }
  }

  #switch(): HTMLElement {
    const tag = this.localName.replace(/-cell$/, "-switch");
    let control: HTMLElement;
    if (customElements.get(tag)) {
      control = document.createElement(tag);
    } else {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      control = input;
    }
    control.setAttribute("aria-labelledby", this.#titleId);
    (control as HTMLElement & { checked: boolean }).checked = this.hasAttribute("checked");
    return control;
  }

  #select(): HTMLElement {
    const select = document.createElement("select");
    select.setAttribute("aria-labelledby", this.#titleId);
    for (const option of this.querySelectorAll(":scope > option"))
      select.append(option.cloneNode(true));
    const value = this.getAttribute("value");
    if (value !== null) select.value = value;
    return select;
  }

  #slider(): HTMLElement {
    const min = this.getAttribute("min") ?? "0";
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = this.getAttribute("max") ?? "100";
    input.step = this.getAttribute("step") ?? "1";
    input.value = this.getAttribute("value") ?? min;
    input.setAttribute("aria-labelledby", this.#titleId);
    const output = document.createElement("output");
    output.setAttribute("aria-hidden", "true");
    output.textContent = input.value;
    input.addEventListener("input", () => {
      output.textContent = input.value;
    });
    wrap.append(input, output);
    return wrap;
  }

  #color(): HTMLElement {
    const group = document.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", this.#titleId);
    const name = uid("cell-color");
    const options = [...this.querySelectorAll<HTMLOptionElement>(":scope > option")];
    const initial = this.getAttribute("value") ?? options[0]?.value;
    for (const option of options) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = option.value;
      input.checked = option.value === initial;
      const swatch = document.createElement("span");
      swatch.dataset.uiPart = "swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.background = option.dataset.swatch ?? "";
      label.append(input, swatch, option.textContent ?? "");
      group.append(label);
    }
    return group;
  }

  /** The inner form control: the control itself, or the range inside its wrapper. */
  #field(): (HTMLElement & { disabled: boolean; value: string }) | undefined {
    const control = this.#control;
    if (!control) return undefined;
    return (control.querySelector("input[type=range]") ?? control) as never;
  }

  #syncState(name: string): void {
    const control = this.#control;
    if (!control) return;
    if (name === "disabled") {
      const on = this.hasAttribute("disabled");
      for (const element of control.querySelectorAll<HTMLInputElement>("input"))
        element.disabled = on;
      if (control.matches("select, input") || control.localName.endsWith("-switch"))
        control.toggleAttribute("disabled", on);
      if (control.getAttribute("role") === "radiogroup")
        control.setAttribute("aria-disabled", String(on));
    } else if (name === "checked" && this.variant === "switch") {
      (control as HTMLElement & { checked: boolean }).checked = this.hasAttribute("checked");
    } else if (name === "value") {
      const value = this.getAttribute("value") ?? "";
      if (this.variant === "color") {
        for (const input of control.querySelectorAll<HTMLInputElement>("input"))
          input.checked = input.value === value;
      } else if (this.variant !== "switch") {
        const field = this.#field();
        if (field) field.value = value;
        const output = control.querySelector("output");
        if (output && field) output.textContent = field.value;
      }
    }
  }

  #emitChange(): void {
    if (this.variant === "switch") emit(this, "change", { checked: this.checked });
    else if (this.variant === "slider")
      emit(this, "change", { value: Number(this.#field()?.value) });
    else emit(this, "change", { value: this.value });
  }
}

/** Registers `<ui-cell>` (or `<prefix-cell>`) and returns the tag. */
export function defineCell(options?: DefineOptions): string {
  return defineElement("cell", UiCell, options);
}
