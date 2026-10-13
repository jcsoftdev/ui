import { createVirtualList, type VirtualList } from "@jcsoftdev/ui-core/virtual-list";
import { type DefineOptions, defineElement, ElementBase, emit, uid } from "../internal/base.js";
import { chatGlyph, srOnly } from "../internal/chat.js";
import { type DateGroupId, groupByDate } from "../internal/chat-group.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./chat-list.css.js";

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: Date | string | number;
  /** Last message excerpt. */
  preview?: string;
  unread?: boolean;
}

/** Above this many conversations the list is windowed with ui-core `virtual-list`. */
const VIRTUALIZE_ABOVE = 150;
const ESTIMATE_HEIGHT = 44;

type Row =
  | { kind: "title"; id: string; label: string; key: string }
  | { kind: "item"; item: ChatListItem; key: string };

/**
 * `<ui-chat-list>`: a navigation landmark listing conversations grouped by recency (Hoy, Ayer,
 * Últimos 7 días, Últimos 30 días, Anteriores), newest first, the active one marked with
 * `aria-current`. Text is always set through `textContent`.
 *
 * With more than 150 conversations the rows are windowed with ui-core `virtual-list` and the
 * arrow keys, Home and End move between conversations (a window cannot be tabbed through); below
 * that every conversation is a plain button in the page tab order, as in the React kit.
 *
 * Set `items` (an array of {@link ChatListItem}; React `items`). Attributes: `active-id`
 * (`activeId`), `label` (landmark name, default "Conversaciones"), `empty-text`, `creatable` (shows
 * the "new conversation" button; React: `onNew` present), `deletable` (shows a delete button per
 * row; React: `onDelete` present), `now` (reference date for the groups, for stable output),
 * `new-label`, `delete-label` ("{title}" is replaced), `unread-label`. Property `groupLabels`
 * overrides the group headings. Events: `select` ({ id }), `new`, `delete` ({ id }).
 */
export class UiChatList extends ElementBase {
  static observedAttributes = [
    "active-id",
    "label",
    "empty-text",
    "creatable",
    "deletable",
    "now",
    "new-label",
    "delete-label",
    "unread-label",
  ];

  /** Overrides the group headings, keyed by `today`, `yesterday`, `week`, `month`, `older`. */
  groupLabels: Partial<Record<DateGroupId, string>> = {};

  #items: ChatListItem[] = [];
  #virtual: VirtualList | undefined;
  #rows: Row[] = [];
  #built = false;
  #titleIds = new Map<string, string>();
  /** Window rows built since the last full render, so scrolling keeps focus on a live node. */
  #nodes = new Map<string, HTMLElement>();
  #painting = false;
  #dirty = false;
  #click = (event: Event) => this.#onClick(event);
  #key = (event: KeyboardEvent) => this.#onKeyDown(event);

  get items(): ChatListItem[] {
    return this.#items;
  }
  set items(value: ChatListItem[]) {
    this.#items = value;
    if (this.#built) this.#render();
  }
  get activeId(): string | null {
    return this.getAttribute("active-id");
  }
  set activeId(value: string | null) {
    if (value === null) this.removeAttribute("active-id");
    else this.setAttribute("active-id", value);
  }

  connectedCallback(): void {
    connectLight(this, "chat-list", css);
    defaultAttr(this, "role", "navigation");
    if (!this.#built) {
      this.#built = true;
      this.addEventListener("click", this.#click);
      this.addEventListener("keydown", this.#key);
    }
    this.#render();
  }

  disconnectedCallback(): void {
    this.#virtual?.destroy();
    this.#virtual = undefined;
    this.removeEventListener("click", this.#click);
    this.removeEventListener("keydown", this.#key);
    this.#built = false;
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#built) this.#render();
  }

  #now(): Date | string | number {
    return this.getAttribute("now") ?? Date.now();
  }

  #onClick(event: Event): void {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target || !this.contains(target)) return;
    const id = target.dataset.id ?? "";
    if (target.dataset.action === "new") emit(this, "new");
    else if (target.dataset.action === "select") emit(this, "select", { id });
    else if (target.dataset.action === "delete") emit(this, "delete", { id });
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (!this.#virtual || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const current = (event.target as Element).closest<HTMLElement>('[data-action="select"]');
    if (!current) return;
    const items = this.#rows.flatMap((row, index) => (row.kind === "item" ? [{ row, index }] : []));
    const at = items.findIndex(
      ({ row }) => row.kind === "item" && row.item.id === current.dataset.id,
    );
    const to =
      event.key === "ArrowDown"
        ? at + 1
        : event.key === "ArrowUp"
          ? at - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;
    const target = items[to];
    if (!target || at < 0) return;
    event.preventDefault();
    this.#virtual.scrollToIndex(target.index);
    this.#virtual.update();
    this.querySelector<HTMLElement>(
      `[data-action="select"][data-id="${CSS.escape(target.row.kind === "item" ? target.row.item.id : "")}"]`,
    )?.focus();
  }

  #render(): void {
    const focusedId =
      (document.activeElement as HTMLElement | null)?.closest?.("[data-ui='chat-list']") === this
        ? ((document.activeElement as HTMLElement).dataset.id ?? null)
        : null;
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset?.action ?? null;

    this.setAttribute("aria-label", this.getAttribute("label") ?? "Conversaciones");
    const groups = groupByDate(this.#items, this.#now(), this.groupLabels);
    this.#rows = groups.flatMap((group) => [
      { kind: "title" as const, id: group.id, label: group.label, key: `t:${group.id}` },
      ...group.items.map((item) => ({ kind: "item" as const, item, key: `i:${item.id}` })),
    ]);

    const children: Node[] = [];
    if (this.hasAttribute("creatable")) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.uiPart = "new";
      button.dataset.action = "new";
      button.insertAdjacentHTML("beforeend", chatGlyph("plus"));
      button.append(this.getAttribute("new-label") ?? "Nueva conversación");
      children.push(button);
    }
    if (groups.length === 0) {
      const empty = document.createElement("p");
      empty.dataset.uiPart = "empty";
      empty.textContent = this.getAttribute("empty-text") ?? "Aún no hay conversaciones.";
      children.push(empty);
    }

    this.#nodes.clear();
    const virtualize = this.#items.length > VIRTUALIZE_ABOVE;
    if (virtualize) {
      this.#virtual?.destroy();
      const viewport = document.createElement("div");
      viewport.dataset.uiPart = "viewport";
      const rows = document.createElement("div");
      rows.dataset.uiPart = "window";
      viewport.append(rows);
      children.push(viewport);
      this.replaceChildren(...children);
      const build = () => {
        const { start, end, padTop, padBottom } = this.#virtual?.window ?? {
          start: 0,
          end: 0,
          padTop: 0,
          padBottom: 0,
        };
        rows.style.paddingTop = `${padTop}px`;
        rows.style.paddingBottom = `${padBottom}px`;
        const nodes: HTMLElement[] = [];
        for (let index = start; index < end; index++) {
          const row = this.#rows[index];
          if (!row) continue;
          let node = this.#nodes.get(row.key);
          if (!node) {
            node = this.#rowNode(row, index);
            this.#nodes.set(row.key, node);
          }
          node.dataset.index = String(index);
          nodes.push(node);
        }
        rows.replaceChildren(...nodes);
        return nodes;
      };
      // Rows are measured right after they are placed, so offsets are exact before the next frame.
      // A measurement can change the window; it then asks for another (bounded) pass.
      const paint = () => {
        if (this.#painting) {
          this.#dirty = true;
          return;
        }
        this.#painting = true;
        try {
          for (let pass = 0; pass < 4; pass++) {
            this.#dirty = false;
            for (const node of build())
              this.#virtual?.measure(Number(node.dataset.index), node.offsetHeight);
            if (!this.#dirty) break;
          }
        } finally {
          this.#painting = false;
        }
      };
      this.#virtual = createVirtualList(viewport, {
        count: () => this.#rows.length,
        estimateHeight: ESTIMATE_HEIGHT,
        overscan: 8,
        onChange: paint,
      });
      paint();
    } else {
      this.#virtual?.destroy();
      this.#virtual = undefined;
      for (const group of groups) {
        const section = document.createElement("section");
        section.dataset.uiPart = "group";
        const title = this.#titleNode(group.id, group.label);
        section.setAttribute("aria-labelledby", title.id);
        const list = document.createElement("ul");
        list.dataset.uiPart = "list";
        for (const item of group.items) {
          const li = document.createElement("li");
          li.dataset.uiPart = "item";
          li.append(...this.#itemNodes(item));
          list.append(li);
        }
        section.append(title, list);
        children.push(section);
      }
      this.replaceChildren(...children);
    }

    if (focusedId) {
      const selector = focusedAction
        ? `[data-action="${focusedAction}"][data-id="${CSS.escape(focusedId)}"]`
        : null;
      if (selector) this.querySelector<HTMLElement>(selector)?.focus();
    }
  }

  #titleNode(groupId: string, label: string): HTMLElement {
    let id = this.#titleIds.get(groupId);
    if (!id) {
      id = uid("chat-group");
      this.#titleIds.set(groupId, id);
    }
    const title = document.createElement("h3");
    title.dataset.uiPart = "group-title";
    title.id = id;
    title.textContent = label;
    return title;
  }

  #rowNode(row: Row, index: number): HTMLElement {
    const node = document.createElement("div");
    node.dataset.index = String(index);
    if (row.kind === "title") {
      node.dataset.uiPart = "group-row";
      const title = this.#titleNode(row.id, row.label);
      title.removeAttribute("id");
      node.append(title);
    } else {
      node.dataset.uiPart = "item";
      node.append(...this.#itemNodes(row.item));
    }
    return node;
  }

  #itemNodes(item: ChatListItem): Node[] {
    const active = item.id === this.activeId;
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.uiPart = "row";
    row.dataset.action = "select";
    row.dataset.id = item.id;
    if (active) row.setAttribute("aria-current", "true");
    const line = document.createElement("span");
    line.dataset.uiPart = "line";
    if (item.unread) {
      const dot = document.createElement("span");
      dot.dataset.uiPart = "unread";
      dot.setAttribute("aria-hidden", "true");
      const sr = srOnly();
      sr.textContent = this.getAttribute("unread-label") ?? "Sin leer: ";
      line.append(dot, sr);
    }
    const title = document.createElement("span");
    title.dataset.uiPart = "title";
    title.textContent = item.title;
    line.append(title);
    row.append(line);
    if (item.preview) {
      const preview = document.createElement("span");
      preview.dataset.uiPart = "preview";
      preview.textContent = item.preview;
      row.append(preview);
    }
    const nodes: Node[] = [row];
    if (this.hasAttribute("deletable")) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.uiPart = "delete";
      remove.dataset.action = "delete";
      remove.dataset.id = item.id;
      const label = (this.getAttribute("delete-label") ?? "Eliminar {title}").replace(
        "{title}",
        item.title,
      );
      remove.setAttribute("aria-label", label);
      remove.title = label;
      remove.insertAdjacentHTML("beforeend", chatGlyph("trash"));
      nodes.push(remove);
    }
    return nodes;
  }
}

/** Registers `<ui-chat-list>` (or `<prefix-chat-list>`) and returns the tag. */
export function defineChatList(options?: DefineOptions): string {
  return defineElement("chat-list", UiChatList, options);
}
