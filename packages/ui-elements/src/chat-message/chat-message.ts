import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { chatGlyph } from "../internal/chat.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./chat-message.css.js";

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "streaming" | "done" | "error";
export type ChatMessageFormat = "text" | "markdown" | "html";

const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return (words[0]?.slice(0, 2) ?? "").toUpperCase();
  return `${words[0]?.at(0) ?? ""}${words.at(-1)?.at(0) ?? ""}`.toUpperCase();
};

/**
 * `<ui-chat-message>`: one chat turn, a `role="article"` named by `name`: avatar, bubble, status,
 * streaming caret and a footer. `aria-busy` is set while `sending` or `streaming`. `error` adds a
 * `role="alert"` line.
 *
 * Rendering is inert by default: `content` is set through `textContent` (newlines kept). Rich
 * output is an opt-in, assistant-only `format`, and only ever goes through ui-core:
 * `markdown` is `renderMarkdown` (safe DOM, raw HTML shown as text, http/https/mailto links only),
 * `html` is `setSafeHtml` (`sanitize-html`, an allow-list). Both modules load lazily, and the plain
 * text shows until they arrive. No path assigns untrusted data to `innerHTML`. Element children
 * replace `content` (the React `children`); children with `slot="footer"` go under the bubble (the
 * React `footer`, e.g. `<ui-message-actions>` or `<ui-source>`s).
 *
 * Attributes: `author` (`user`, `assistant` default, `system`), `name`, `avatar-src`, `status`
 * (`done` default), `time` (formatted), `content`, `format`, `error-text`, `sending-label`,
 * `typing-label`. Maps to the React `ChatMessage` props `author`, `name`, `avatarSrc`, `status`,
 * `time`, `content`, `children`, `footer`, `errorText`.
 */
export class UiChatMessage extends ElementBase {
  static observedAttributes = [
    "author",
    "name",
    "avatar-src",
    "status",
    "time",
    "content",
    "format",
    "error-text",
    "sending-label",
    "typing-label",
  ];

  readonly #avatar = document.createElement("span");
  readonly #column = document.createElement("div");
  readonly #bubble = document.createElement("div");
  readonly #body = document.createElement("div");
  readonly #error = document.createElement("p");
  readonly #time = document.createElement("p");
  readonly #footer = document.createElement("div");
  #custom = false;
  #built = false;
  #frame = 0;
  #errorKey = "";

  get author(): ChatRole {
    const author = this.getAttribute("author");
    return author === "user" || author === "system" ? author : "assistant";
  }
  set author(value: ChatRole) {
    this.setAttribute("author", value);
  }
  get status(): ChatMessageStatus {
    const status = this.getAttribute("status");
    return status === "sending" || status === "streaming" || status === "error" ? status : "done";
  }
  set status(value: ChatMessageStatus) {
    this.setAttribute("status", value);
  }
  /** The raw message text. */
  get content(): string {
    return this.getAttribute("content") ?? "";
  }
  set content(value: string) {
    this.setAttribute("content", value);
  }
  get name(): string {
    return (
      this.getAttribute("name") ??
      { user: "Tú", assistant: "Asistente", system: "Sistema" }[this.author]
    );
  }

  /** The footer container: append actions or sources here after the element is connected. */
  get footer(): HTMLElement {
    return this.#footer;
  }

  connectedCallback(): void {
    connectLight(this, "chat-message", css);
    defaultAttr(this, "role", "article");
    if (!this.#built) this.#build();
    this.#render();
  }

  disconnectedCallback(): void {
    this.#cancelFrame();
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#built) this.#render();
  }

  #build(): void {
    this.#built = true;
    const authored = [...this.childNodes];
    for (const [part, element] of [
      ["avatar", this.#avatar],
      ["content", this.#column],
      ["bubble", this.#bubble],
      ["body", this.#body],
      ["error", this.#error],
      ["time", this.#time],
      ["footer", this.#footer],
    ] as const)
      element.dataset.uiPart = part;
    this.#error.setAttribute("role", "alert");
    this.#error.hidden = true;
    for (const node of authored) {
      if (node instanceof Element && node.getAttribute("slot") === "footer") {
        node.removeAttribute("slot");
        this.#footer.append(node);
      } else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove();
      else {
        this.#body.append(node);
        this.#custom = true;
      }
    }
    this.#bubble.append(this.#body);
    this.#column.append(this.#bubble, this.#error, this.#time, this.#footer);
    this.replaceChildren(this.#avatar, this.#column);
  }

  #render(): void {
    const author = this.author;
    const status = this.status;
    const streaming = status === "streaming";
    this.dataset.author = author;
    this.dataset.status = status;
    this.setAttribute("aria-label", this.name);
    if (streaming || status === "sending") this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");

    const system = author === "system";
    this.#avatar.hidden = system;
    if (!system) this.#paintAvatar();

    const errorText = this.getAttribute("error-text") ?? "No se pudo enviar el mensaje.";
    // Rewriting a live region re-announces it, so touch it only when it really changes.
    const errorKey = status === "error" ? errorText : "";
    if (errorKey !== this.#errorKey) {
      this.#errorKey = errorKey;
      this.#error.hidden = status !== "error";
      this.#error.replaceChildren();
      if (status === "error") {
        this.#error.insertAdjacentHTML("afterbegin", chatGlyph("alert"));
        this.#error.append(errorText);
      }
    }
    const time =
      status === "sending"
        ? (this.getAttribute("sending-label") ?? "Enviando…")
        : this.getAttribute("time");
    this.#time.textContent = time ?? "";
    this.#time.hidden = !time;

    if (!this.#custom) this.#paintBody(streaming);
  }

  #paintAvatar(): void {
    const name = this.name;
    const src = this.getAttribute("avatar-src");
    if (src) {
      let image = this.#avatar.querySelector("img");
      if (!image) {
        image = document.createElement("img");
        image.alt = "";
        this.#avatar.replaceChildren(image);
      }
      if (image.getAttribute("src") !== src) image.setAttribute("src", src);
    } else this.#avatar.textContent = initialsOf(name);
  }

  #paintBody(streaming: boolean): void {
    const content = this.content;
    const author = this.author;
    const format = this.getAttribute("format");
    if (author !== "user" && author !== "system" && streaming && !content) {
      this.#cancelFrame();
      const loader = document.createElement("span");
      loader.dataset.uiPart = "typing";
      loader.setAttribute("role", "status");
      loader.setAttribute(
        "aria-label",
        this.getAttribute("typing-label") ?? "El asistente está escribiendo",
      );
      loader.innerHTML = "<i></i><i></i><i></i>";
      this.#body.replaceChildren(loader);
      return;
    }
    const rich = author === "assistant" && content && (format === "markdown" || format === "html");
    if (!rich) {
      this.#cancelFrame();
      this.#body.replaceChildren(this.#textNode(content, streaming));
      return;
    }
    // Rich output: once its module is loaded, one render per frame however fast chunks arrive,
    // and no plain-text flash in between. Until then the text shows.
    if (format === "markdown" ? markdown : sanitizer) {
      this.#schedule();
      return;
    }
    this.#body.replaceChildren(this.#textNode(content, streaming));
    const load =
      format === "markdown"
        ? import("@jcsoftdev/ui-core/markdown").then((m) => {
            markdown = m.renderMarkdown;
          })
        : import("@jcsoftdev/ui-core/sanitize-html").then((m) => {
            sanitizer = m.setSafeHtml;
          });
    load.then(() => {
      if (this.isConnected) this.#schedule();
    });
  }

  #textNode(content: string, streaming: boolean): HTMLElement {
    const paragraph = document.createElement("p");
    paragraph.dataset.uiPart = "text";
    paragraph.textContent = content;
    if (streaming) {
      const caret = document.createElement("span");
      caret.dataset.part = "caret";
      caret.setAttribute("aria-hidden", "true");
      paragraph.append(caret);
    }
    return paragraph;
  }

  #schedule(): void {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#paintRich();
    });
  }

  #cancelFrame(): void {
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  /** Renders the current content (read at frame time, so skipped chunks cost nothing). */
  #paintRich(): void {
    const content = this.content;
    const format = this.getAttribute("format");
    if (this.#custom || this.author !== "assistant" || !content) return;
    if (format === "markdown" && markdown)
      this.#body.replaceChildren(markdown(content, { streaming: this.status === "streaming" }));
    else if (format === "html" && sanitizer) {
      const holder = document.createElement("div");
      holder.dataset.uiPart = "html";
      sanitizer(holder, content);
      this.#body.replaceChildren(holder);
    }
  }
}

type MarkdownRenderer = typeof import("@jcsoftdev/ui-core/markdown").renderMarkdown;
type HtmlSetter = typeof import("@jcsoftdev/ui-core/sanitize-html").setSafeHtml;
let markdown: MarkdownRenderer | undefined;
let sanitizer: HtmlSetter | undefined;

/** Registers `<ui-chat-message>` (or `<prefix-chat-message>`) and returns the tag. */
export function defineChatMessage(options?: DefineOptions): string {
  return defineElement("chat-message", UiChatMessage, options);
}
