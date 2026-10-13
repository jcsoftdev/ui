import { createDismissLayer } from "@jcsoftdev/ui-core/dismiss";
import { createListbox, type Listbox } from "@jcsoftdev/ui-core/listbox";
import { autoPosition } from "@jcsoftdev/ui-core/popper";
import { waitForExit } from "@jcsoftdev/ui-core/presence";
import { adoptStyles, emit, hasPopover, uid } from "./base.js";
import css from "./e6-select.css.js";
import { FormElement } from "./form.js";
import { syncControlAria } from "./form-controls.js";
import { MATERIAL_ATTRIBUTES, Material } from "./material.js";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

type Entry = (SelectOption & { selected?: boolean }) | SelectGroup;
const isGroup = (entry: Entry): entry is SelectGroup => "options" in entry;

const CHECK =
  '<svg part="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Open keys of a closed select-only combobox (WAI-ARIA APG). */
const OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"]);

/**
 * Shared engine of `<ui-select>` and `<ui-inline-select>`: a form-associated select-only combobox
 * (WAI-ARIA APG) in a shadow root. The trigger is a `role="combobox"` button that keeps DOM focus;
 * the options live in a top-layer popover `listbox` driven by ui-core's `createListbox`
 * (`aria-activedescendant`, typeahead, Home/End/PageUp/PageDown), dismissed by a stacked ui-core
 * dismiss layer and placed by `autoPosition`. It builds on `FormElement`: `name`, `value`,
 * `required`, `disabled` (also from a fieldset), validity, `form.reset()` back to the `value`
 * attribute.
 */
export abstract class SelectBase extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "placeholder",
    "invalid",
    "label",
    "aria-label",
    "aria-describedby",
    ...MATERIAL_ATTRIBUTES,
  ];
  /** Extra CSS of a variant, adopted after the shared sheet. */
  static css: string | undefined;
  static icon = "";

  readonly #trigger: HTMLButtonElement;
  readonly #label: HTMLElement;
  readonly #popup: HTMLElement;
  readonly #list: HTMLElement;
  readonly #listbox: Listbox;
  readonly #material: Material;
  #model: Entry[] = [];
  #data: Entry[] | undefined;
  #observer: MutationObserver | undefined;
  #open = false;
  #stopPosition: (() => void) | undefined;
  #stopDismiss: (() => void) | undefined;
  #cancelExit: (() => void) | undefined;

  constructor() {
    super();
    const ctor = this.constructor as typeof SelectBase;
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    if (ctor.css) adoptStyles(root, ctor.css);
    const id = uid("select");
    root.innerHTML =
      `<button part="trigger" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}"><span part="value"></span>${ctor.icon}</button>` +
      `<div part="popup" ${hasPopover() ? 'popover="manual"' : "hidden"}><div part="list" role="listbox" id="${id}"></div></div>`;
    this.#trigger = root.querySelector("button") as HTMLButtonElement;
    this.#label = root.querySelector("[part=value]") as HTMLElement;
    this.#popup = root.querySelector("[part=popup]") as HTMLElement;
    this.#list = root.querySelector("[part=list]") as HTMLElement;
    this.#material = new Material(
      this,
      () => this.#popup,
      () => root,
    );

    // Registered before the listbox so the closed-state keys never reach it.
    this.#trigger.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.#trigger.addEventListener("keyup", (event) => {
      if (event.key === " ") event.preventDefault();
    });
    this.#trigger.addEventListener("click", () => (this.#open ? this.hide() : this.show()));
    this.#listbox = createListbox(this.#list, {
      controller: this.#trigger,
      onChoose: (_option, value) => {
        this.commit(value);
        this.hide();
      },
    });
  }

  get open(): boolean {
    return this.#open;
  }

  /** Data-driven options; when set they replace the `<option>` and `<optgroup>` children. */
  get options(): (SelectOption | SelectGroup)[] | undefined {
    return this.#data;
  }
  set options(options: (SelectOption | SelectGroup)[] | undefined) {
    this.#data = options;
    this.#rebuild();
  }

  /** The trigger button (the element that holds focus). */
  get trigger(): HTMLButtonElement {
    return this.#trigger;
  }

  override get value(): string {
    return super.value;
  }
  /** Like a native select, a value that matches no option leaves nothing selected. */
  override set value(value: string) {
    const flat = this.#flat();
    super.value = flat.length === 0 || flat.some((option) => option.value === value) ? value : "";
  }

  override get defaultValue(): string {
    const attribute = this.getAttribute("value");
    if (attribute !== null) return attribute;
    const flat = this.#flat();
    const selected = flat.find((option) => (option as { selected?: boolean }).selected);
    if (selected) return selected.value;
    if (this.hasAttribute("placeholder")) return "";
    return flat.find((option) => !option.disabled)?.value ?? "";
  }

  override connectedCallback(): void {
    this.#observer ??= new MutationObserver((records) => {
      const relevant = records.some(
        (record) => !(record.type === "attributes" && record.target === this),
      );
      if (relevant) this.#rebuild();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["value", "disabled", "label", "selected"],
    });
    this.#parse();
    super.connectedCallback();
    this.#material.sync();
    queueMicrotask(() => this.#rebuild());
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#material.stop();
    this.#cancelExit?.();
    this.#cancelExit = undefined;
    this.#open = false;
    this.#teardown();
    this.#popup.dataset.state = "closed";
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#popupHide();
  }

  override attributeChangedCallback(name: string, old?: string | null, next?: string | null): void {
    if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) {
      this.#material.sync();
      return;
    }
    super.attributeChangedCallback(name, old, next);
  }

  show(): void {
    if (this.#open || this.disabled) return;
    this.#cancelExit?.();
    this.#cancelExit = undefined;
    this.#open = true;
    const popup = this.#popup;
    popup.style.minWidth = `${this.#trigger.offsetWidth}px`;
    if (hasPopover()) {
      if (!popup.matches(":popover-open")) popup.showPopover();
    } else popup.hidden = false;
    this.#stopPosition = autoPosition(this.#trigger, popup, {
      side: "bottom",
      align: "start",
      sideOffset: 4,
      collisionPadding: 8,
    });
    this.#stopDismiss = createDismissLayer(popup, {
      onDismiss: () => this.hide(),
      inside: () => [this.#trigger],
      onFocusOutside: (event) => event.preventDefault(),
    });
    popup.dataset.state = "open";
    this.#trigger.setAttribute("aria-expanded", "true");
    const selected = this.#list.querySelector<HTMLElement>("[role=option][aria-selected=true]");
    this.#listbox.setActive(selected ?? undefined);
    if (!this.#listbox.active) this.#listbox.setActive(this.#listbox.options()[0]);
    emit(this, "open");
  }

  hide(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#teardown();
    this.#popup.dataset.state = "closed";
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#cancelExit = waitForExit(this.#popup, () => {
      this.#cancelExit = undefined;
      this.#popupHide();
    });
    emit(this, "close");
  }

  #teardown(): void {
    this.#stopDismiss?.();
    this.#stopDismiss = undefined;
    this.#listbox.setActive(undefined);
  }

  #popupHide(): void {
    this.#stopPosition?.();
    this.#stopPosition = undefined;
    if (this.#open) return;
    if (hasPopover()) {
      if (this.#popup.matches(":popover-open")) this.#popup.hidePopover();
    } else this.#popup.hidden = true;
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (this.#open) {
      if (event.key === "Tab") this.hide();
      return;
    }
    if (OPEN_KEYS.has(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.show();
    } else if (event.key.length === 1) this.show();
  }

  // --- options -----------------------------------------------------------------------------

  #flat(): SelectOption[] {
    return this.#model.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
  }

  #parse(): void {
    if (this.#data) {
      this.#model = this.#data;
      return;
    }
    const read = (option: HTMLOptionElement) => ({
      value: option.getAttribute("value") ?? (option.textContent ?? "").trim(),
      label: option.label || (option.textContent ?? "").trim(),
      disabled: option.disabled,
      selected: option.hasAttribute("selected"),
    });
    const model: Entry[] = [];
    for (const child of this.children) {
      if (child instanceof HTMLOptionElement) model.push(read(child));
      else if (child instanceof HTMLOptGroupElement)
        model.push({
          label: child.label,
          options: [...child.children]
            .filter((node): node is HTMLOptionElement => node instanceof HTMLOptionElement)
            .map(read),
        });
    }
    this.#model = model;
  }

  /** Re-reads the options, redraws the list, then lets a non-dirty value fall back to the default. */
  #rebuild(): void {
    this.#parse();
    this.#renderList();
    this.attributeChangedCallback("value");
    this.#fallBackToAnOption();
  }

  /** A value whose option is gone falls back like a native select: the default, else the first enabled option. */
  #fallBackToAnOption(): void {
    const flat = this.#flat();
    const current = this.value;
    if (flat.length === 0 || current === "" || flat.some((option) => option.value === current))
      return;
    const candidates = [this.defaultValue, flat.find((option) => !option.disabled)?.value];
    this.value = candidates.find((value) => flat.some((option) => option.value === value)) ?? "";
  }

  #renderList(): void {
    const option = (entry: SelectOption) => {
      const node = document.createElement("div");
      node.setAttribute("role", "option");
      node.setAttribute("part", "option");
      node.dataset.value = entry.value;
      node.dataset.textValue = entry.label;
      if (entry.disabled) node.setAttribute("aria-disabled", "true");
      node.innerHTML = `<span part="option-label"></span>${CHECK}`;
      (node.firstElementChild as HTMLElement).textContent = entry.label;
      return node;
    };
    const nodes = this.#model.map((entry) => {
      if (!isGroup(entry)) return option(entry);
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      group.setAttribute("part", "group");
      const heading = document.createElement("div");
      heading.setAttribute("part", "group-label");
      heading.id = uid("select-group");
      heading.textContent = entry.label;
      group.setAttribute("aria-labelledby", heading.id);
      group.append(heading, ...entry.options.map(option));
      return group;
    });
    this.#list.replaceChildren(...nodes);
    this.#listbox.refresh();
  }

  protected override update(): void {
    this.#trigger.disabled = this.disabled;
    if (this.disabled && this.#open) this.hide();
    syncControlAria(this, this.#trigger, this.internals.labels as NodeListOf<HTMLLabelElement>);
    super.update();
    if (this.value === "" && this.#flat().some((option) => option.value === ""))
      this.internals.setFormValue("");
  }

  protected render(): void {
    const chosen = this.#flat().find((option) => option.value === this.value);
    const placeholder = this.getAttribute("placeholder");
    const empty = !chosen || this.value === "";
    this.#label.textContent = empty ? (placeholder ?? chosen?.label ?? "") : chosen.label;
    this.#label.toggleAttribute("data-placeholder", empty && placeholder !== null);
    this.#listbox.setValue([this.value]);
    if (this.#open) {
      const selected = this.#list.querySelector<HTMLElement>("[role=option][aria-selected=true]");
      if (selected) this.#listbox.setActive(selected);
    }
  }

  protected override validate() {
    const problem = super.validate();
    return problem ? { ...problem, anchor: this.#trigger } : undefined;
  }
}
