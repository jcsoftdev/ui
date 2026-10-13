import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  ensureId,
  isPart,
  rootOf,
} from "../internal/base.js";
import css from "./tabs.css.js";

const partsOf = (root: Element, part: string): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>("*")].filter(
    (element) => isPart(element, part) && element.closest("[data-ui='tabs']") === root,
  );

/** Tells the owning `<ui-tabs>` to re-render; remembers it so a removal can tell it too. */
class TabsPart extends ElementBase {
  #owner: Element | null = null;
  protected notify(): void {
    this.#owner = this.closest("[data-ui='tabs']") ?? this.#owner;
    this.#owner?.dispatchEvent(new Event("ui-tabs-change"));
  }
  disconnectedCallback(): void {
    this.#owner?.dispatchEvent(new Event("ui-tabs-change"));
    this.#owner = null;
  }
}

/** `<ui-tab value="x">`: one tab of a `<ui-tab-list>`. Attributes: `value`, `disabled`. */
export class UiTab extends TabsPart {
  static observedAttributes = ["disabled", "value"];
  connectedCallback(): void {
    this.setAttribute("role", "tab");
    this.notify();
  }
  attributeChangedCallback(): void {
    this.notify();
  }
}

/** `<ui-tab-list>`: the row of tabs (`role="tablist"`). */
export class UiTabList extends ElementBase {
  connectedCallback(): void {
    this.setAttribute("role", "tablist");
  }
}

/** `<ui-tab-panel value="x">`: the content of the tab with the same `value`. */
export class UiTabPanel extends TabsPart {
  static observedAttributes = ["value"];
  connectedCallback(): void {
    this.setAttribute("role", "tabpanel");
    this.notify();
  }
  attributeChangedCallback(): void {
    this.notify();
  }
}

/**
 * `<ui-tabs>`: tabs with the WAI-ARIA tabs pattern in light DOM. Children: one `<ui-tab-list>` of
 * `<ui-tab value>` and a `<ui-tab-panel value>` per tab. One tab stop; arrow keys (Home/End) move
 * between tabs, and with `activation="automatic"` (default) focus selects; with `"manual"`,
 * Enter/Space or a click does. Attributes: `value` (default: the first enabled tab), `activation`,
 * `orientation` (horizontal | vertical). Fires `change` when the user selects another tab.
 */
export class UiTabs extends ElementBase {
  static observedAttributes = ["value", "orientation"];
  #value: string | null = null;
  #roving: RovingFocus | undefined;

  constructor() {
    super();
    this.addEventListener("ui-tabs-change", () => this.#render());
    this.addEventListener("click", (event) => {
      const tab = this.#tabFor(event.target);
      if (tab) this.#select(tab, true);
    });
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const tab = this.#tabFor(event.target);
      if (!tab) return;
      event.preventDefault();
      this.#select(tab, true);
    });
  }

  get value(): string | null {
    return this.#value;
  }
  set value(value: string | null) {
    this.#value = value;
    this.#render();
  }

  connectedCallback(): void {
    this.dataset.ui = "tabs";
    adoptStyles(rootOf(this), css);
    this.#value ??= this.getAttribute("value");
    const list = partsOf(this, "tab-list")[0];
    if (list && !this.#roving) {
      this.#roving = createRovingFocus(list, {
        items: () => this.#tabs(),
        orientation: this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal",
        isDisabled: (item) => item.hasAttribute("disabled"),
        onNavigate: (tab) => {
          if (this.getAttribute("activation") !== "manual") this.#select(tab as HTMLElement, true);
        },
      });
    }
    this.#render();
  }

  disconnectedCallback(): void {
    this.#roving?.destroy();
    this.#roving = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "value") this.#value = this.getAttribute("value");
    if (name === "orientation" && this.#roving) {
      this.#roving.destroy();
      this.#roving = undefined;
      if (this.isConnected) this.connectedCallback();
      return;
    }
    this.#render();
  }

  #tabs(): HTMLElement[] {
    return partsOf(this, "tab");
  }

  #tabFor(target: EventTarget | null): HTMLElement | undefined {
    const tab = (target as Element | null)?.closest?.("[role='tab']");
    return this.#tabs().find((item) => item === tab);
  }

  #select(tab: HTMLElement, user: boolean): void {
    if (tab.hasAttribute("disabled")) return;
    const value = tab.getAttribute("value");
    if (value === this.#value) return;
    this.#value = value;
    this.#render();
    if (user) emit(this, "change", { value });
  }

  #render(): void {
    const tabs = this.#tabs();
    const panels = partsOf(this, "tab-panel");
    const list = partsOf(this, "tab-list")[0];
    const orientation = this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
    list?.setAttribute("aria-orientation", orientation);
    const enabled = tabs.filter((tab) => !tab.hasAttribute("disabled"));
    // A missing or disabled value falls back to the first enabled tab.
    if (!enabled.some((tab) => tab.getAttribute("value") === this.#value))
      this.#value = enabled[0]?.getAttribute("value") ?? null;
    let active: HTMLElement | undefined;
    for (const tab of tabs) {
      const value = tab.getAttribute("value");
      const selected = value === this.#value;
      if (selected) active = tab;
      const panel = panels.find((item) => item.getAttribute("value") === value);
      tab.setAttribute("aria-selected", String(selected));
      tab.dataset.state = selected ? "active" : "inactive";
      if (tab.hasAttribute("disabled")) tab.setAttribute("aria-disabled", "true");
      else tab.removeAttribute("aria-disabled");
      if (panel) {
        tab.setAttribute("aria-controls", ensureId(panel, "tab-panel"));
        panel.setAttribute("aria-labelledby", ensureId(tab, "tab"));
      }
    }
    for (const panel of panels) {
      const selected = panel.getAttribute("value") === this.#value;
      panel.hidden = !selected;
      panel.dataset.state = selected ? "active" : "inactive";
      panel.tabIndex = 0;
    }
    this.#roving?.setActive(active);
  }
}

/** Registers `<ui-tabs>`, `<ui-tab-list>`, `<ui-tab>` and `<ui-tab-panel>`; returns the tabs tag. */
export function defineTabs(options?: DefineOptions): string {
  defineElement("tab", UiTab, options);
  defineElement("tab-list", UiTabList, options);
  defineElement("tab-panel", UiTabPanel, options);
  return defineElement("tabs", UiTabs, options);
}
