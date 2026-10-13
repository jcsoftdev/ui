import { adoptStyles, ElementBase } from "./base.js";
import { glyph } from "./e1-icons.js";
import css from "./e3-banner.css.js";

export type BannerTone = "info" | "success" | "warning" | "danger";

const TONES: readonly BannerTone[] = ["info", "success", "warning", "danger"];

/**
 * Shared shell of `<ui-banner>` and `<ui-offline-banner>`: an icon, a body and an action area in a
 * shadow root. Only a `danger` banner interrupts (`role="alert"`); every other tone is a polite
 * `role="status"` notice.
 */
export abstract class BannerBase extends ElementBase {
  protected readonly internals = this.attachInternals();
  protected readonly iconSlot: HTMLSlotElement;
  protected readonly body: HTMLElement;
  protected readonly action: HTMLElement;
  readonly #root: HTMLElement;
  readonly #icon: HTMLElement;
  readonly #title: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<div part="root"><span part="icon" aria-hidden="true"><slot name="icon"></slot></span>' +
      '<div part="body"><p part="title" hidden></p><slot></slot></div>' +
      '<div part="action" hidden><slot name="action"></slot></div></div>';
    this.iconSlot = root.querySelector("slot[name=icon]") as HTMLSlotElement;
    this.#root = root.querySelector("[part=root]") as HTMLElement;
    this.#icon = root.querySelector("[part=icon]") as HTMLElement;
    this.#title = root.querySelector("[part=title]") as HTMLElement;
    this.body = root.querySelector("[part=body]") as HTMLElement;
    this.action = root.querySelector("[part=action]") as HTMLElement;
    const actionSlot = this.action.querySelector("slot") as HTMLSlotElement;
    actionSlot.addEventListener("slotchange", () => this.syncAction());
  }

  protected get tone(): BannerTone {
    const tone = this.getAttribute("tone") as BannerTone | null;
    return tone && TONES.includes(tone) ? tone : "info";
  }

  protected syncAction(): void {
    const slot = this.action.querySelector("slot") as HTMLSlotElement;
    const extra = this.action.querySelector("[part=count]");
    this.action.hidden = slot.assignedNodes().length === 0 && !extra;
  }

  /** Reflects the tone, icon and title into the shadow tree and the ARIA role. */
  protected renderBanner(): void {
    const tone = this.tone;
    this.#root.dataset.tone = tone;
    this.internals.role = tone === "danger" ? "alert" : "status";
    this.iconSlot.innerHTML = glyph(tone);
    this.#icon.hidden = this.hasAttribute("no-icon");
    const heading = this.getAttribute("heading");
    this.#title.textContent = heading ?? "";
    this.#title.hidden = !heading;
    this.syncAction();
  }
}
