import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  toggleAttr,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./segmented.css.js";

/** `<ui-segmented-item value="x">`: one option. Attributes: `value`, `disabled`. */
export class UiSegmentedItem extends ElementBase {
  static observedAttributes = ["disabled", "value"];
  #owner: Element | null = null;

  connectedCallback(): void {
    this.setAttribute("role", "radio");
    this.#notify();
  }

  disconnectedCallback(): void {
    this.#owner?.dispatchEvent(new Event("ui-segmented-change"));
    this.#owner = null;
  }

  attributeChangedCallback(): void {
    this.#notify();
  }

  #notify(): void {
    this.#owner = this.closest(this.localName.replace(/-item$/, "")) ?? this.#owner;
    this.#owner?.dispatchEvent(new Event("ui-segmented-change"));
  }
}

/**
 * `<ui-segmented>`: an exclusive selector for 2-4 options, in light DOM. Like the React kit it is
 * a `radiogroup` of `radio` items, and a click (or Space/Enter) on the selected item clears the
 * selection. One tab stop (on the selected item, else the first); arrows (Home/End) move focus
 * without selecting (as in the React kit, unlike native radios). Name it with `aria-label` or `aria-labelledby`.
 *
 * Attributes: `value` (empty or missing: nothing selected; React `value`/`defaultValue`),
 * `disabled` (every item), `roving="off"` (every item in the tab order instead of roving; React
 * `rovingFocus={false}`), `orientation` (`horizontal` | `vertical`), `loop="false"` (no wrap at the
 * ends; React `loop`). Direction follows `dir`. Items take `value` and `disabled`.
 * Events: `change` (`detail: { value }`) when the user picks or clears an item (React
 * `onValueChange`).
 */
export class UiSegmented extends ElementBase {
  static observedAttributes = ["value", "disabled", "roving", "orientation", "loop"];
  #value = "";
  #roving: RovingFocus | undefined;
  #children: MutationObserver | undefined;

  constructor() {
    super();
    this.addEventListener("ui-segmented-change", () => this.#render());
    this.addEventListener("click", (event) => {
      const item = this.#itemFor(event.target);
      if (item) this.#pick(item);
    });
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const item = this.#itemFor(event.target);
      if (!item) return;
      event.preventDefault();
      this.#pick(item);
    });
  }

  get value(): string {
    return this.#value;
  }
  set value(value: string) {
    this.#value = value;
    this.#render();
  }

  connectedCallback(): void {
    connectLight(this, "segmented", css);
    this.setAttribute("role", "radiogroup");
    this.#value = this.getAttribute("value") ?? this.#value;
    this.#mountRoving();
    this.#render();
    this.#children = new MutationObserver(() => this.#render());
    this.#children.observe(this, { childList: true });
  }

  disconnectedCallback(): void {
    this.#children?.disconnect();
    this.#roving?.destroy();
    this.#roving = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "value") this.#value = this.getAttribute("value") ?? "";
    if (name === "orientation" || name === "loop" || name === "roving") {
      this.#roving?.destroy();
      this.#roving = undefined;
      if (this.isConnected) this.#mountRoving();
    }
    this.#render();
  }

  get #disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  #items(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("*")].filter(
      (element) =>
        isPart(element, "segmented-item") && element.closest("[data-ui='segmented']") === this,
    );
  }

  #itemFor(target: EventTarget | null): HTMLElement | undefined {
    const item = (target as Element | null)?.closest?.("[role='radio']");
    return this.#items().find((candidate) => candidate === item);
  }

  #mountRoving(): void {
    if (this.#roving || this.getAttribute("roving") === "off") return;
    const orientation = this.getAttribute("orientation");
    this.#roving = createRovingFocus(this, {
      items: () => this.#items(),
      ...(orientation === "vertical" || orientation === "horizontal" ? { orientation } : {}),
      loop: this.getAttribute("loop") !== "false",
      isDisabled: (item) => this.#disabled || item.hasAttribute("disabled"),
    });
  }

  #pick(item: HTMLElement): void {
    if (this.#disabled || item.hasAttribute("disabled")) return;
    const value = item.getAttribute("value") ?? "";
    const next = value === this.#value ? "" : value;
    this.#value = next;
    this.#render();
    emit(this, "change", { value: next });
  }

  #render(): void {
    toggleAttr(this, "data-disabled", this.#disabled);
    if (this.#disabled) this.setAttribute("aria-disabled", "true");
    else this.removeAttribute("aria-disabled");
    const roving = this.getAttribute("roving") !== "off";
    let selected: HTMLElement | undefined;
    for (const item of this.#items()) {
      const on = this.#value !== "" && item.getAttribute("value") === this.#value;
      if (on) selected = item;
      const disabled = this.#disabled || item.hasAttribute("disabled");
      item.setAttribute("aria-checked", String(on));
      item.dataset.state = on ? "on" : "off";
      toggleAttr(item, "data-disabled", disabled);
      if (disabled) item.setAttribute("aria-disabled", "true");
      else item.removeAttribute("aria-disabled");
      if (!roving) item.tabIndex = disabled ? -1 : 0;
    }
    if (selected) this.#roving?.setActive(selected);
    else this.#roving?.update();
  }
}

/** Registers `<ui-segmented>` and `<ui-segmented-item>` (or the prefixed tags); returns the group tag. */
export function defineSegmented(options?: DefineOptions): string {
  const tag = defineElement("segmented", UiSegmented, options);
  defineElement("segmented-item", UiSegmentedItem, options);
  return tag;
}
