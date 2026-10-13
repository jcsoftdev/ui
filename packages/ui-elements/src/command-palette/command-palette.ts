import { commandScore } from "@jcsoftdev/ui-core/command-score";
import { createListbox, type Listbox } from "@jcsoftdev/ui-core/listbox";
import { waitForExit } from "@jcsoftdev/ui-core/presence";
import { lockScroll } from "@jcsoftdev/ui-core/scroll-lock";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  onCommand,
  rootOf,
  uid,
} from "../internal/base.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./command-palette.css.js";

export interface CommandPaletteItem {
  id: string;
  label: string;
  group?: string;
  /** Text (an emoji) or a node, shown before the label. */
  icon?: string | Node;
  /** Secondary text at the end of the row. */
  hint?: string;
  /** Extra terms that match this item when filtering. */
  keywords?: string[];
  onSelect?: () => void;
}

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

/**
 * `<ui-command-palette>`: a global search and command palette in a modal dialog (native
 * `<dialog>.showModal()`: top layer, inert page, scroll locked). A `role="combobox"` search input
 * keeps focus while ui-core's `createListbox` drives the `role="listbox"` of results through
 * `aria-activedescendant`: fuzzy ranking (`commandScore`), groups that hide when empty, ArrowUp
 * and ArrowDown (Ctrl+N/P/J/K too), Home/End, Enter to run, an empty state and a polite live
 * region with the result count. Escape and a press on the backdrop close it.
 *
 * Items: the `items` property (`CommandPaletteItem[]`: `id`, `label`, `group`, `icon`, `hint`,
 * `keywords`, `onSelect`) or `<ui-command-palette-item value="id" group hint keywords>Label
 * </ui-command-palette-item>` children. Attributes: `open`, `label` (accessible name), `placeholder`,
 * `empty-label`, `close-key-label` (default "Esc"), `result-label` (`"{count} results"`), `query`
 * (the search text), `material` and the `liquid-*` options. Property: `formatResultCount(count)`.
 * Open it with `show()`, the `open` attribute or an invoker (`<button commandfor="id"
 * command="--open">`; `--close`, `--toggle`). Events: `open`, `close`, and a cancelable `select`
 * (`{ id, item }`) before an item runs and the palette closes. The input's own `input` event
 * bubbles.
 */
export class UiCommandPalette extends ElementBase {
  static observedAttributes = [
    "open",
    "label",
    "placeholder",
    "empty-label",
    "close-key-label",
    "result-label",
    "query",
    ...MATERIAL_ATTRIBUTES,
  ];

  /** Formats the polite result count; overrides `result-label`. */
  formatResultCount: ((count: number) => string) | undefined;

  #panel: HTMLDialogElement | undefined;
  #input!: HTMLInputElement;
  #list!: HTMLElement;
  #empty!: HTMLElement;
  #count!: HTMLElement;
  #keyHint!: HTMLElement;
  #listbox: Listbox | undefined;
  #material = new Material(this, () => this.#panel ?? null);
  #items: CommandPaletteItem[] | undefined;
  #observer: MutationObserver | undefined;
  #shown = false;
  #unlock: (() => void) | undefined;
  #cancelExit: (() => void) | undefined;
  #fallback: (() => void) | undefined;
  #returnFocus: HTMLElement | null = null;
  #pressedBackdrop = false;
  #ownCloses = 0;

  constructor() {
    super();
    onCommand(this, (command) => {
      if (command === "--open") this.show();
      else if (command === "--close") this.close();
      else if (command === "--toggle") this.toggle();
    });
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }
  set open(value: boolean) {
    this.toggleAttribute("open", value);
  }

  get items(): CommandPaletteItem[] | undefined {
    return this.#items;
  }
  set items(items: CommandPaletteItem[] | undefined) {
    this.#items = items;
    this.#renderItems();
  }

  get query(): string {
    return this.#input?.value ?? this.getAttribute("query") ?? "";
  }
  set query(value: string) {
    this.setAttribute("query", value);
  }

  show(): void {
    this.open = true;
  }
  close(): void {
    this.open = false;
  }
  toggle(): void {
    this.open = !this.open;
  }

  connectedCallback(): void {
    this.dataset.ui = "command-palette";
    adoptStyles(rootOf(this), css);
    this.#panel ??= this.#build();
    this.#observer ??= new MutationObserver((records) => {
      const own = this.#panel;
      if (
        !this.#items &&
        records.some((record) => record.target !== this && !own?.contains(record.target))
      )
        this.#renderItems();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    this.#renderItems();
    this.#syncText();
    this.#sync();
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#hide(false);
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#panel) return;
    if (name === "open") this.#sync();
    else if (name === "query") this.#applyQuery(this.getAttribute("query") ?? "");
    else if (name === "result-label") this.#updateResults();
    else if (MATERIAL_ATTRIBUTES.includes(name as (typeof MATERIAL_ATTRIBUTES)[number]))
      this.#material.sync();
    else this.#syncText();
  }

  #build(): HTMLDialogElement {
    const listId = uid("palette-list");
    const panel = document.createElement("dialog");
    panel.dataset.uiPart = "panel";
    panel.innerHTML =
      `<div data-ui-part="header"><span data-ui-part="search-icon" aria-hidden="true">${SEARCH_ICON}</span>` +
      `<input data-ui-part="input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="${listId}">` +
      `<span data-ui-part="close-key" aria-hidden="true"></span></div>` +
      `<span data-ui-part="results" aria-live="polite"></span>` +
      `<div data-ui-part="list" role="listbox" id="${listId}"></div>` +
      `<div data-ui-part="empty" hidden></div>`;
    this.append(panel);
    const part = (name: string) => panel.querySelector(`[data-ui-part="${name}"]`) as HTMLElement;
    this.#input = part("input") as HTMLInputElement;
    this.#list = part("list");
    this.#empty = part("empty");
    this.#count = part("results");
    this.#keyHint = part("close-key");
    this.#listbox = createListbox(this.#list, {
      controller: this.#input,
      filter: commandScore,
      sort: true,
      vimBindings: true,
      typeahead: false,
      onChoose: (_option, id) => this.#run(id),
    });
    this.#input.addEventListener("input", () => this.#applyQuery(this.#input.value, false));

    panel.addEventListener("cancel", (event) => {
      if (event.target !== panel) return;
      event.preventDefault();
      this.close();
    });
    panel.addEventListener("close", (event) => {
      if (event.target !== panel) return;
      if (this.#ownCloses > 0) {
        this.#ownCloses--;
        return;
      }
      if (!this.#shown) return;
      this.open = false;
      this.#hide(true);
    });
    panel.addEventListener("pointerdown", (event) => {
      this.#pressedBackdrop = this.#onBackdrop(event);
    });
    panel.addEventListener("click", (event) => {
      const backdrop = this.#pressedBackdrop && this.#onBackdrop(event);
      this.#pressedBackdrop = false;
      if (backdrop) this.close();
    });
    return panel;
  }

  #onBackdrop(event: MouseEvent): boolean {
    if (event.target !== this.#panel || !this.#panel) return false;
    const box = this.#panel.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
  }

  #syncText(): void {
    const panel = this.#panel;
    if (!panel) return;
    const label = this.getAttribute("label") ?? "Command palette";
    panel.setAttribute("aria-label", label);
    this.#input.setAttribute("aria-label", label);
    this.#input.placeholder = this.getAttribute("placeholder") ?? "";
    this.#empty.textContent = this.getAttribute("empty-label") ?? "No results.";
    this.#keyHint.textContent = this.getAttribute("close-key-label") ?? "Esc";
    this.#updateResults();
  }

  /** Items from the property, else from `<ui-command-palette-item>` children. */
  #collect(): CommandPaletteItem[] {
    if (this.#items) return this.#items;
    return Array.from(this.children)
      .filter((child) => child !== this.#panel && child.localName.endsWith("-command-palette-item"))
      .map((child) => ({
        id: child.getAttribute("value") ?? (child.textContent ?? "").trim(),
        label: (child.textContent ?? "").trim(),
        group: child.getAttribute("group") ?? undefined,
        hint: child.getAttribute("hint") ?? undefined,
        keywords: (child.getAttribute("keywords") ?? "").split(/\s+/).filter(Boolean),
        icon: child.getAttribute("icon") ?? undefined,
      }));
  }

  #renderItems(): void {
    if (!this.#listbox) return;
    const row = (item: CommandPaletteItem) => {
      const option = document.createElement("div");
      option.setAttribute("role", "option");
      option.dataset.uiPart = "item";
      option.dataset.value = item.id;
      option.dataset.keywords = [item.label, item.hint ?? "", ...(item.keywords ?? [])].join(" ");
      if (item.icon) {
        const icon = document.createElement("span");
        icon.dataset.uiPart = "item-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.append(item.icon);
        option.append(icon);
      }
      const label = document.createElement("span");
      label.dataset.uiPart = "item-label";
      label.textContent = item.label;
      option.append(label);
      if (item.hint) {
        const hint = document.createElement("span");
        hint.dataset.uiPart = "item-hint";
        hint.textContent = item.hint;
        option.append(hint);
      }
      return option;
    };
    const groups = new Map<string, CommandPaletteItem[]>();
    for (const item of this.#collect()) {
      const key = item.group ?? "";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const nodes: Node[] = [];
    for (const [name, items] of groups) {
      if (name === "") {
        nodes.push(...items.map(row));
        continue;
      }
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      group.dataset.uiPart = "group";
      const heading = document.createElement("div");
      heading.dataset.uiPart = "group-heading";
      heading.id = uid("palette-group");
      heading.textContent = name;
      group.setAttribute("aria-labelledby", heading.id);
      group.append(heading, ...items.map(row));
      nodes.push(group);
    }
    const activeValue = this.#listbox.active?.dataset.value;
    this.#list.replaceChildren(...nodes);
    this.#listbox.refresh();
    if (activeValue !== undefined)
      this.#listbox.setActive(
        this.#listbox.options().find((node) => node.dataset.value === activeValue),
      );
    this.#updateResults();
  }

  #applyQuery(value: string, writeInput = true): void {
    if (writeInput && this.#input.value !== value) this.#input.value = value;
    this.#listbox?.setSearch(value);
    this.#updateResults();
  }

  #updateResults(): void {
    const count = this.#listbox?.count ?? 0;
    const template = this.getAttribute("result-label") ?? "{count} results";
    const text = this.formatResultCount
      ? this.formatResultCount(count)
      : template.replace("{count}", String(count));
    if (this.#count.textContent !== text) this.#count.textContent = text;
    this.#empty.hidden = count > 0;
  }

  #run(id: string): void {
    const item = this.#collect().find((entry) => entry.id === id);
    this.#listbox?.setValue([]);
    if (!item) return;
    if (!emit(this, "select", { id, item }, true)) return;
    item.onSelect?.();
    this.close();
  }

  #sync(): void {
    const panel = this.#panel;
    if (!panel) return;
    if (this.open && this.isConnected && !this.#shown) {
      this.#cancelExit?.();
      this.#cancelExit = undefined;
      this.#returnFocus = document.activeElement as HTMLElement | null;
      this.#applyQuery(this.getAttribute("query") ?? "");
      if (typeof panel.showModal === "function") {
        if (!panel.open) panel.showModal();
      } else this.#showFallback(panel);
      this.#shown = true;
      panel.dataset.state = "open";
      this.#unlock = lockScroll();
      this.#input.focus({ preventScroll: true });
      this.#listbox?.refresh();
      emit(this, "open");
    } else if (!this.open && this.#shown) {
      this.#hide(true);
    }
  }

  #hide(notify: boolean): void {
    const panel = this.#panel;
    if (!panel || !this.#shown) return;
    this.#shown = false;
    this.#unlock?.();
    this.#unlock = undefined;
    const finish = () => {
      this.#cancelExit = undefined;
      if (panel.open) {
        this.#ownCloses++;
        panel.close();
      }
      this.#fallback?.();
      this.#fallback = undefined;
    };
    if (notify && this.isConnected) {
      panel.dataset.state = "closed";
      this.#cancelExit = waitForExit(panel, finish);
    } else finish();
    if (!this.hasAttribute("query")) this.#applyQuery("");
    if (this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    this.#returnFocus = null;
    if (notify) emit(this, "close");
  }

  /** Engines without `showModal()`: an `open` dialog with the page hidden and a dismiss layer. */
  #showFallback(panel: HTMLDialogElement): void {
    panel.setAttribute("open", "");
    panel.dataset.uiFallback = "";
    let stopped = false;
    const stops: (() => void)[] = [];
    this.#fallback = () => {
      stopped = true;
      for (const stop of stops) stop();
      panel.removeAttribute("open");
    };
    Promise.all([
      import("@jcsoftdev/ui-core/hide-others"),
      import("@jcsoftdev/ui-core/dismiss"),
    ]).then(([{ hideOthers }, { createDismissLayer }]) => {
      if (stopped) return;
      stops.push(hideOthers([panel]));
      stops.push(createDismissLayer(panel, { onDismiss: () => this.close() }));
    });
  }
}

/** Declarative item of `<ui-command-palette>`; the palette reads its attributes and text. */
export class UiCommandPaletteItem extends ElementBase {}

/** Registers `<ui-command-palette>` and its item (or `<prefix-command-palette>`) and returns the tag. */
export function defineCommandPalette(options?: DefineOptions): string {
  defineElement("command-palette-item", UiCommandPaletteItem, options);
  return defineElement("command-palette", UiCommandPalette, options);
}
