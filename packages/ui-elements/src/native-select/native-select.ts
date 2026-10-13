import { adoptStyles, type DefineOptions, defineElement, emit } from "../internal/base.js";
import { FormElement } from "../internal/form.js";
import { innerValidity, syncControlAria } from "../internal/form-controls.js";
import css from "./native-select.css.js";

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectGroup {
  label: string;
  options: NativeSelectOption[];
}

const isGroup = (item: NativeSelectOption | NativeSelectGroup): item is NativeSelectGroup =>
  "options" in item;

const CHEVRON =
  '<svg part="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

/**
 * `<ui-native-select>`: a styled native `<select>` in a shadow root (it keeps the system picker on
 * touch devices), on the `FormElement` base: `name`, `value`, `required`, `disabled` (also from a
 * fieldset), validity from the inner control, `form.reset()` back to the `value` attribute.
 *
 * Options: put `<option>` and `<optgroup>` children in it, or set the `options` property to
 * `(NativeSelectOption | NativeSelectGroup)[]` (groups render as `<optgroup>`). `placeholder` adds
 * a disabled first option with the empty value, shown while nothing is chosen. `size` is `sm` or
 * `md`; `invalid` sets `aria-invalid`.
 *
 * Accessible name: `aria-label` or `label` on the host, else the `<label>`s that point at the host.
 * Events: `input` and `change`, as native.
 */
export class UiNativeSelect extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "placeholder",
    "invalid",
    "label",
    "aria-label",
    "aria-describedby",
  ];

  readonly #inner: HTMLSelectElement;
  #data: (NativeSelectOption | NativeSelectGroup)[] | undefined;
  #observer: MutationObserver | undefined;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = `<select part="select"></select>${CHEVRON}`;
    this.#inner = root.querySelector("select") as HTMLSelectElement;
    this.#inner.addEventListener("input", () => {
      this.value = this.#inner.value;
    });
    this.#inner.addEventListener("change", () => emit(this, "change"));
  }

  /** The inner native select. */
  get select(): HTMLSelectElement {
    return this.#inner;
  }

  /** Data-driven options; when set they replace the `<option>` children. */
  get options(): (NativeSelectOption | NativeSelectGroup)[] | undefined {
    return this.#data;
  }
  set options(options: (NativeSelectOption | NativeSelectGroup)[] | undefined) {
    this.#data = options;
    this.#rebuild();
  }

  override get defaultValue(): string {
    const attribute = this.getAttribute("value");
    if (attribute !== null) return attribute;
    if (this.hasAttribute("placeholder")) return "";
    const options = [...this.#inner.options];
    return (
      (options.find((o) => o.defaultSelected) ?? options.find((o) => !o.disabled))?.value ?? ""
    );
  }

  override connectedCallback(): void {
    this.#observer ??= new MutationObserver((records) => {
      if (records.some((record) => record.target !== this)) this.#rebuild();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["value", "disabled", "label", "selected"],
    });
    this.#build();
    super.connectedCallback();
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  override attributeChangedCallback(name: string, old?: string | null, next?: string | null): void {
    if (name === "placeholder") this.#build();
    super.attributeChangedCallback(name, old, next);
  }

  #build(): void {
    const items: Node[] = [];
    if (this.hasAttribute("placeholder")) {
      const placeholder = new Option(this.getAttribute("placeholder") ?? "", "");
      placeholder.disabled = true;
      items.push(placeholder);
    }
    if (this.#data) {
      const option = ({ value, label, disabled }: NativeSelectOption) => {
        const element = new Option(label, value);
        element.disabled = !!disabled;
        return element;
      };
      for (const item of this.#data) {
        if (!isGroup(item)) items.push(option(item));
        else {
          const group = document.createElement("optgroup");
          group.label = item.label;
          group.append(...item.options.map(option));
          items.push(group);
        }
      }
    } else {
      for (const child of this.children)
        if (child instanceof HTMLOptionElement || child instanceof HTMLOptGroupElement)
          items.push(child.cloneNode(true));
    }
    this.#inner.replaceChildren(...items);
  }

  /** Rebuilds the options, then lets a non-dirty value fall back to the new default. */
  #rebuild(): void {
    this.#build();
    this.attributeChangedCallback("value");
  }

  protected override update(): void {
    const inner = this.#inner;
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

/** Registers `<ui-native-select>` (or `<prefix-native-select>`) and returns the tag. */
export const defineNativeSelect = (options?: DefineOptions) =>
  defineElement("native-select", UiNativeSelect, options);
