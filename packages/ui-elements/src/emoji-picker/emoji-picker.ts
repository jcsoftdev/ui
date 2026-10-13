import {
  type EmojiCategory,
  type EmojiEntry,
  gridMove,
  searchEmojis,
} from "@jcsoftdev/ui-core/emoji";
import type { VirtualList } from "@jcsoftdev/ui-core/virtual-list";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  ensureId,
  rootOf,
} from "../internal/base.js";
import css from "./emoji-picker.css.js";

/** A cell is 2rem wide and rows and columns are 2px apart, as in the React grid. */
const CELL = 32;
const GAP = 2;
const ROW = CELL + GAP;
const MOVE_KEYS = new Set([
  "ArrowRight",
  "ArrowLeft",
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

const label = (entry: EmojiEntry) => entry.name.split(" ").slice(0, 3).join(" ");

/**
 * `<ui-emoji-picker>`: an emoji panel with a search field, category buttons and a virtualised grid
 * (only the visible rows exist in the DOM). Grid pattern: one tab stop, arrows move by cell and
 * row, Home and End jump to the first and last emoji, PageUp and PageDown move a page, Enter or Space (the cell is a native
 * button) picks. Light DOM; it holds no portal, so it works inline or inside `<ui-popover>`.
 *
 * The emoji dataset (the React kit's curated set, Spanish names) is a separate chunk fetched with
 * `import()` the first time a picker connects without `categories`; a page that never renders a
 * picker, or always passes its own `categories`, never downloads it. Searching ignores case and
 * accents and matches every word of the query against the emoji's name and keywords.
 *
 * Attributes: `category` (initial category id), `placeholder` (search label, default "Buscar
 * emoji"), `categories-label` ("Categorías"), `results-label` ("Resultados") and `empty-label`
 * ("Sin resultados"). Property: `categories: EmojiCategory[]` replaces the dataset. Fires a
 * bubbling `emoji-select` with `detail: { emoji }` (not `select`, which is the native event of
 * a text field's selection). `focusSearch()` focuses the search field.
 */
export class UiEmojiPicker extends ElementBase {
  static observedAttributes = ["placeholder", "categories-label", "results-label", "empty-label"];

  #categories: EmojiCategory[] | undefined;
  #custom = false;
  #loading = false;
  #query = "";
  #categoryId: string | undefined;
  #entries: EmojiEntry[] = [];
  #active = 0;
  #columns = 1;
  #built = false;
  #input!: HTMLInputElement;
  #hint!: HTMLElement;
  #bar!: HTMLElement;
  #title!: HTMLElement;
  #grid!: HTMLElement;
  #rows!: HTMLElement;
  #empty!: HTMLElement;
  #list: VirtualList | undefined;
  #resize: ResizeObserver | undefined;
  readonly #rowEls = new Map<number, HTMLElement>();
  #lastWidth = 0;
  #barFor: EmojiCategory[] | undefined;

  get categories(): EmojiCategory[] | undefined {
    return this.#categories;
  }
  set categories(value: EmojiCategory[] | undefined) {
    this.#custom = value !== undefined;
    this.#categories = value;
    if (this.#built) {
      if (value) this.#reset();
      else this.#load();
    }
  }

  focusSearch(): void {
    this.#input?.focus({ preventScroll: true });
  }

  connectedCallback(): void {
    this.dataset.ui = "emoji-picker";
    adoptStyles(rootOf(this), css);
    if (!this.#built) this.#build();
    this.#labels();
    if (this.#categories) this.#reset();
    else this.#load();
  }

  disconnectedCallback(): void {
    this.#list?.destroy();
    this.#list = undefined;
    this.#resize?.disconnect();
    this.#resize = undefined;
    this.#rowEls.clear();
  }

  attributeChangedCallback(): void {
    if (this.#built) this.#labels();
  }

  get #category(): EmojiCategory | undefined {
    const all = this.#categories ?? [];
    return all.find((entry) => entry.id === this.#categoryId) ?? all[0];
  }

  get #searching(): boolean {
    return this.#query.trim().length > 0;
  }

  #build(): void {
    this.#built = true;
    const id = ensureId(this, "emoji-picker");
    this.replaceChildren();
    const search = document.createElement("label");
    search.dataset.uiPart = "search";
    this.#hint = document.createElement("span");
    this.#hint.dataset.uiPart = "hint";
    const icon = document.createElement("span");
    icon.dataset.uiPart = "icon";
    icon.innerHTML = SEARCH_ICON;
    this.#input = document.createElement("input");
    this.#input.type = "search";
    this.#input.dataset.uiPart = "input";
    this.#input.addEventListener("input", () => {
      this.#query = this.#input.value;
      this.#active = 0;
      this.#reset();
    });
    // The text field's own `select` event must not read as a pick from the host.
    this.#input.addEventListener("select", (event) => event.stopPropagation());
    // Inside a <form> Enter must not submit it: the picker is not a field.
    this.#input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    search.append(this.#hint, icon, this.#input);

    this.#bar = document.createElement("div");
    this.#bar.dataset.uiPart = "categories";
    this.#bar.setAttribute("role", "toolbar");
    this.#bar.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("button[data-category]");
      if (!button) return;
      this.#categoryId = button.dataset.category;
      this.#active = 0;
      this.#reset();
    });

    this.#title = document.createElement("p");
    this.#title.dataset.uiPart = "title";
    this.#title.id = `${id}-title`;

    this.#grid = document.createElement("div");
    this.#grid.dataset.uiPart = "grid";
    this.#grid.setAttribute("role", "grid");
    this.#grid.setAttribute("aria-labelledby", this.#title.id);
    this.#rows = document.createElement("div");
    this.#rows.dataset.uiPart = "rows";
    this.#rows.setAttribute("role", "rowgroup");
    this.#grid.append(this.#rows);
    this.#grid.addEventListener("keydown", (event) => this.#onKey(event));
    this.#grid.addEventListener("focusin", (event) => {
      const cell = (event.target as Element).closest<HTMLElement>("[data-index]");
      if (!cell) return;
      this.#active = Number(cell.dataset.index);
      this.#tabStops();
    });
    this.#grid.addEventListener("click", (event) => {
      const cell = (event.target as Element).closest<HTMLElement>("[data-index]");
      const entry = cell ? this.#entries[Number(cell.dataset.index)] : undefined;
      if (entry) emit(this, "emoji-select", { emoji: entry.emoji });
    });

    this.#empty = document.createElement("p");
    this.#empty.dataset.uiPart = "empty";
    this.#empty.setAttribute("role", "status");
    this.#empty.hidden = true;
    this.append(search, this.#bar, this.#title, this.#grid, this.#empty);
  }

  #labels(): void {
    const text = this.getAttribute("placeholder") ?? "Buscar emoji";
    this.#hint.textContent = text;
    this.#input.placeholder = text;
    this.#bar.setAttribute("aria-label", this.getAttribute("categories-label") ?? "Categorías");
    this.#empty.textContent = this.getAttribute("empty-label") ?? "Sin resultados";
    if (this.#categories) this.#renderTitle();
  }

  /** Fetches the built-in dataset and the virtual list in parallel; neither ships in the entry. */
  #load(): void {
    if (this.#loading || this.#custom) return;
    this.#loading = true;
    this.setAttribute("aria-busy", "true");
    import("./emoji-data.js")
      .then(({ EMOJI_CATEGORIES }) => {
        this.#loading = false;
        if (!this.#custom) this.#categories = EMOJI_CATEGORIES;
        if (this.isConnected) this.#reset();
      })
      .catch(() => {
        // A failed chunk fetch is retried by the next connect or by setting `categories`.
        this.#loading = false;
        this.removeAttribute("aria-busy");
      });
  }

  /** Rebuilds the category buttons, the entries and the grid after the data or the query changed. */
  #reset(): void {
    const categories = this.#categories;
    if (!categories) return;
    this.removeAttribute("aria-busy");
    this.#categoryId ??= this.getAttribute("category") ?? categories[0]?.id;
    this.#entries = this.#searching
      ? searchEmojis(categories, this.#query)
      : (this.#category?.emojis ?? []);
    this.#active = Math.min(this.#active, Math.max(0, this.#entries.length - 1));
    this.#renderBar(categories);
    this.#renderTitle();
    this.#empty.hidden = this.#entries.length > 0;
    this.#grid.hidden = this.#entries.length === 0;
    this.#grid.scrollTop = 0;
    this.#setup();
  }

  #renderBar(categories: EmojiCategory[]): void {
    this.#bar.hidden = this.#searching;
    if (this.#searching) return;
    // The buttons are kept while the data is the same, so a press never drops keyboard focus.
    if (this.#barFor !== categories) {
      this.#barFor = categories;
      this.#bar.replaceChildren(
        ...categories.map((category) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.category = category.id;
          button.title = category.label;
          button.setAttribute("aria-label", category.label);
          const icon = document.createElement("span");
          icon.setAttribute("aria-hidden", "true");
          icon.textContent = category.icon;
          button.append(icon);
          return button;
        }),
      );
    }
    const current = this.#category;
    for (const button of this.#bar.querySelectorAll<HTMLElement>("button[data-category]"))
      button.setAttribute("aria-pressed", String(button.dataset.category === current?.id));
  }

  #renderTitle(): void {
    this.#title.textContent = this.#searching
      ? `${this.getAttribute("results-label") ?? "Resultados"} (${this.#entries.length})`
      : (this.#category?.label ?? "");
  }

  #setup(): void {
    this.#rowEls.clear();
    this.#rows.replaceChildren();
    this.#measure();
    if (this.#list) {
      this.#list.update();
      this.#renderRows();
      return;
    }
    import("@jcsoftdev/ui-core/virtual-list").then(({ createVirtualList }) => {
      if (this.#list || !this.isConnected) return;
      this.#list = createVirtualList(this.#grid, {
        count: () => Math.ceil(this.#entries.length / this.#columns),
        rowHeight: ROW,
        overscan: 2,
        onChange: () => this.#renderRows(),
      });
      this.#resize = new ResizeObserver(() => {
        const width = this.#grid.clientWidth;
        if (width === this.#lastWidth) return;
        this.#lastWidth = width;
        const before = this.#columns;
        this.#measure();
        if (this.#columns === before) return;
        this.#rowEls.clear();
        this.#rows.replaceChildren();
        this.#list?.update();
        this.#renderRows();
      });
      this.#resize.observe(this.#grid);
      this.#renderRows();
    });
  }

  #measure(): void {
    const width = this.#grid.clientWidth;
    this.#columns = Math.max(1, Math.floor((width + GAP) / ROW));
    this.#rows.style.setProperty("--ui-emoji-columns", String(this.#columns));
    this.#grid.setAttribute("aria-colcount", String(this.#columns));
    this.#grid.setAttribute(
      "aria-rowcount",
      String(Math.ceil(this.#entries.length / this.#columns)),
    );
  }

  /** Renders the rows of the current window, reusing the ones that stay (focus survives a scroll). */
  #renderRows(): void {
    const list = this.#list;
    if (!list) return;
    const { start, end, padTop, padBottom } = list.window;
    this.#grid.setAttribute(
      "aria-rowcount",
      String(Math.ceil(this.#entries.length / this.#columns)),
    );
    this.#rows.style.paddingTop = `${padTop}px`;
    this.#rows.style.paddingBottom = `${padBottom}px`;
    for (const [index, element] of this.#rowEls) {
      if (index >= start && index < end) continue;
      element.remove();
      this.#rowEls.delete(index);
    }
    for (let index = start; index < end; index++) {
      if (this.#rowEls.has(index)) continue;
      const row = this.#buildRow(index);
      let before: HTMLElement | null = null;
      for (const [other, element] of this.#rowEls)
        if (other > index && (!before || other < Number(before.dataset.row))) before = element;
      this.#rows.insertBefore(row, before);
      this.#rowEls.set(index, row);
    }
    this.#tabStops();
  }

  #buildRow(index: number): HTMLElement {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.setAttribute("aria-rowindex", String(index + 1));
    row.dataset.row = String(index);
    const first = index * this.#columns;
    for (let at = first; at < Math.min(first + this.#columns, this.#entries.length); at++) {
      const entry = this.#entries[at] as EmojiEntry;
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-colindex", String(at - first + 1));
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(at);
      button.title = label(entry);
      button.setAttribute("aria-label", label(entry));
      const glyph = document.createElement("span");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = entry.emoji;
      button.append(glyph);
      cell.append(button);
      row.append(cell);
    }
    return row;
  }

  /** One tab stop: the active cell, or the first rendered one while the active row is scrolled out. */
  #tabStops(): void {
    const cells = [...this.#rows.querySelectorAll<HTMLElement>("button[data-index]")];
    const target = cells.find((cell) => Number(cell.dataset.index) === this.#active) ?? cells[0];
    for (const cell of cells) cell.tabIndex = cell === target ? 0 : -1;
  }

  #onKey(event: KeyboardEvent): void {
    if (!MOVE_KEYS.has(event.key)) return;
    event.preventDefault();
    const page = this.#columns * Math.max(1, Math.floor(this.#grid.clientHeight / ROW) - 1);
    const last = this.#entries.length - 1;
    const next =
      event.key === "PageDown"
        ? Math.min(last, this.#active + page)
        : event.key === "PageUp"
          ? Math.max(0, this.#active - page)
          : gridMove(event.key, this.#active, this.#columns, this.#entries.length);
    this.#active = next;
    this.#list?.scrollToIndex(Math.floor(next / this.#columns));
    this.#list?.update();
    this.#renderRows();
    this.#rows.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus({ preventScroll: true });
  }
}

/** Registers `<ui-emoji-picker>` (or `<prefix-emoji-picker>`) and returns the tag. */
export function defineEmojiPicker(options?: DefineOptions): string {
  return defineElement("emoji-picker", UiEmojiPicker, options);
}
