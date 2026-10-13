import { adoptStyles, ElementBase, emit } from "./base.js";
import css from "./emoji-reaction.css.js";

/**
 * `<ui-emoji-reaction emoji="👍" count="3" reacted>`: a reaction chip, an emoji with its count,
 * pressed when the current user used that reaction. The host is the control: `role="button"` and
 * `aria-pressed` through ElementInternals, named `"<emoji> <count>"` like the React kit's
 * `EmojiReactionButton`. Enter and Space (on key up, like a native button) and a click toggle it.
 *
 * Attributes: `emoji`, `count`, `reacted`, `disabled`, `controlled`. A press flips `reacted`, moves
 * `count` by one and fires a bubbling `change` with `detail: { reacted, count }`. With `controlled`
 * it changes nothing itself and only reports the requested state, for the app to apply. Not
 * form-associated.
 */
export class UiEmojiReaction extends ElementBase {
  static observedAttributes = ["emoji", "count", "reacted", "disabled", "controlled"];

  readonly #internals = this.attachInternals();
  readonly #emoji: HTMLElement;
  readonly #count: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<span part="emoji" aria-hidden="true"></span><span part="count" aria-hidden="true"></span>';
    this.#emoji = root.querySelector('[part="emoji"]') as HTMLElement;
    this.#count = root.querySelector('[part="count"]') as HTMLElement;
    this.#internals.role = "button";
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
  }

  get emoji(): string {
    return this.getAttribute("emoji") ?? "";
  }
  set emoji(value: string) {
    this.setAttribute("emoji", value);
  }
  get count(): number {
    const count = Number.parseInt(this.getAttribute("count") ?? "", 10);
    return Number.isFinite(count) ? count : 0;
  }
  set count(value: number) {
    this.setAttribute("count", String(value));
  }
  get reacted(): boolean {
    return this.hasAttribute("reacted");
  }
  set reacted(value: boolean) {
    this.toggleAttribute("reacted", value);
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  /**
   * Toggles as a user would. Standalone it is optimistic: `reacted` flips, `count` follows by one,
   * and `change` fires with the new `{ reacted, count }`. With `controlled` (what the reaction bar
   * sets) nothing changes here: `change` reports the requested state and the app updates the chip.
   */
  toggle(): void {
    if (this.disabled) return;
    const reacted = !this.reacted;
    const count = Math.max(0, this.count + (reacted ? 1 : -1));
    if (!this.hasAttribute("controlled")) {
      this.reacted = reacted;
      this.count = count;
    }
    emit(this, "change", { reacted, count });
  }

  #render(): void {
    this.#emoji.textContent = this.emoji;
    this.#count.textContent = String(this.count);
    this.#internals.ariaLabel = `${this.emoji} ${this.count}`;
    this.#internals.ariaPressed = String(this.reacted);
    this.#internals.ariaDisabled = this.disabled ? "true" : null;
    if (this.disabled) this.removeAttribute("tabindex");
    else if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
  }

  #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.toggle();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this) return;
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter") {
      event.preventDefault();
      this.toggle();
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    if (event.target === this && event.key === " ") this.toggle();
  };
}
