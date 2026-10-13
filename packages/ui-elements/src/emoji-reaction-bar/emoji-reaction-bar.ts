import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import { UiEmojiReaction } from "../internal/emoji-reaction.js";
import css from "./emoji-reaction-bar.css.js";

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

const SMILE_PLUS =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11v1a10 10 0 1 1-9-10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01M16 5h6M19 2v6"/></svg>';

type PopoverLike = HTMLElement & { show(anchor?: HTMLElement | null): void; hide(): void };

const SUFFIX = "-emoji-reaction-bar";

/**
 * `<ui-emoji-reaction-bar>`: a row of reaction chips (`<ui-emoji-reaction>`) and an "add reaction"
 * button that opens a `<ui-popover>` holding a `<ui-emoji-picker>`. Light DOM. The popover and the
 * picker (with its dataset) load on the first press of the add button, not with the bar.
 *
 * Data comes in as `reactions`, an array of `{ emoji, count, reacted? }`, either as the property or
 * as JSON in the `reactions` attribute. The bar is controlled like the React kit's: it fires a
 * bubbling `react` with `detail: { emoji, reacted }` for a chip press (the new state) and for a
 * pick in the picker (toggles the emoji's current state) and leaves the counts to the app, which
 * sets `reactions` again.
 *
 * Attributes: `reactions`, `add-label` (default "Añadir reacción"), `disabled`. Registering the bar
 * registers `<ui-emoji-reaction>` under the same prefix.
 */
export class UiEmojiReactionBar extends ElementBase {
  static observedAttributes = ["reactions", "add-label", "disabled"];

  #reactions: Reaction[] | undefined;
  #add!: HTMLButtonElement;
  #popover: PopoverLike | undefined;
  #loading = false;
  #built = false;
  readonly #chips = new Map<string, UiEmojiReaction>();

  get reactions(): Reaction[] {
    if (this.#reactions) return this.#reactions;
    try {
      const parsed = JSON.parse(this.getAttribute("reactions") ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  set reactions(value: Reaction[]) {
    this.#reactions = value;
    this.#render();
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }

  connectedCallback(): void {
    this.dataset.ui = "emoji-reaction-bar";
    adoptStyles(rootOf(this), css);
    if (!this.#built) this.#build();
    this.#render();
  }

  disconnectedCallback(): void {
    this.#popover?.hide();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#built) return;
    if (name === "reactions") this.#reactions = undefined;
    this.#render();
  }

  #build(): void {
    this.#built = true;
    this.#add = document.createElement("button");
    this.#add.type = "button";
    this.#add.dataset.uiPart = "add";
    this.#add.setAttribute("aria-haspopup", "dialog");
    this.#add.setAttribute("aria-expanded", "false");
    this.#add.innerHTML = SMILE_PLUS;
    this.#add.addEventListener("click", () => this.#togglePicker());
    this.addEventListener("change", (event) => {
      const chip = (event.target as Element).closest?.("[data-emoji]");
      if (!(chip instanceof UiEmojiReaction) || chip.parentElement !== this) return;
      event.stopPropagation();
      emit(this, "react", {
        emoji: chip.emoji,
        reacted: (event as CustomEvent<{ reacted: boolean }>).detail.reacted,
      });
    });
    this.append(this.#add);
  }

  #render(): void {
    if (!this.#built) return;
    this.#add.setAttribute("aria-label", this.getAttribute("add-label") ?? "Añadir reacción");
    this.#add.disabled = this.disabled;
    const wanted = new Set(this.reactions.map((reaction) => reaction.emoji));
    for (const [emoji, chip] of this.#chips) {
      if (wanted.has(emoji)) continue;
      chip.remove();
      this.#chips.delete(emoji);
    }
    let before: Element = this.#add;
    const ordered = [...this.reactions].reverse();
    for (const reaction of ordered) {
      let chip = this.#chips.get(reaction.emoji);
      if (!chip) {
        chip = document.createElement(this.#tag("emoji-reaction")) as UiEmojiReaction;
        chip.dataset.emoji = reaction.emoji;
        this.#chips.set(reaction.emoji, chip);
      }
      chip.emoji = reaction.emoji;
      chip.count = reaction.count;
      chip.reacted = reaction.reacted === true;
      chip.disabled = this.disabled;
      chip.toggleAttribute("controlled", true);
      chip.dataset.uiPart = "reaction";
      if (chip.nextElementSibling !== before) this.insertBefore(chip, before);
      before = chip;
    }
  }

  get #prefix(): string {
    return this.localName.endsWith(SUFFIX) ? this.localName.slice(0, -SUFFIX.length) : "ui";
  }

  #tag(name: string): string {
    return `${this.#prefix}-${name}`;
  }

  async #togglePicker(): Promise<void> {
    if (this.#popover?.hasAttribute("open")) return this.#popover.hide();
    if (this.#loading) return;
    this.#loading = true;
    const prefix = this.#prefix;
    this.#add.setAttribute("aria-busy", "true");
    let modules: [
      typeof import("../popover/popover.js"),
      typeof import("../emoji-picker/emoji-picker.js"),
    ];
    try {
      modules = await Promise.all([
        import("../popover/popover.js"),
        import("../emoji-picker/emoji-picker.js"),
      ]);
    } catch {
      // A failed chunk fetch leaves the button usable: pressing it again retries.
      this.#loading = false;
      this.#add.removeAttribute("aria-busy");
      this.#add.disabled = this.disabled;
      return;
    }
    const [{ definePopover }, { defineEmojiPicker }] = modules;
    this.#loading = false;
    this.#add.removeAttribute("aria-busy");
    if (!this.isConnected) return;
    if (!this.#popover) {
      definePopover({ prefix });
      defineEmojiPicker({ prefix });
      const popover = document.createElement(`${prefix}-popover`) as PopoverLike;
      popover.dataset.uiPart = "popover";
      const picker = document.createElement(`${prefix}-emoji-picker`);
      picker.addEventListener("emoji-select", (event) => {
        event.stopPropagation();
        if (!(event instanceof CustomEvent) || event.target !== picker) return;
        const { emoji } = (event as CustomEvent<{ emoji: string }>).detail;
        const existing = this.reactions.find((reaction) => reaction.emoji === emoji);
        emit(this, "react", { emoji, reacted: existing?.reacted !== true });
        popover.hide();
      });
      popover.append(picker);
      popover.addEventListener("open", (event) => {
        if (event.target === popover) this.#add.setAttribute("aria-expanded", "true");
      });
      popover.addEventListener("close", (event) => {
        if (event.target === popover) this.#add.setAttribute("aria-expanded", "false");
      });
      this.append(popover);
      this.#popover = popover;
    }
    this.#popover.show(this.#add);
  }
}

/** Registers `<ui-emoji-reaction-bar>` and `<ui-emoji-reaction>` (or under `prefix`); returns the bar tag. */
export function defineEmojiReactionBar(options?: DefineOptions): string {
  defineElement("emoji-reaction", UiEmojiReaction, options);
  return defineElement("emoji-reaction-bar", UiEmojiReactionBar, options);
}
