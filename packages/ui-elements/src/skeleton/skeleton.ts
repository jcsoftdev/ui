import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./skeleton.css.js";

const MAX = 12;

const count = (value: string | null, fallback: number) => {
  const n = value === null ? fallback : Number(value);
  return Math.min(MAX, Math.max(0, Number.isFinite(n) ? Math.trunc(n) : fallback));
};

const repeat = (part: string, n: number) => `<div part="${part}"></div>`.repeat(n);

/**
 * `<ui-skeleton>`: a placeholder while content loads (WAI-ARIA `status`, `aria-busy="true"`, the
 * role and busy state are on the host through ElementInternals). The pulse stops with
 * `prefers-reduced-motion: reduce`.
 * Attributes: `variant` (`lines` default, `table`, `card`), `lines` (default 3, max 12), `rows`
 * (default 4, max 12), `label` (the accessible name, default `Loading`).
 */
export class UiSkeleton extends ElementBase {
  static observedAttributes = ["variant", "lines", "rows", "label"];

  readonly #internals = this.attachInternals();
  readonly #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    adoptStyles(this.#shadow, css);
    this.#internals.role = "status";
    this.#internals.ariaBusy = "true";
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    this.#internals.ariaLabel = this.getAttribute("label") ?? "Loading";
    const variant = this.getAttribute("variant");
    if (variant === "card") this.#shadow.innerHTML = '<div part="card"></div>';
    else if (variant === "table")
      this.#shadow.innerHTML = `<div part="stack">${repeat("row", count(this.getAttribute("rows"), 4))}</div>`;
    else
      this.#shadow.innerHTML = `<div part="stack">${repeat("line", count(this.getAttribute("lines"), 3))}</div>`;
  }
}

/** Registers `<ui-skeleton>` (or `<prefix-skeleton>`) and returns the tag. */
export function defineSkeleton(options?: DefineOptions): string {
  return defineElement("skeleton", UiSkeleton, options);
}
