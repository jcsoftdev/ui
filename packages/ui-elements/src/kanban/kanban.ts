import {
  createSortable,
  type Sortable,
  type SortableList,
  type SortableLocation,
  type SortableMove,
} from "@jcsoftdev/ui-core/sortable";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
  uid,
} from "../internal/base.js";
import { format, ICONS, isRtl } from "../internal/e11.js";
import css from "./kanban.css.js";

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  tag?: string;
  assignee?: string;
  meta?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  /** Work-in-progress limit. */
  wipLimit?: number;
  cards: KanbanCard[];
}

const LABELS = {
  label: "Board",
  "empty-label": "No cards",
  "instructions-label":
    "Press Space to pick up a card, the arrow keys to move it and Space to drop it. Escape cancels.",
  "count-label": "{count} cards",
  "limit-label": "{count} of {limit} cards, work-in-progress limit",
} as const;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  part?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (part) node.dataset.uiPart = part;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** `"Ana Ruiz"` is `"AR"`; a single name gives its first two letters. */
const initials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`
      : name.trim().slice(0, 2);
  return letters.toUpperCase();
};

/** `"ok"`, `"at-limit"` or `"over"` for a column with `count` cards and a WIP `limit`. */
const wip = (count: number, limit?: number) =>
  limit === undefined ? "ok" : count > limit ? "over" : count === limit ? "at-limit" : "ok";

/**
 * `<ui-kanban>`: a board of columns with draggable cards and work-in-progress limits. Pointer: drag
 * a card (touch: use its grip). Keyboard (ui-core's `sortable`): Space or Enter picks a card up, the
 * arrow keys move it within and across columns (mirrored in right-to-left), Space or Enter drops
 * it, Escape cancels; every step is announced in a live region.
 *
 * It is data-driven and keyed by id: a card is found by `data-sortable-item`, never by DOM
 * identity, and each card carries `aria-posinset`/`aria-setsize`, so a column can render a window
 * of its cards (virtualisation) without changing the model or the keyboard behaviour.
 *
 * Properties: `columns` (`{ id, title, wipLimit?, cards: { id, title, description?, tag?, assignee?,
 * meta? }[] }[]`) and `renderCard(card, container)` to replace the default card body. Attributes:
 * `label`, `enforce-limit` (refuse drops into a column at its limit), and the text overrides
 * `empty-label`, `instructions-label`, `count-label` (`{count}`), and `limit-label` (`{count}`,
 * `{limit}`). Event: `move` (cancelable) with `{ move, columns }` after a
 * drop; the board applies the move unless it is cancelled, so a controlled owner can veto it and
 * set `columns` itself.
 */
export class UiKanban extends ElementBase {
  static observedAttributes = ["label", ...Object.keys(LABELS)];
  #columns: KanbanColumn[] = [];
  #draft: SortableList<KanbanCard>[] | null = null;
  #sortable: Sortable<KanbanCard> | undefined;
  #board = el("div", "board");
  #status = el("div", "status");
  #instructions = el("p", "instructions");
  #ghost: HTMLElement | undefined;
  #stopDrag: (() => void) | undefined;
  #renderCard: ((card: KanbanCard, container: HTMLElement) => void) | undefined;

  constructor() {
    super();
    this.#board.setAttribute("role", "group");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "assertive");
    this.#instructions.id = uid("kanban-instructions");
  }

  get columns(): KanbanColumn[] {
    return this.#columns;
  }
  set columns(value: KanbanColumn[]) {
    this.#columns = value;
    this.#draft = null;
    this.#render();
  }
  get renderCard(): ((card: KanbanCard, container: HTMLElement) => void) | undefined {
    return this.#renderCard;
  }
  set renderCard(value: ((card: KanbanCard, container: HTMLElement) => void) | undefined) {
    this.#renderCard = value;
    this.#render();
  }

  connectedCallback(): void {
    this.dataset.ui = "kanban";
    adoptStyles(rootOf(this), css);
    this.append(this.#instructions, this.#status, this.#board);
    this.addEventListener("pointerdown", this.#onPointerDown, true);
    this.addEventListener("keydown", this.#onKeyDown);
    const limited = () => this.hasAttribute("enforce-limit");
    this.#sortable?.destroy();
    this.#sortable = createSortable<KanbanCard>(this.#board, {
      lists: () => this.#lists(this.#columns),
      getId: (card) => card.id,
      get enforceLimit() {
        return limited();
      },
      rtl: () => isRtl(this),
      itemLabel: (card) => card.title,
      listLabel: (list) => this.#column(list.id)?.title ?? list.id,
      announce: (message) => {
        this.#status.textContent = message;
      },
      onDraft: (lists) => {
        this.#draft = lists;
        this.#render();
      },
      onMove: (move, lists) => this.#drop(move, lists),
      onDragOver: (target, id) => this.#over(target, id),
      onDragEnd: () => this.#endDrag(),
      canStartPointer: (event) =>
        event.pointerType !== "touch" ||
        (event.target as Element).closest("[data-ui-part='grip']") !== null,
    });
    this.#render();
  }

  disconnectedCallback(): void {
    this.removeEventListener("pointerdown", this.#onPointerDown, true);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#sortable?.destroy();
    this.#sortable = undefined;
    this.#stopDrag?.();
    this.#endDrag();
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#sortable) this.#render();
  }

  #text(name: keyof typeof LABELS): string {
    return this.getAttribute(name) ?? LABELS[name];
  }

  #column(id: string): KanbanColumn | undefined {
    return this.#columns.find((column) => column.id === id);
  }

  #lists(columns: readonly KanbanColumn[]): SortableList<KanbanCard>[] {
    return columns.map((c) => ({ id: c.id, items: c.cards, limit: c.wipLimit }));
  }

  /** The board as shown: the keyboard draft while a card is held, else the real columns. */
  #shown(): KanbanColumn[] {
    const draft = this.#draft;
    if (!draft) return this.#columns;
    return this.#columns.map((c) => ({
      ...c,
      cards: draft.find((l) => l.id === c.id)?.items.slice() ?? c.cards,
    }));
  }

  #drop(move: SortableMove, lists: SortableList<KanbanCard>[]): boolean {
    const columns = this.#columns.map((c) => ({
      ...c,
      cards: lists.find((l) => l.id === c.id)?.items.slice() ?? c.cards,
    }));
    this.#draft = null;
    const accepted = emit(this, "move", { move, columns }, true);
    if (accepted) this.#columns = columns;
    this.#render();
    return accepted;
  }

  #render(): void {
    const focused = this.#board.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.sortableItem
      : undefined;
    this.#board.setAttribute("aria-label", this.#text("label"));
    this.#instructions.textContent = this.#text("instructions-label");
    const held = this.#sortable?.grabbed;
    this.#board.replaceChildren(...this.#shown().map((column) => this.#column_(column, held)));
    if (focused) {
      this.#board
        .querySelector<HTMLElement>(`[data-sortable-item="${CSS.escape(focused)}"]`)
        ?.focus();
    }
  }

  #column_(column: KanbanColumn, held: string | undefined): HTMLElement {
    const section = el("section", "column");
    section.dataset.sortableList = column.id;
    section.setAttribute("aria-label", column.title);
    const header = el("header", "header");
    const count = column.cards.length;
    const chip = el(
      "span",
      "count",
      column.wipLimit === undefined ? String(count) : `${count}/${column.wipLimit}`,
    );
    chip.dataset.state = wip(count, column.wipLimit);
    chip.setAttribute(
      "aria-label",
      column.wipLimit === undefined
        ? format(this.#text("count-label"), { count })
        : format(this.#text("limit-label"), { count, limit: column.wipLimit }),
    );
    header.append(el("h3", "title", column.title), chip);
    const list = el("ul", "cards");
    column.cards.forEach((card, i) => {
      const item = el("li");
      item.setAttribute("aria-posinset", String(i + 1));
      item.setAttribute("aria-setsize", String(count));
      item.append(this.#card(card, held === card.id));
      list.append(item);
    });
    if (count === 0) list.append(el("li", "empty", this.#text("empty-label")));
    section.append(header, list);
    return section;
  }

  #card(card: KanbanCard, held: boolean): HTMLElement {
    const node = el("div", "card");
    node.dataset.sortableItem = card.id;
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-pressed", String(held));
    node.setAttribute("aria-roledescription", "draggable card");
    node.setAttribute("aria-describedby", this.#instructions.id);
    const grip = el("span", "grip");
    grip.setAttribute("aria-hidden", "true");
    grip.innerHTML = ICONS.grip;
    const body = el("div", "body");
    this.#fill(card, body);
    node.append(grip, body);
    return node;
  }

  #fill(card: KanbanCard, body: HTMLElement): void {
    if (this.#renderCard) {
      this.#renderCard(card, body);
      return;
    }
    body.append(el("span", "card-title", card.title));
    if (card.description) body.append(el("span", "card-description", card.description));
    if (card.tag || card.meta || card.assignee) {
      const row = el("div", "card-meta");
      if (card.tag) row.append(el("span", "tag", card.tag));
      if (card.meta) row.append(el("span", "meta", card.meta));
      if (card.assignee) {
        const who = el("span", "assignee", initials(card.assignee));
        who.title = card.assignee;
        row.append(who);
      }
      body.append(row);
    }
  }

  /** Picking a card up fires no ui-core callback; reflect it once the board has handled the key. */
  readonly #onKeyDown = (): void => {
    const held = this.#sortable?.grabbed;
    for (const card of this.#board.querySelectorAll<HTMLElement>("[data-sortable-item]"))
      card.setAttribute("aria-pressed", String(card.dataset.sortableItem === held));
  };

  // Pointer drag: ui-core's sortable decides the target; the ghost and indicator are drawn here.
  readonly #onPointerDown = (event: PointerEvent): void => {
    const card = (event.target as Element).closest<HTMLElement>("[data-sortable-item]");
    if (!card || event.button !== 0 || !this.#board.contains(card)) return;
    const rect = card.getBoundingClientRect();
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (e: PointerEvent) => {
      if (!this.#ghost && Math.hypot(e.clientX - startX, e.clientY - startY) >= 4) {
        this.#ghost = el("div", "ghost");
        this.#ghost.setAttribute("aria-hidden", "true");
        this.#ghost.style.width = `${rect.width}px`;
        this.#ghost.append(card.querySelector("[data-ui-part='body']")?.cloneNode(true) ?? "");
        card.dataset.dragging = "";
        this.append(this.#ghost);
      }
      if (this.#ghost) {
        this.#ghost.style.left = `${e.clientX - dx}px`;
        this.#ghost.style.top = `${e.clientY - dy}px`;
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      this.#stopDrag = undefined;
      this.#endDrag();
    };
    this.#stopDrag?.();
    this.#stopDrag = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  #over(target: SortableLocation | null, id: string): void {
    for (const stale of this.#board.querySelectorAll("[data-drop-indicator]")) stale.remove();
    if (!target) return;
    const column = this.#board.querySelector<HTMLElement>(
      `[data-sortable-list="${CSS.escape(target.listId)}"]`,
    );
    const list = column?.querySelector("ul");
    if (!list) return;
    const others = [...list.children].filter(
      (li) => li.querySelector(`[data-sortable-item]`)?.getAttribute("data-sortable-item") !== id,
    );
    const marker = el("li");
    marker.dataset.dropIndicator = "";
    marker.setAttribute("aria-hidden", "true");
    list.insertBefore(marker, others[target.index] ?? null);
  }

  #endDrag(): void {
    this.#ghost?.remove();
    this.#ghost = undefined;
    for (const dragged of this.#board.querySelectorAll("[data-dragging]"))
      dragged.removeAttribute("data-dragging");
    for (const stale of this.#board.querySelectorAll("[data-drop-indicator]")) stale.remove();
  }
}

/** Registers `<ui-kanban>` (or `<prefix>-kanban`) and returns the tag. */
export function defineKanban(options?: DefineOptions): string {
  return defineElement("kanban", UiKanban, options);
}
