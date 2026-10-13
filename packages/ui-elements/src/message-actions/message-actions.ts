import { type Copier, createCopier } from "@jcsoftdev/ui-core/clipboard";
import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  toggleAttr,
} from "../internal/base.js";
import { type ChatGlyph, chatGlyph, srOnly } from "../internal/chat.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./message-actions.css.js";

export type MessageFeedback = "like" | "dislike" | null;

interface Action {
  id: "copy" | "regenerate" | "like" | "dislike";
  glyph: ChatGlyph;
}

const ACTIONS: Action[] = [
  { id: "copy", glyph: "copy" },
  { id: "regenerate", glyph: "refresh" },
  { id: "like", glyph: "like" },
  { id: "dislike", glyph: "dislike" },
];

/**
 * `<ui-message-actions>`: copy, regenerate, like and dislike for an assistant message, a WAI-ARIA
 * `toolbar` (horizontal, one tab stop, arrows/Home/End through ui-core `roving`). Copy uses ui-core
 * `clipboard` and gives feedback twice: the button label changes to "Mensaje copiado" with a check
 * icon for 1.6 s, and a polite status region announces it. Feedback toggles off on a second press.
 *
 * Attributes: `text` (what copy copies; without it, the `content` of the enclosing chat message),
 * `regenerate` (shows the regenerate button; React: `onRegenerate` present), `feedbackable` (shows
 * like/dislike; React: `onFeedback` present), `feedback` (`like` or `dislike`, the current value,
 * reflected on press; React: `feedback`/`defaultFeedback`), `label` (toolbar name), and the
 * button-name overrides `copy-label`, `copied-label`, `regenerate-label`, `like-label`,
 * `dislike-label`. Events: `copied` ({ text }, not named `copy` so it cannot be mistaken for the native clipboard event), `regenerate`, `feedback` ({ value }).
 */
export class UiMessageActions extends ElementBase {
  static observedAttributes = [
    "text",
    "regenerate",
    "feedbackable",
    "feedback",
    "label",
    "copy-label",
    "copied-label",
    "regenerate-label",
    "like-label",
    "dislike-label",
  ];

  readonly #buttons = new Map<Action["id"], HTMLButtonElement>();
  readonly #status = srOnly();
  readonly #copier: Copier = createCopier((copied) => this.#paintCopy(copied));
  #roving: RovingFocus | undefined;
  #built = false;

  get text(): string {
    const own = this.getAttribute("text");
    if (own !== null) return own;
    const message = this.closest('[data-ui="chat-message"]') as
      | (HTMLElement & { content?: string })
      | null;
    return message?.content ?? message?.textContent?.trim() ?? "";
  }
  set text(value: string) {
    this.setAttribute("text", value);
  }

  /** The current feedback, `null` when none. */
  get feedback(): MessageFeedback {
    const value = this.getAttribute("feedback");
    return value === "like" || value === "dislike" ? value : null;
  }
  set feedback(value: MessageFeedback) {
    if (value === null) this.removeAttribute("feedback");
    else this.setAttribute("feedback", value);
  }

  connectedCallback(): void {
    connectLight(this, "message-actions", css);
    defaultAttr(this, "role", "toolbar");
    if (!this.#built) {
      this.#built = true;
      for (const { id, glyph } of ACTIONS) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.uiPart = "action";
        button.dataset.action = id;
        button.insertAdjacentHTML("beforeend", chatGlyph(glyph));
        button.addEventListener("click", () => this.#press(id));
        this.#buttons.set(id, button);
      }
      this.#status.setAttribute("role", "status");
      this.append(...this.#buttons.values(), this.#status);
      this.#roving = createRovingFocus(this, {
        orientation: "horizontal",
        items: () => [...this.#buttons.values()].filter((button) => !button.hidden),
      });
    }
    this.#render();
  }

  disconnectedCallback(): void {
    this.#roving?.destroy();
    this.#roving = undefined;
    this.#copier.destroy();
    for (const button of this.#buttons.values()) button.remove();
    this.#status.remove();
    this.#built = false;
    this.#buttons.clear();
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#built) this.#render();
  }

  #press(id: Action["id"]): void {
    if (id === "copy") {
      const text = this.text;
      void this.#copier.copy(text);
      emit(this, "copied", { text });
    } else if (id === "regenerate") emit(this, "regenerate");
    else {
      const next = this.feedback === id ? null : id;
      this.feedback = next;
      emit(this, "feedback", { value: next });
    }
  }

  #paintCopy(copied: boolean): void {
    const button = this.#buttons.get("copy");
    if (!button) return;
    const label = this.#label("copy");
    button.setAttribute("aria-label", label);
    button.title = label;
    button.querySelector("svg")?.remove();
    button.insertAdjacentHTML("beforeend", chatGlyph(copied ? "check" : "copy"));
    this.#status.textContent = copied ? this.#label("copy") : "";
  }

  #label(id: Action["id"]): string {
    switch (id) {
      case "copy":
        return this.#copier.copied
          ? (this.getAttribute("copied-label") ?? "Mensaje copiado")
          : (this.getAttribute("copy-label") ?? "Copiar mensaje");
      case "regenerate":
        return this.getAttribute("regenerate-label") ?? "Regenerar respuesta";
      case "like":
        return this.getAttribute("like-label") ?? "Me gusta";
      case "dislike":
        return this.getAttribute("dislike-label") ?? "No me gusta";
    }
  }

  #render(): void {
    this.setAttribute("aria-label", this.getAttribute("label") ?? "Acciones del mensaje");
    const feedbackable = this.hasAttribute("feedbackable");
    const visible: Record<Action["id"], boolean> = {
      copy: true,
      regenerate: this.hasAttribute("regenerate"),
      like: feedbackable,
      dislike: feedbackable,
    };
    for (const [id, button] of this.#buttons) {
      button.hidden = !visible[id];
      const label = this.#label(id);
      button.setAttribute("aria-label", label);
      button.title = label;
      if (id === "like" || id === "dislike")
        button.setAttribute("aria-pressed", String(this.feedback === id));
      toggleAttr(button, "data-copied", id === "copy" && this.#copier.copied);
    }
    this.#roving?.update();
  }
}

/** Registers `<ui-message-actions>` (or `<prefix-message-actions>`) and returns the tag. */
export function defineMessageActions(options?: DefineOptions): string {
  return defineElement("message-actions", UiMessageActions, options);
}
