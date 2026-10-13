import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./avatar.css.js";

/** Two letters for a single word, first and last initial otherwise. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return (words[0]?.slice(0, 2) ?? "").toUpperCase();
  const first = words[0]?.at(0) ?? "";
  const last = words.at(-1)?.at(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

/** Time the fallback is held back while an image loads, so a fast image never flashes initials. */
const FALLBACK_DELAY_MS = 400;

/**
 * `<ui-avatar>`: a round avatar (WAI-ARIA `img`, role on the host, named by `name`). It preloads
 * `src` off-DOM and shows the image once it has loaded; otherwise the initials of `name` show,
 * after a 400 ms delay while an image is still loading.
 * Attributes: `name` (required: initials and accessible name), `src`, `size` (`md` default, `lg`),
 * `highlighted` (fills with the accent colour). An `aria-label` on the host overrides the name.
 */
export class UiAvatar extends ElementBase {
  static observedAttributes = ["name", "src"];

  readonly #internals = this.attachInternals();
  readonly #image: HTMLImageElement;
  readonly #fallback: HTMLElement;
  #probe: HTMLImageElement | null = null;
  #timer = 0;
  #loaded = false;
  #delayElapsed = true;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<img part="image" alt="" hidden><span part="fallback" aria-hidden="true"></span>';
    this.#image = root.querySelector("img") as HTMLImageElement;
    this.#fallback = root.querySelector("[part=fallback]") as HTMLElement;
    this.#internals.role = "img";
  }

  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(value: string) {
    this.setAttribute("name", value);
  }
  get src(): string {
    return this.getAttribute("src") ?? "";
  }
  set src(value: string) {
    this.setAttribute("src", value);
  }

  connectedCallback(): void {
    this.#load();
    this.#paint();
  }

  disconnectedCallback(): void {
    this.#stop();
  }

  attributeChangedCallback(name: string): void {
    if (name === "src") {
      if (this.isConnected) this.#load();
    }
    this.#paint();
  }

  #stop(): void {
    clearTimeout(this.#timer);
    if (this.#probe) {
      this.#probe.onload = this.#probe.onerror = null;
      this.#probe = null;
    }
  }

  #load(): void {
    this.#stop();
    this.#loaded = false;
    const src = this.src;
    this.#delayElapsed = !src;
    if (!src) return;
    this.#timer = window.setTimeout(() => {
      this.#delayElapsed = true;
      this.#paint();
    }, FALLBACK_DELAY_MS);
    const probe = new window.Image();
    this.#probe = probe;
    const settle = () => {
      this.#loaded = probe.complete && probe.naturalWidth > 0;
      this.#paint();
    };
    probe.onload = settle;
    probe.onerror = settle;
    probe.src = src;
    if (probe.complete) settle();
  }

  #paint(): void {
    const name = this.name;
    this.#internals.ariaLabel = name;
    this.#fallback.textContent = initials(name);
    this.#fallback.hidden = this.#loaded || !this.#delayElapsed;
    this.#image.hidden = !this.#loaded;
    if (this.#loaded && this.#image.getAttribute("src") !== this.src)
      this.#image.setAttribute("src", this.src);
  }
}

/** Registers `<ui-avatar>` (or `<prefix-avatar>`) and returns the tag. */
export function defineAvatar(options?: DefineOptions): string {
  return defineElement("avatar", UiAvatar, options);
}
