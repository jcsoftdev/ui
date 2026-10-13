import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  ensureId,
} from "../internal/base.js";
import css from "./source.css.js";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * `<ui-source>`: a citation chip with a hover/focus preview of the source (host, title, excerpt).
 * Only http(s) and mailto URLs are linked (ui-core's `safeHref`, loaded lazily); anything else, and
 * the moment before that module arrives, renders a non-clickable chip button. A link opens in a
 * new tab with `rel="noopener noreferrer nofollow"`. The preview is described to assistive
 * technology through `aria-describedby`, shows on hover and keyboard focus, and Escape dismisses it
 * (WCAG 1.4.13). All text goes in through `textContent`.
 *
 * Attributes: `index` (citation number), `heading` (the React `title`, renamed so the browser does
 * not show a native tooltip), `url`, `snippet`.
 */
export class UiSource extends ElementBase {
  static observedAttributes = ["index", "heading", "url", "snippet"];

  readonly #link: HTMLAnchorElement;
  readonly #button: HTMLButtonElement;
  readonly #card: HTMLElement;
  readonly #cardHost: HTMLElement;
  readonly #cardTitle: HTMLElement;
  readonly #cardSnippet: HTMLElement;
  #href: string | null = null;
  #resolving = "";

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<a part="chip" target="_blank" rel="noopener noreferrer nofollow" hidden><span part="index"></span><span part="host"></span></a><button part="chip" type="button"><span part="index"></span><span part="host"></span></button><div part="card" role="tooltip"><p part="card-host"></p><p part="card-title"></p><p part="card-snippet"></p></div>';
    this.#link = root.querySelector("a") as HTMLAnchorElement;
    this.#button = root.querySelector("button") as HTMLButtonElement;
    this.#card = root.querySelector("[part=card]") as HTMLElement;
    this.#cardHost = root.querySelector("[part=card-host]") as HTMLElement;
    this.#cardTitle = root.querySelector("[part=card-title]") as HTMLElement;
    this.#cardSnippet = root.querySelector("[part=card-snippet]") as HTMLElement;
    this.#card.id = ensureId(this.#card, "source-card");
    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.#card.dataset.dismissed = "";
    });
    const reset = () => delete this.#card.dataset.dismissed;
    this.addEventListener("pointerleave", reset);
    this.addEventListener("focusout", reset);
  }

  get url(): string {
    return this.getAttribute("url") ?? "";
  }
  set url(value: string) {
    this.setAttribute("url", value);
  }
  get heading(): string {
    return this.getAttribute("heading") ?? "";
  }
  set heading(value: string) {
    this.setAttribute("heading", value);
  }

  connectedCallback(): void {
    this.#render();
    this.#resolve();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    this.#render();
    if (name === "url") this.#resolve();
  }

  #resolve(): void {
    const url = this.url;
    this.#resolving = url;
    this.#href = null;
    this.#swap();
    if (!url) return;
    import("@jcsoftdev/ui-core/markdown").then(({ safeHref }) => {
      if (this.#resolving !== url) return;
      this.#href = safeHref(url);
      this.#swap();
      this.#render();
    });
  }

  #swap(): void {
    const linked = this.#href !== null;
    this.#link.hidden = !linked;
    this.#button.hidden = linked;
    if (this.#href !== null) this.#link.href = this.#href;
    else this.#link.removeAttribute("href");
  }

  #render(): void {
    const host = hostOf(this.url);
    const heading = this.heading;
    const index = this.getAttribute("index");
    const snippet = this.getAttribute("snippet");
    const label = `${index ? `${index}: ` : ""}${heading ? `${heading}, ${host}` : host}`;
    for (const chip of [this.#link, this.#button]) {
      const indexPart = chip.querySelector("[part=index]") as HTMLElement;
      const hostPart = chip.querySelector("[part=host]") as HTMLElement;
      indexPart.textContent = index ?? "";
      indexPart.hidden = index === null;
      hostPart.textContent = host;
      chip.setAttribute("aria-label", label);
      chip.setAttribute("aria-describedby", this.#card.id);
    }
    this.#cardHost.textContent = host;
    this.#cardTitle.textContent = heading;
    this.#cardTitle.hidden = !heading;
    this.#cardSnippet.textContent = snippet ?? "";
    this.#cardSnippet.hidden = !snippet;
  }
}

/** Registers `<ui-source>` (or `<prefix-source>`) and returns the tag. */
export function defineSource(options?: DefineOptions): string {
  return defineElement("source", UiSource, options);
}
