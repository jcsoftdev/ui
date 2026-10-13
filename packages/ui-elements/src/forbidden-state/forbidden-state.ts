import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import state from "../internal/e3-state.css.js";

/**
 * `<ui-forbidden-state>`: shown when the user lacks permission (WAI-ARIA `alert`, role on the host).
 * Say why, e.g. depending on role, never just "Forbidden".
 * Attributes: `heading` (React `title`), `reason`.
 */
export class UiForbiddenState extends ElementBase {
  static observedAttributes = ["heading", "reason"];

  readonly #internals = this.attachInternals();
  readonly #title: HTMLElement;
  readonly #reason: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, state);
    root.innerHTML = '<div part="root"><p part="title"></p><p part="description" hidden></p></div>';
    this.#title = root.querySelector("[part=title]") as HTMLElement;
    this.#reason = root.querySelector("[part=description]") as HTMLElement;
    this.#internals.role = "alert";
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    this.#title.textContent = this.getAttribute("heading") ?? "";
    const reason = this.getAttribute("reason");
    this.#reason.textContent = reason ?? "";
    this.#reason.hidden = !reason;
  }
}

/** Registers `<ui-forbidden-state>` (or `<prefix-forbidden-state>`) and returns the tag. */
export function defineForbiddenState(options?: DefineOptions): string {
  return defineElement("forbidden-state", UiForbiddenState, options);
}
