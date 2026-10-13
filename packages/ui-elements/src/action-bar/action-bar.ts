import { type DefineOptions, defineElement, ElementBase, emit } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { gather, icon, part, startRoving } from "../internal/e10.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./action-bar.css.js";

const X = icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

/**
 * `<ui-action-bar>`: the floating toolbar for bulk actions on a selection. It shows
 * `selected-count` with a polite live count, then the actions you put inside it (usually buttons),
 * then an optional clear button. It renders nothing (`hidden`) while the count is 0.
 *
 * ARIA: `role="toolbar"` with an accessible name (`label`). The count is an `aria-live="polite"`
 * region. Escape, when the bar is `clearable`, clears the selection. By default every action is a
 * tab stop, as in the React kit; the `roving` attribute turns the actions into one tab stop with
 * arrow-key navigation (APG toolbar), loaded on demand.
 *
 * Attributes: `selected-count`; `noun-singular` / `noun-plural` (default "seleccionado" /
 * "seleccionados"); `label` (default "Acciones para la selección"); `clearable` (adds the close
 * button and the Escape shortcut); `clear-label` (default "Limpiar selección"); `position`
 * (`absolute` by default: floats at the bottom of the nearest positioned ancestor, `fixed` floats
 * over the viewport, `static` renders inline); `roving`; `material="liquid" | "liquid-clear"` with
 * the `liquid-*` options.
 * Events: `clear` (bubbles) from the close button or Escape. The bar does not change the count:
 * handle `clear` and set `selected-count` yourself.
 */
export class UiActionBar extends ElementBase {
  static observedAttributes: string[] = [
    "selected-count",
    "noun-singular",
    "noun-plural",
    "label",
    "clearable",
    "clear-label",
    "roving",
    ...MATERIAL_ATTRIBUTES,
  ];

  readonly #material = new Material(this, () => this);
  readonly #count = part("span", "count");
  readonly #actions = part("div", "actions");
  readonly #clear = part("button", "clear");
  #stopGather: (() => void) | undefined;
  #stopRoving: (() => void) | undefined;

  constructor() {
    super();
    this.#count.setAttribute("aria-live", "polite");
    this.#clear.type = "button";
    this.#clear.innerHTML = X;
    this.#clear.addEventListener("click", () => emit(this, "clear"));
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.hasAttribute("clearable")) return;
      event.stopPropagation();
      emit(this, "clear");
    });
  }

  /** Number of selected items; the bar is hidden while it is 0. */
  get selectedCount(): number {
    return Number(this.getAttribute("selected-count")) || 0;
  }

  set selectedCount(value: number) {
    this.setAttribute("selected-count", String(value));
  }

  connectedCallback(): void {
    connectLight(this, "action-bar", css);
    this.#stopGather = gather(
      this,
      () => this.#actions,
      (child) => child === this.#count || child === this.#actions || child === this.#clear,
    );
    this.prepend(this.#count);
    this.#count.after(this.#actions);
    this.#sync();
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#stopGather?.();
    this.#stopRoving?.();
    this.#stopRoving = undefined;
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "roving") this.#syncRoving();
    else if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) this.#material.sync();
    else this.#sync();
  }

  #sync(): void {
    const count = this.selectedCount;
    this.hidden = count <= 0;
    this.setAttribute("role", "toolbar");
    this.setAttribute("aria-label", this.getAttribute("label") ?? "Acciones para la selección");
    const noun =
      count === 1
        ? (this.getAttribute("noun-singular") ?? "seleccionado")
        : (this.getAttribute("noun-plural") ?? "seleccionados");
    this.#count.textContent = `${count} ${noun}`;
    this.#clear.setAttribute("aria-label", this.getAttribute("clear-label") ?? "Limpiar selección");
    if (this.hasAttribute("clearable")) this.append(this.#clear);
    else this.#clear.remove();
    this.#syncRoving();
  }

  #syncRoving(): void {
    this.#stopRoving?.();
    this.#stopRoving = this.hasAttribute("roving") ? startRoving(this, "horizontal") : undefined;
  }
}

/** Registers `<ui-action-bar>` (or the same under another prefix) and returns its tag. */
export function defineActionBar(options?: DefineOptions): string {
  return defineElement("action-bar", UiActionBar, options);
}
