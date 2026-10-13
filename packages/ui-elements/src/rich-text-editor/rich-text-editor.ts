import {
  createRichText,
  RICH_TEXT_COMMANDS,
  type RichText,
  type RichTextCommand,
} from "@jcsoftdev/ui-core/rich-text";
import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import { htmlToText, sanitizeHtml } from "@jcsoftdev/ui-core/sanitize-html";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ensureId,
  rootOf,
} from "../internal/base.js";
import { FormElement } from "../internal/form.js";
import { syncControlAria } from "../internal/form-controls.js";
import { resolveString, watchStrings } from "../internal/strings.js";
import css from "./rich-text-editor.css.js";

/** English defaults. Keys are `richText.<key>` in the strings registry (see the `es` pack). */
const DEFAULTS = {
  placeholder: "Write here…",
  toolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  heading: "Heading",
  bulletList: "Bulleted list",
  numberedList: "Numbered list",
  link: "Link",
  linkAddress: "Link address",
  apply: "Apply",
  unlink: "Remove link",
  required: "Fill in this field.",
} as const;
type Key = keyof typeof DEFAULTS;

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** The attribute that overrides a string on the element: `bold-label`, or `placeholder`. */
const attrOf = (key: Key) => (key === "placeholder" ? key : `${kebab(key)}-label`);
const STRING_ATTRIBUTES = (Object.keys(DEFAULTS) as Key[]).map(attrOf);

const ICONS: Record<string, string> = {
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic:
    '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
  h2: '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>',
  ul: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
  ol: '<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>',
  link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  unlink:
    '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/>',
};
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const TOOLS: Record<RichTextCommand, { label: Key; shortcut?: string }> = {
  bold: { label: "bold", shortcut: "Ctrl+B" },
  italic: { label: "italic", shortcut: "Ctrl+I" },
  underline: { label: "underline", shortcut: "Ctrl+U" },
  h2: { label: "heading" },
  ul: { label: "bulletList" },
  ol: { label: "numberedList" },
};

const clean = (html: string) => {
  const safe = sanitizeHtml(html);
  return htmlToText(safe) === "" ? "" : safe;
};

/**
 * `<ui-rich-text-editor>`: a form-associated rich text editor on a plain `contenteditable`
 * (bold, italic, underline, heading, bulleted and numbered lists, links), built on ui-core's
 * `rich-text` behaviour. Light DOM: it renders a toolbar and an editing surface inside the host.
 *
 * Every value that leaves the editor is sanitized with ui-core's allowlist `sanitize-html`: what it
 * submits, what `value` returns, what `value =` accepts, what is pasted, and what a form restore
 * or reset puts back. Hostile markup (scripts, `on*` handlers, `javascript:` links) never reaches
 * the DOM or the form.
 *
 * ARIA: the toolbar is `role="toolbar"` with one tab stop (roving: arrows, Home, End) and
 * `aria-pressed` buttons that follow the caret; the surface is `role="textbox"`
 * `aria-multiline` named by `aria-label`/`label` on the host or its `<label>`s. Ctrl/Cmd+K opens
 * the link field (Enter applies, Escape closes), Ctrl/Cmd+B/I/U format as usual.
 *
 * Initial content: use the `value` attribute or a `<template>` child. Both are inert, so the markup
 * reaches the sanitizer before anything runs. Live child markup (`<ui-rich-text-editor><img onerror=...>`)
 * is parsed by the browser, and its handlers run, before any sanitizer can see it: the element
 * therefore ignores and removes live children (also when it was defined before the page was parsed).
 *
 * Attributes: `name`, `value` (initial HTML; the default restored by `form.reset()`; when absent
 * a `<template>` child seeds it), `required`, `disabled`, `placeholder`, `min-height`
 * (rem, default 8), `label`/`aria-label`, `aria-describedby`, `invalid`, and one label override per
 * string (`bold-label`, `italic-label`, `underline-label`, `heading-label`, `bullet-list-label`,
 * `numbered-list-label`, `link-label`, `link-address-label`, `apply-label`, `unlink-label`,
 * `toolbar-label`). Missing strings come from the strings registry (`richText.*`), then English.
 * Changing `lang` does not re-render labels; call `setStrings`/`loadStrings` (or change an attribute)
 * after switching language. Events: `input` (every edit, native, bubbles) and `change` (when the surface blurs with a new value).
 * Methods: `focus()`, `checkValidity()`, `reportValidity()`; property `editor` is the surface.
 * Style parts: `[data-ui-part="toolbar" | "tool" | "body" | "content" | "placeholder"]`.
 */
export class UiRichTextEditor extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "invalid",
    "min-height",
    "label",
    "aria-label",
    "aria-describedby",
    ...STRING_ATTRIBUTES,
  ];

  #surface?: HTMLElement;
  #toolbar?: HTMLElement;
  #linkRow?: HTMLElement;
  #linkInput?: HTMLInputElement;
  #placeholder?: HTMLElement;
  #rich?: RichText;
  #roving?: RovingFocus;
  #stopStrings?: () => void;
  #seed: string | undefined;
  #lastChange = "";
  #fromUser = false;
  #requiredMessage: string = DEFAULTS.required;
  #body?: HTMLElement;
  #watcher?: MutationObserver;
  #linkOpen = false;

  override get value(): string {
    return super.value;
  }
  override set value(value: string) {
    const next = clean(value);
    super.value = next;
    if (!this.#fromUser) this.#lastChange = next;
  }
  override get defaultValue(): string {
    return clean(this.getAttribute("value") ?? this.#seed ?? "");
  }

  /** The editing surface (`role="textbox"`). */
  get editor(): HTMLElement | undefined {
    return this.#surface;
  }

  override connectedCallback(): void {
    this.dataset.ui = "rich-text-editor";
    adoptStyles(rootOf(this), css);
    this.#adoptChildren();
    if (!this.#surface) this.#build();
    this.#watcher = new MutationObserver(() => this.#adoptChildren());
    this.#watcher.observe(this, { childList: true });
    const surface = this.#surface as HTMLElement;
    this.#rich = createRichText(surface, {
      html: this.value,
      onChange: (html) => {
        this.#fromUser = true;
        this.value = html;
        this.#fromUser = false;
      },
      onActiveChange: () => this.#syncPressed(),
      onLinkShortcut: () => this.#openLink(),
    });
    this.#roving = createRovingFocus(this.#toolbar as HTMLElement, { orientation: "horizontal" });
    this.#stopStrings = watchStrings(() => {
      this.#relabel();
      this.update();
    });
    this.#relabel();
    super.connectedCallback();
    this.#lastChange = this.value;
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#rich?.destroy();
    this.#roving?.destroy();
    this.#stopStrings?.();
    this.#watcher?.disconnect();
    this.#rich = this.#roving = this.#stopStrings = undefined;
  }

  override focus(options?: FocusOptions): void {
    this.#surface?.focus(options);
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.#lastChange = this.value;
  }

  override attributeChangedCallback(name: string, old?: string | null, next?: string | null): void {
    if (STRING_ATTRIBUTES.includes(name) && this.#surface) this.#relabel();
    super.attributeChangedCallback(name, old, next);
  }

  /**
   * Keeps only our own parts inside the host. A `<template>` child is the inert seed; any other
   * child (live markup, already parsed and run by the browser) is dropped.
   */
  #adoptChildren(): void {
    for (const child of [...this.childNodes]) {
      if (child === this.#toolbar || child === this.#body) continue;
      if (child instanceof HTMLTemplateElement) {
        this.#seed = child.innerHTML.trim() || undefined;
        if (!this.hasAttribute("value") && this.#rich && this.value === "")
          this.formResetCallback();
      }
      child.remove();
    }
  }

  #t(key: Key): string {
    return resolveString(this, `richText.${key}`, DEFAULTS[key], attrOf(key));
  }

  #build(): void {
    const tools = [
      ...RICH_TEXT_COMMANDS.map(
        (command) =>
          `<button type="button" data-ui-part="tool" data-tool="${command}" data-roving-item aria-pressed="false">${icon(command)}</button>`,
      ),
      `<button type="button" data-ui-part="tool" data-tool="link" data-roving-item aria-pressed="false">${icon("link")}</button>`,
    ].join("");
    const parts = document.createElement("div");
    parts.innerHTML = `<div data-ui-part="toolbar" role="toolbar">${tools}<div data-ui-part="link-row" hidden><input data-ui-part="link-input" type="url" form="" autocomplete="off" /><button type="button" data-ui-part="link-apply"></button><button type="button" data-ui-part="link-remove" data-tool="unlink">${icon("unlink")}</button></div></div><div data-ui-part="body"><span data-ui-part="placeholder" aria-hidden="true"></span><div data-ui-part="content" role="textbox" aria-multiline="true" contenteditable="true" spellcheck="true"></div></div>`;
    const part = (name: string) => parts.querySelector(`[data-ui-part="${name}"]`) as HTMLElement;
    this.#toolbar = part("toolbar");
    this.#linkRow = part("link-row");
    this.#linkInput = part("link-input") as HTMLInputElement;
    this.#placeholder = part("placeholder");
    this.#surface = part("content");
    this.#body = part("body");
    this.replaceChildren(...parts.children);
    const surface = this.#surface;
    ensureId(surface, "rte");
    this.#toolbar.setAttribute("aria-controls", surface.id);

    // Keep the editor selection while pressing a toolbar button.
    this.#toolbar.addEventListener("mousedown", (event) => {
      if ((event.target as Element).closest("button")) event.preventDefault();
    });
    this.#toolbar.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-tool], [data-ui-part=link-apply]",
      );
      if (!button || button.disabled) return;
      const tool = button.dataset.tool;
      if (button.dataset.uiPart === "link-apply") this.#applyLink();
      else if (tool === "link") this.#linkOpen ? this.#closeLink() : this.#openLink();
      else if (tool === "unlink") {
        this.#rich?.removeLink();
        this.#closeLink(false);
      } else if (tool) this.#rich?.exec(tool as RichTextCommand);
    });
    const input = this.#linkInput;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.#applyLink();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.#closeLink();
      }
    });
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    surface.addEventListener("blur", () => {
      if (this.value === this.#lastChange) return;
      this.#lastChange = this.value;
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
    surface.addEventListener("input", () => this.#syncPlaceholder());
    surface.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.#linkOpen) return;
      event.preventDefault();
      event.stopPropagation();
      this.#closeLink();
    });
  }

  #openLink(): void {
    const rich = this.#rich;
    if (!rich || this.disabled) return;
    rich.saveSelection();
    const input = this.#linkInput as HTMLInputElement;
    input.value = rich.linkAtSelection() ?? "https://";
    input.removeAttribute("aria-invalid");
    this.#linkOpen = true;
    (this.#linkRow as HTMLElement).hidden = false;
    this.#syncPressed();
    queueMicrotask(() => input.select());
  }

  #closeLink(restore = true): void {
    this.#linkOpen = false;
    (this.#linkRow as HTMLElement).hidden = true;
    this.#syncPressed();
    if (restore) this.#rich?.restoreSelection();
  }

  #applyLink(): void {
    const input = this.#linkInput as HTMLInputElement;
    if (!this.#rich?.applyLink(input.value)) {
      input.setAttribute("aria-invalid", "true");
      return;
    }
    this.#closeLink(false);
  }

  #syncPressed(): void {
    for (const button of this.#toolbar?.querySelectorAll<HTMLButtonElement>("button[data-tool]") ??
      []) {
      const tool = button.dataset.tool as string;
      if (tool === "unlink") continue;
      const on =
        tool === "link" ? this.#linkOpen : (this.#rich?.isActive(tool as RichTextCommand) ?? false);
      button.setAttribute("aria-pressed", String(on));
    }
  }

  #syncPlaceholder(): void {
    const placeholder = this.#placeholder;
    if (placeholder)
      placeholder.hidden = !(
        (this.#rich?.isEmpty() ?? this.value === "") &&
        !(this.#surface?.textContent ?? "").trim()
      );
  }

  /** Resolves every label; runs when strings or label attributes change, never per keystroke. */
  #relabel(): void {
    const toolbar = this.#toolbar;
    if (!toolbar) return;
    (this.#placeholder as HTMLElement).textContent = this.#t("placeholder");
    toolbar.setAttribute("aria-label", this.#t("toolbar"));
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>("button[data-tool]")) {
      const tool = button.dataset.tool as string;
      let label: string;
      if (tool === "link") label = `${this.#t("link")} (Ctrl+K)`;
      else if (tool === "unlink") label = this.#t("unlink");
      else {
        const spec = TOOLS[tool as RichTextCommand] as (typeof TOOLS)[RichTextCommand];
        label = spec.shortcut ? `${this.#t(spec.label)} (${spec.shortcut})` : this.#t(spec.label);
      }
      button.title = label;
      button.setAttribute("aria-label", label);
    }
    const apply = (this.#linkRow as HTMLElement).querySelector("[data-ui-part=link-apply]");
    if (apply) apply.textContent = this.#t("apply");
    (this.#linkInput as HTMLInputElement).setAttribute("aria-label", this.#t("linkAddress"));
    this.#requiredMessage = this.#t("required");
  }

  protected render(): void {
    const surface = this.#surface;
    const rich = this.#rich;
    if (!surface || !rich) return;
    if (this.value !== rich.getHtml()) rich.setHtml(this.value);
    surface.contentEditable = this.disabled ? "false" : "true";
    surface.tabIndex = this.disabled ? -1 : 0;
    if (this.disabled) surface.setAttribute("aria-disabled", "true");
    else surface.removeAttribute("aria-disabled");
    this.toggleAttribute("data-disabled", this.disabled);
    surface.style.minBlockSize = `${Number(this.getAttribute("min-height")) || 8}rem`;
    this.#syncPlaceholder();
    for (const button of (this.#toolbar as HTMLElement).querySelectorAll<HTMLButtonElement>(
      "button[data-tool]",
    ))
      button.disabled = this.disabled;
    (this.#linkInput as HTMLInputElement).disabled = this.disabled;
    this.#roving?.update();
    if (this.disabled && this.#linkOpen) this.#closeLink(false);

    syncControlAria(this, surface, this.internals.labels as NodeListOf<HTMLLabelElement>);
  }

  protected override validate() {
    if (this.required && !this.value)
      return {
        flags: { valueMissing: true },
        message: this.#requiredMessage,
        ...(this.#surface ? { anchor: this.#surface } : {}),
      };
    return undefined;
  }
}

/** Registers `<ui-rich-text-editor>` (or `<prefix-rich-text-editor>`) and returns the tag. */
export function defineRichTextEditor(options?: DefineOptions): string {
  return defineElement("rich-text-editor", UiRichTextEditor, options);
}
