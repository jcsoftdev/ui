import { createVirtualList, type VirtualList } from "@jcsoftdev/ui-core/virtual-list";
import { type DefineOptions, defineElement, ElementBase, emit, uid } from "../internal/base.js";
import { chatGlyph, reconcile, srOnly } from "../internal/chat.js";
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
  #pinned = false;
  #viewport: HTMLElement | undefined;
  #windowEl: HTMLElement | undefined;
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
    this.#viewport = undefined;
    this.#windowEl = undefined;
    this.removeEventListener("click", this.#click);
    this.removeEventListener("keydown", this.#key);
    this.#built = false;
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#built) this.#render();
  }

  #now(): Date | string | number {
    const now = this.getAttribute("now");
    if (now === null) return Date.now();
    return /^-?\d+$/.test(now.trim()) ? Number(now) : now;
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
    this.#refocus("select", target.row.kind === "item" ? target.row.item.id : "");
  }

  #render(): void {
    const active = document.activeElement as HTMLElement | null;
    const inside = active?.closest?.("[data-ui='chat-list']") === this;
    const focusedId = inside ? (active?.dataset.id ?? null) : null;
    const focusedAction = inside ? (active?.dataset.action ?? null) : null;

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
    if (this.#items.length > VIRTUALIZE_ABOVE) {
      // Keep the viewport and the virtual list across renders: only the rows are rebuilt, so the
      // scroll position survives a new item, a rename or a change of the active conversation.
      const viewport = this.#viewport?.isConnected ? this.#viewport : this.#createViewport();
      for (const child of [...this.children]) if (child !== viewport) child.remove();
      if (viewport.parentNode === this) viewport.before(...children);
      else this.replaceChildren(...children, viewport);
      if (this.#virtual) this.#virtual.update();
      this.#paint(true);
    } else {
      this.#virtual?.destroy();
      this.#virtual = undefined;
      this.#viewport = undefined;
      this.#windowEl = undefined;
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

    if (focusedId && focusedAction) this.#refocus(focusedAction, focusedId);
  }

  #createViewport(): HTMLElement {
    this.#virtual?.destroy();
    const viewport = document.createElement("div");
    viewport.dataset.uiPart = "viewport";
    const rows = document.createElement("div");
    rows.dataset.uiPart = "window";
    viewport.append(rows);
    this.#viewport = viewport;
    this.#windowEl = rows;
    this.#virtual = createVirtualList(viewport, {
      count: () => this.#rows.length,
      estimateHeight: ESTIMATE_HEIGHT,
      overscan: 8,
      onChange: () => this.#paint(false),
    });
    viewport.addEventListener("focusout", () => {
      // A row kept mounted for focus can go once focus has left the list.
      queueMicrotask(() => this.#pinned && this.#paint(false));
    });
    return viewport;
  }

  /** Builds the rows of the current window and measures them (bounded passes). */
  #paint(remeasure: boolean): void {
    if (this.#painting) {
      this.#dirty = true;
      return;
    }
    this.#painting = true;
    try {
      for (let pass = 0; pass < 4; pass++) {
        this.#dirty = false;
        for (const node of this.#build())
          if (remeasure || pass > 0 || node.dataset.measured !== "1") {
            node.dataset.measured = "1";
            this.#virtual?.measure(Number(node.dataset.index), node.offsetHeight);
          }
        if (!this.#dirty) break;
      }
    } finally {
      this.#painting = false;
    }
  }

  #build(): HTMLElement[] {
    const rows = this.#windowEl;
    if (!rows) return [];
    const { start, end, padTop, padBottom } = this.#virtual?.window ?? {
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
    };
    rows.style.paddingTop = `${padTop}px`;
    rows.style.paddingBottom = `${padBottom}px`;
    const nodes: HTMLElement[] = [];
    const inWindow = new Set<string>();
    for (let index = start; index < end; index++) {
      const row = this.#rows[index];
      if (!row) continue;
      inWindow.add(row.key);
      let node = this.#nodes.get(row.key);
      if (!node) {
        node = this.#rowNode(row, index);
        this.#nodes.set(row.key, node);
      }
      node.dataset.index = String(index);
      node.removeAttribute("data-pinned");
      nodes.push(node);
    }
    // The row that holds focus stays mounted (out of sight) when it leaves the window, or the
    // browser would drop focus while the user scrolls.
    this.#pinned = false;
    const focused = document.activeElement;
    if (focused && rows.contains(focused)) {
      for (const [key, node] of this.#nodes)
        if (!inWindow.has(key) && node.contains(focused)) {
          node.dataset.pinned = "";
          nodes.push(node);
          this.#pinned = true;
        }
    }
    reconcile(rows, nodes);
    return nodes;
  }

  /** Focuses `id` again after a render, scrolling a windowed row into view first if needed. */
  #refocus(action: string, id: string): void {
    const find = () =>
      this.querySelector<HTMLElement>(`[data-action="${action}"][data-id="${CSS.escape(id)}"]`);
    let target = find();
    if (!target && this.#virtual) {
      const index = this.#rows.findIndex((row) => row.kind === "item" && row.item.id === id);
      if (index >= 0) {
        this.#virtual.scrollToIndex(index);
        this.#virtual.update();
        target = find();
      }
    }
    target?.focus({ preventScroll: true });
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
        () => item.title,
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
