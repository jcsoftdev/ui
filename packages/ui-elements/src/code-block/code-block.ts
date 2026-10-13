import { type Copier, createCopier } from "@jcsoftdev/ui-core/clipboard";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import { LANGUAGE_LABELS, resolveLanguage } from "../internal/code-lang.js";
import type { Token } from "../internal/highlight.js";
import css from "./code-block.css.js";

const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Splits tokens at newlines into one element per line, so line numbers are pure CSS. */
function buildLines(tokens: Token[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let line = document.createElement("span");
  line.dataset.line = "";
  const flush = () => {
    fragment.append(line);
    line = document.createElement("span");
    line.dataset.line = "";
  };
  for (const token of tokens) {
    const pieces = token.text.split("\n");
    pieces.forEach((piece, index) => {
      if (index > 0) flush();
      if (!piece) return;
      if (token.type === "plain") line.append(document.createTextNode(piece));
      else {
        const span = document.createElement("span");
        span.dataset.token = token.type;
        span.textContent = piece;
        line.append(span);
      }
    });
  }
  flush();
  return fragment;
}

/**
 * `<ui-code-block>`: code with a language label, a copy button and optional line numbers and
 * syntax highlighting. The block is a labelled `figure` (named by its title) around a keyboard
 * focusable, scrollable `<pre>`; the copy button announces its result through a polite live
 * region. Code is only ever set as text, never parsed as markup.
 *
 * Source: the `code` attribute or property, else the element's own text content.
 * Attributes: `language` (`ts`, `js`, `json`, `bash`, `go`, `sql` and aliases), `filename`
 * (shown instead of the language label), `wrap` (wrap long lines), `line-numbers` (CSS counters,
 * not part of the copied text), `highlight` (opt-in: loads the tokenizer as a separate lazy chunk
 * only when present and the language is supported), `copy-label`, `copied-label`, `failed-label`.
 * Events: `copied` (bubbling, `detail.code`) after the copy button succeeds, `copy-error` when
 * the clipboard refuses (the button and live region then say "Copy failed").
 */
export class UiCodeBlock extends ElementBase {
  static observedAttributes = [
    "code",
    "language",
    "filename",
    "highlight",
    "copy-label",
    "copied-label",
  ];

  readonly #title: HTMLElement;
  readonly #status: HTMLElement;
  readonly #button: HTMLButtonElement;
  readonly #code: HTMLElement;
  readonly #copier: Copier;
  readonly #observer: MutationObserver | null;
  #source = "";
  #run = 0;
  #failTimer = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<figure part="root" aria-labelledby="title"><figcaption part="header"><span id="title" part="title"></span><span part="actions"><span part="status" aria-live="polite"></span><button part="copy" type="button"></button></span></figcaption><pre part="pre" tabindex="0"><code part="code"></code></pre></figure>';
    this.#title = root.getElementById("title") as HTMLElement;
    this.#status = root.querySelector("[part=status]") as HTMLElement;
    this.#button = root.querySelector("button") as HTMLButtonElement;
    this.#code = root.querySelector("code") as HTMLElement;
    this.#copier = createCopier((copied) => this.#paintCopy(copied));
    this.#button.addEventListener("click", () => {
      const code = this.#source;
      this.#copier.copy(code).then(
        () => emit(this, "copied", { code }),
        () => this.#fail(),
      );
    });
    this.#observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (!this.hasAttribute("code")) this.#render();
          });
  }

  get code(): string {
    return this.#source;
  }
  set code(value: string) {
    this.setAttribute("code", String(value ?? ""));
  }

  connectedCallback(): void {
    this.#observer?.observe(this, { childList: true, characterData: true, subtree: true });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#copier.destroy();
    clearTimeout(this.#failTimer);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #read(): string {
    const attribute = this.getAttribute("code");
    if (attribute !== null) return attribute;
    return (this.textContent ?? "").replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
  }

  #fail(): void {
    const label = this.getAttribute("failed-label") ?? "Copy failed";
    this.#button.setAttribute("aria-label", label);
    this.#button.title = label;
    this.#button.innerHTML = COPY_ICON;
    this.#status.textContent = label;
    this.#status.dataset.failed = "";
    clearTimeout(this.#failTimer);
    this.#failTimer = window.setTimeout(() => this.#paintCopy(false), 1600);
    emit(this, "copy-error");
  }

  #paintCopy(copied: boolean): void {
    delete this.#status.dataset.failed;
    const copy = this.getAttribute("copy-label") ?? "Copy code";
    const done = this.getAttribute("copied-label") ?? "Copied";
    this.#button.setAttribute("aria-label", copied ? "Code copied" : copy);
    this.#button.title = copied ? "Code copied" : copy;
    this.#button.innerHTML = copied ? CHECK_ICON : COPY_ICON;
    this.#status.textContent = copied ? done : "";
  }

  #render(): void {
    const language = this.getAttribute("language");
    const resolved = resolveLanguage(language);
    this.#source = this.#read();
    this.#title.textContent =
      this.getAttribute("filename") ??
      (resolved ? LANGUAGE_LABELS[resolved] : language?.trim() || "Text");
    this.#paintCopy(this.#copier.copied);
    if (language) this.#code.dataset.language = language;
    else delete this.#code.dataset.language;
    this.#code.replaceChildren(buildLines([{ type: "plain", text: this.#source }]));

    const run = ++this.#run;
    if (!this.hasAttribute("highlight") || !resolved) return;
    const source = this.#source;
    void import("../internal/highlight.js").then(({ tokenize }) => {
      if (run === this.#run) this.#code.replaceChildren(buildLines(tokenize(source, resolved)));
    });
  }
}

/** Registers `<ui-code-block>` (or `<prefix-code-block>`) and returns the tag. */
export function defineCodeBlock(options?: DefineOptions): string {
  return defineElement("code-block", UiCodeBlock, options);
}
