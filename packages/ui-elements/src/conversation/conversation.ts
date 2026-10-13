import {
  createStickToBottom,
  type StickToBottom,
} from "@jcsoftdev/ui-core/observe/stick-to-bottom";
import { createVirtualList, type VirtualList } from "@jcsoftdev/ui-core/virtual-list";
import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { chatGlyph, reconcile, siblingTag, srOnly } from "../internal/chat.js";
import { connectLight } from "../internal/containers.js";
import css from "./conversation.css.js";

/** One message of the data API (`conversation.messages`). Mirrors the `<ui-chat-message>` attributes. */
export interface ConversationMessage {
  id: string;
  author: "user" | "assistant" | "system";
  name?: string;
  avatarSrc?: string;
  content?: string;
  status?: "sending" | "streaming" | "done" | "error";
  time?: string;
  format?: "text" | "markdown" | "html";
  errorText?: string;
}

/** Longest excerpt a new message adds to the live region. */
const ANNOUNCE_CHARS = 140;
/** Quiet time before pending messages are announced together. */
const ANNOUNCE_DELAY_MS = 600;
const ESTIMATE_HEIGHT = 96;

const summary = (name: string, content: string): string => {
  const text = content.replace(/\s+/g, " ").trim();
  return `${name}: ${text.length > ANNOUNCE_CHARS ? `${text.slice(0, ANNOUNCE_CHARS)}…` : text}`;
};

/**
 * `<ui-conversation>`: a scrollable message log that sticks to the bottom while content streams in
 * (ui-core `observe/stick-to-bottom`). Scrolling up pauses the follow and reveals a "Más reciente"
 * jump button. Fills its parent's height. The scroller is a focusable `role="log"` named `label`.
 *
 * Two ways to fill it:
 * - children (the React kit's way): put `<ui-chat-message>` elements (or anything) inside; later
 *   children are moved into the scroller;
 * - data: set `messages` (an array of {@link ConversationMessage}). The history is then virtualised
 *   with ui-core `virtual-list` (measured rows), so only the rows near the viewport exist in the DOM.
 *   `decorate(message, element)` runs when a row is created, e.g. to fill its `footer`.
 *
 * Live region: the log itself is not live (a virtualised or re-rendering log would repeat itself).
 * A separate polite `role="status"` announces new messages from others once they are `done`
 * (never user messages, the history present on first render, or streaming updates), debounced so
 * a burst reads as one line.
 *
 * Attributes: `label` (log name), `jump-label` (the button text), `new-messages-label` (the
 * burst text, "{n}" is the count). Methods: `scrollToBottom()`. Events: none.
 */
export class UiConversation extends ElementBase {
  static observedAttributes = ["label", "jump-label", "new-messages-label"];

  /** Called with each row's message element when it is created (data mode). */
  decorate?: (message: ConversationMessage, element: HTMLElement) => void;

  readonly #scroller = document.createElement("div");
  readonly #content = document.createElement("div");
  readonly #rows = document.createElement("div");
  readonly #jump = document.createElement("button");
  readonly #live = srOnly("div");
  readonly #rowElements = new Map<string, HTMLElement>();
  readonly #resizer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index))
              this.#virtual?.measure(index, (entry.target as HTMLElement).offsetHeight);
          }
        });
  #messages: ConversationMessage[] | undefined;
  #stick: StickToBottom | undefined;
  #virtual: VirtualList | undefined;
  #mutations: MutationObserver | undefined;
  #hostMutations: MutationObserver | undefined;
  #built = false;
  #remeasure = false;
  #rendering = false;
  #redo = false;
  #authored: Node[] = [];
  readonly #announced = new WeakSet<Element>();
  readonly #announcedIds = new Set<string>();
  #pending: string[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  #clearTimer: ReturnType<typeof setTimeout> | undefined;

  /** The element messages live in (children mode). */
  get content(): HTMLElement {
    return this.#content;
  }

  get messages(): ConversationMessage[] | undefined {
    return this.#messages;
  }
  set messages(next: ConversationMessage[] | undefined) {
    const previous = this.#messages;
    this.#messages = next;
    if (!this.#built) return;
    if (next === undefined) {
      this.#virtual?.destroy();
      this.#virtual = undefined;
      this.#clearRows();
      this.#content.replaceChildren(...this.#authored);
      return;
    }
    this.#considerMessages(previous, next);
    // The height cache is keyed by index: anything but an append (prepended history, a removal)
    // shifts the indexes, so start a fresh cache and re-measure the rows that are mounted.
    const appended =
      previous !== undefined &&
      next.length >= previous.length &&
      previous.every((message, index) => next[index]?.id === message.id);
    if (this.#virtual && !appended) {
      this.#virtual.destroy();
      this.#virtual = undefined;
      this.#remeasure = true;
    }
    this.#ensureVirtual();
    this.#virtual?.update();
    this.#renderRows();
  }

  /** Re-sticks to the newest message. */
  scrollToBottom(smooth = false): void {
    this.#stick?.jump(smooth);
  }

  connectedCallback(): void {
    connectLight(this, "conversation", css);
    if (!this.#built) this.#build();
    this.#paintLabels();
    this.#attach();
  }

  disconnectedCallback(): void {
    this.#stick?.destroy();
    this.#stick = undefined;
    this.#virtual?.destroy();
    this.#virtual = undefined;
    this.#mutations?.disconnect();
    this.#hostMutations?.disconnect();
    this.#resizer?.disconnect();
    clearTimeout(this.#timer);
    clearTimeout(this.#clearTimer);
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#built) this.#paintLabels();
  }

  #build(): void {
    this.#built = true;
    const authored = [...this.childNodes].filter(
      (node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim(),
    );
    this.#scroller.dataset.uiPart = "scroller";
    this.#scroller.setAttribute("role", "log");
    this.#scroller.setAttribute("aria-live", "off");
    this.#scroller.tabIndex = 0;
    this.#content.dataset.uiPart = "content";
    this.#rows.dataset.uiPart = "rows";
    this.#jump.dataset.uiPart = "jump";
    this.#jump.type = "button";
    this.#jump.hidden = true;
    this.#jump.insertAdjacentHTML("beforeend", `${chatGlyph("down")}<span></span>`);
    this.#jump.addEventListener("click", () =>
      this.#stick?.jump(!matchMedia("(prefers-reduced-motion: reduce)").matches),
    );
    this.#live.setAttribute("role", "status");
    this.#live.setAttribute("aria-live", "polite");
    this.#scroller.append(this.#content);
    this.replaceChildren(this.#scroller, this.#jump, this.#live);
    this.#authored = authored;
    this.#content.append(...authored);
  }

  #paintLabels(): void {
    this.#scroller.setAttribute("aria-label", this.getAttribute("label") ?? "Conversación");
    const text = this.#jump.querySelector("span") as HTMLElement;
    text.textContent = this.getAttribute("jump-label") ?? "Más reciente";
  }

  #attach(): void {
    this.#stick = createStickToBottom({
      scroller: this.#scroller,
      content: this.#content,
      onJumpChange: (show) => {
        this.#jump.hidden = !show;
      },
    });
    // Elements appended to the host after the build belong in the scroller.
    this.#hostMutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node !== this.#scroller && node !== this.#jump && node !== this.#live) {
            if (this.#messages === undefined) this.#content.append(node);
            else node.parentNode?.removeChild(node);
          }
    });
    this.#hostMutations.observe(this, { childList: true });
    // Children mode: announce messages that arrive after the first paint.
    this.#mutations = new MutationObserver((records) => {
      if (this.#messages !== undefined) return;
      for (const record of records) {
        if (record.type === "childList")
          for (const node of record.addedNodes) this.#considerElement(node);
        else this.#considerElement(record.target);
      }
    });
    this.#mutations.observe(this.#content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["status"],
    });
    for (const child of this.#content.children) this.#announced.add(child);
    // Rows survive a disconnect, but the observer was released with the old connection.
    for (const row of this.#rowElements.values()) this.#resizer?.observe(row);
    if (this.#messages !== undefined) {
      this.#ensureVirtual();
      this.#considerMessages(undefined, this.#messages);
      this.#renderRows();
    }
  }

  #ensureVirtual(): void {
    if (this.#virtual || this.#messages === undefined) return;
    this.#content.replaceChildren(this.#rows);
    this.#virtual = createVirtualList(this.#scroller, {
      count: () => this.#messages?.length ?? 0,
      estimateHeight: ESTIMATE_HEIGHT,
      overscan: 6,
      onChange: () => this.#renderRows(),
    });
  }

  #clearRows(): void {
    for (const row of this.#rowElements.values()) {
      this.#resizer?.unobserve(row);
      row.remove();
    }
    this.#rowElements.clear();
  }

  #renderRows(): void {
    if (this.#rendering) {
      this.#redo = true;
      return;
    }
    this.#rendering = true;
    try {
      for (let pass = 0; pass < 4; pass++) {
        this.#redo = false;
        const mounted = this.#placeRows();
        if (this.#remeasure) {
          this.#remeasure = false;
          for (const row of mounted)
            this.#virtual?.measure(Number(row.dataset.index), row.offsetHeight);
        }
        if (!this.#redo) break;
      }
    } finally {
      this.#rendering = false;
    }
  }

  #placeRows(): HTMLElement[] {
    const messages = this.#messages;
    const virtual = this.#virtual;
    if (!messages || !virtual) return [];
    const { start, end, padTop, padBottom } = virtual.window;
    this.#rows.style.paddingTop = `${padTop}px`;
    this.#rows.style.paddingBottom = `${padBottom}px`;
    const keep = new Set<string>();
    const ordered: HTMLElement[] = [];
    const tag = siblingTag(this, "conversation", "chat-message");
    for (let index = start; index < end; index++) {
      const message = messages[index];
      if (!message) continue;
      keep.add(message.id);
      let row = this.#rowElements.get(message.id);
      if (!row) {
        row = document.createElement("div");
        row.dataset.uiPart = "row";
        const element = document.createElement(tag);
        row.append(element);
        this.#rowElements.set(message.id, row);
        this.#resizer?.observe(row);
        this.decorate?.(message, element);
      }
      row.dataset.index = String(index);
      row.removeAttribute("data-pinned");
      const element = row.firstElementChild as HTMLElement;
      element.setAttribute("aria-setsize", String(messages.length));
      element.setAttribute("aria-posinset", String(index + 1));
      this.#paintMessage(element, message);
      ordered.push(row);
    }
    // A row that holds focus stays mounted (out of sight) while it is outside the window.
    const focused = document.activeElement;
    for (const [id, row] of this.#rowElements)
      if (!keep.has(id)) {
        if (focused && row.contains(focused)) {
          row.dataset.pinned = "";
          ordered.push(row);
        } else {
          this.#resizer?.unobserve(row);
          row.remove();
          this.#rowElements.delete(id);
        }
      }
    reconcile(this.#rows, ordered);
    return ordered;
  }

  #paintMessage(element: HTMLElement, message: ConversationMessage): void {
    const set = (name: string, value: string | undefined) => {
      if (value === undefined) element.removeAttribute(name);
      else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    };
    set("author", message.author);
    set("name", message.name);
    set("avatar-src", message.avatarSrc);
    set("status", message.status);
    set("time", message.time);
    set("format", message.format);
    set("error-text", message.errorText);
    set("content", message.content);
  }

  /**
   * Data mode: queue new messages from others once they are done. The first list, an empty-to-full
   * load and a wholesale replacement (no id in common) are history, not news.
   */
  #considerMessages(
    previous: ConversationMessage[] | undefined,
    next: ConversationMessage[],
  ): void {
    const known = new Set(previous?.map((message) => message.id));
    // Nothing before, many at once into an empty list, or no id in common: that is history. A
    // single message into an empty list is the first piece of news.
    const replaced =
      !previous ||
      (previous.length === 0 && next.length > 1) ||
      (previous.length > 0 && !next.some((message) => known.has(message.id)));
    for (const message of next) {
      if (this.#announcedIds.has(message.id)) continue;
      if (message.status === "streaming" || message.status === "sending") continue;
      this.#announcedIds.add(message.id);
      if (replaced || message.author === "user") continue;
      this.#queue(
        summary(
          message.name ?? (message.author === "system" ? "Sistema" : "Asistente"),
          message.content ?? "",
        ),
      );
    }
  }

  /** Children mode: the same rule applied to a `<ui-chat-message>`-like element. */
  #considerElement(node: Node): void {
    if (!(node instanceof HTMLElement) || this.#announced.has(node)) return;
    const author =
      node.getAttribute("author") ??
      (node.localName.endsWith("-chat-message") ? "assistant" : null);
    if (author === null) return;
    const status = node.getAttribute("status");
    if (status === "streaming" || status === "sending") return;
    this.#announced.add(node);
    if (author === "user") return;
    this.#queue(
      summary(
        node.getAttribute("name") ?? (author === "system" ? "Sistema" : "Asistente"),
        node.getAttribute("content") ?? node.textContent ?? "",
      ),
    );
  }

  #queue(line: string): void {
    this.#pending.push(line);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#flush(), ANNOUNCE_DELAY_MS);
  }

  #flush(): void {
    const lines = this.#pending;
    this.#pending = [];
    if (lines.length === 0) return;
    const burst = this.getAttribute("new-messages-label") ?? "{n} mensajes nuevos";
    this.#live.textContent =
      lines.length === 1 ? (lines[0] as string) : burst.replace("{n}", () => String(lines.length));
    clearTimeout(this.#clearTimer);
    this.#clearTimer = setTimeout(() => {
      this.#live.textContent = "";
    }, 5000);
  }
}

/** Registers `<ui-conversation>` (or `<prefix-conversation>`) and returns the tag. */
export function defineConversation(options?: DefineOptions): string {
  return defineElement("conversation", UiConversation, options);
}
