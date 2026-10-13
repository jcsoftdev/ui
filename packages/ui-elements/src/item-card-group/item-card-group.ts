import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  uid,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { gather, icon, part } from "../internal/e10.js";
import css from "./item-card-group.css.js";

const CHEVRON = icon('<path d="m9 18 6-6-6-6"/>');

/**
 * `<ui-item-card-group>`: rows grouped inside a single card (settings, clients, services), with an
 * optional heading. Put `<ui-item-card>` children in it.
 *
 * ARIA: the group is `role="group"` named by its heading; the rows are a `role="list"` of
 * `role="listitem"`. A selected row carries `aria-current="true"`.
 * Attributes: `heading`, `description`, `selected-id` (the `id` of the highlighted row; a row can
 * also carry `selected` itself).
 */
export class UiItemCardGroup extends ElementBase {
  static observedAttributes = ["heading", "description", "selected-id"];

  readonly #header = part("header", "header");
  readonly #title = part("h3", "title");
  readonly #description = part("p", "description");
  readonly #list = part("div", "list");
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#list.setAttribute("role", "list");
    this.#title.id = uid("item-group-title");
  }

  connectedCallback(): void {
    connectLight(this, "item-card-group", css);
    this.setAttribute("role", "group");
    this.prepend(this.#header);
    this.#header.after(this.#list);
    this.#stop = gather(
      this,
      (child) => (isPart(child, "item-card") ? this.#list : null),
      (child) => child === this.#header || child === this.#list || !isPart(child, "item-card"),
      () => this.#render(),
    );
    this.#render();
  }

  disconnectedCallback(): void {
    this.#stop?.();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const heading = this.getAttribute("heading");
    const description = this.getAttribute("description");
    this.#title.textContent = heading ?? "";
    this.#description.textContent = description ?? "";
    this.#header.replaceChildren(
      ...(heading ? [this.#title] : []),
      ...(description ? [this.#description] : []),
    );
    this.#header.hidden = !heading && !description;
    if (heading) this.setAttribute("aria-labelledby", this.#title.id);
    else this.removeAttribute("aria-labelledby");
    const selectedId = this.getAttribute("selected-id");
    for (const item of this.#list.children) {
      if (!(item instanceof UiItemCard)) continue;
      if (selectedId !== null) item.selected = item.id === selectedId;
    }
  }
}

/**
 * `<ui-item-card>`: a row of an item card group. Attributes: `heading`, `description`,
 * `interactive` (the row becomes a button and shows a chevron; activating it emits `select` with
 * `detail.id`), `disabled`, `selected` (highlights the row, `aria-current="true"`). Children with
 * `slot="leading"` (icon, avatar, thumbnail) and `slot="trailing"` (value, chip, switch) go at the
 * start and the end of the row. Do not put another control in the trailing slot of an interactive
 * row: a button cannot contain one.
 */
export class UiItemCard extends ElementBase {
  static observedAttributes = ["heading", "description", "interactive", "disabled", "selected"];

  readonly #leading = part("span", "leading");
  readonly #trailing = part("span", "trailing");
  readonly #title = part("span", "item-title");
  readonly #description = part("span", "item-description");
  readonly #text = part("span", "text");
  readonly #chevron = part("span", "chevron");
  #row: HTMLElement | undefined;
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#text.append(this.#title);
    this.#chevron.innerHTML = CHEVRON;
    this.#chevron.setAttribute("aria-hidden", "true");
  }

  get selected(): boolean {
    return this.hasAttribute("selected");
  }

  set selected(value: boolean) {
    this.toggleAttribute("selected", value);
  }

  connectedCallback(): void {
    connectLight(this, "item-card", css);
    this.setAttribute("role", "listitem");
    this.#stop = gather(
      this,
      (child) => (child.getAttribute("slot") === "trailing" ? this.#trailing : this.#leading),
      (child) => child === this.#row,
      () => this.#render(),
    );
    this.#render();
  }

  disconnectedCallback(): void {
    this.#stop?.();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const interactive = this.hasAttribute("interactive");
    const wanted = interactive ? "button" : "div";
    if (!this.#row || this.#row.localName !== wanted) {
      const row = part(wanted, "row");
      if (row instanceof HTMLButtonElement) {
        row.type = "button";
        row.addEventListener("click", () => emit(this, "select", { id: this.id }));
      }
      this.#row?.remove();
      this.#row = row;
      this.append(row);
    }
    const row = this.#row;
    const disabled = this.hasAttribute("disabled");
    if (row instanceof HTMLButtonElement) row.disabled = disabled;
    row.toggleAttribute("data-disabled", disabled);
    if (this.selected) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
    this.#title.textContent = this.getAttribute("heading") ?? "";
    const description = this.getAttribute("description");
    this.#description.textContent = description ?? "";
    if (description) this.#text.append(this.#description);
    else this.#description.remove();
    row.replaceChildren(
      ...(this.#leading.firstChild ? [this.#leading] : []),
      this.#text,
      ...(this.#trailing.firstChild ? [this.#trailing] : []),
      ...(interactive ? [this.#chevron] : []),
    );
  }
}

/** Registers `<ui-item-card-group>` and `<ui-item-card>` (or the same under another prefix); returns the group tag. */
export function defineItemCardGroup(options?: DefineOptions): string {
  defineElement("item-card", UiItemCard, options);
  return defineElement("item-card-group", UiItemCardGroup, options);
}
