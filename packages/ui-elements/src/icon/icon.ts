import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { attrNumber } from "../internal/e2-attrs.js";
import css from "./icon.css.js";
import type { IconName } from "./registry.js";

export type { IconName } from "./registry.js";

/** SVG children for a glyph, or a loader that resolves to them (an icon set loaded on demand). */
export type GlyphSource = string | (() => Promise<string | { default: string }>);

const custom = new Map<string, GlyphSource>();
const loaded = new Map<string, Promise<string | undefined>>();
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Registers your own glyph, or a whole set lazily: `registerIcon("logo", '<path d="..."/>')` or
 * `registerIcon("brand-x", () => import("./brand-x.js"))`. Custom names win over the built-in ones.
 * The value is the children of a 24px-grid stroke `<svg>`. Only markup you trust belongs here.
 */
export function registerIcon(name: string, source: GlyphSource): void {
  custom.set(name, source);
  loaded.delete(name);
}

/** Registers several glyphs at once (see `registerIcon`). */
export function registerIcons(sources: Record<string, GlyphSource>): void {
  for (const [name, source] of Object.entries(sources)) registerIcon(name, source);
}

const markupOf = (value: string | { default: string }): string =>
  typeof value === "string" ? value : value.default;

/**
 * Resolves a glyph name to its SVG children. Built-in glyphs are one module each, fetched on first
 * use and cached; the lookup map is its own lazy chunk. Resolves `undefined` for an unknown name.
 */
export function loadIcon(name: string): Promise<string | undefined> {
  let pending = loaded.get(name);
  if (!pending) {
    pending = resolveGlyph(name);
    loaded.set(name, pending);
  }
  return pending;
}

async function resolveGlyph(name: string): Promise<string | undefined> {
  const source = custom.get(name);
  if (source !== undefined) return markupOf(typeof source === "function" ? await source() : source);
  if (!NAME.test(name)) return undefined;
  const { registry } = await import("./registry.js");
  const load = (registry as Record<string, (() => Promise<{ default: string }>) | undefined>)[name];
  return load ? (await load()).default : undefined;
}

/**
 * `<ui-icon>`: one stroke icon of the 24px grid, drawn as an inline `<svg>` in its shadow root.
 * Glyphs load on demand (one lazy module per icon, cached), so a page pays only for the icons it
 * renders and never for the whole set. Decorative (hidden from assistive technology) unless it has
 * a `label`, then `role="img"` with that name (WAI-ARIA `img`).
 *
 * Attributes: `name` (an icon id such as `search` or `chevron-down`; see `IconName`; the React
 * kit's short names `grid`, `pen`, `file`, `coin`, `sync`, `close`, ... work too), `label`, `size`
 * (px, default 24), `stroke-width` (default 1.8), `absolute-stroke-width` (keep the stroke constant
 * when `size` changes). The colour is `currentColor`. Without `name`, a slotted `<svg>` shows
 * instead (the React `icon` prop). Own glyphs: `registerIcon()`.
 * Events: `load` (`detail.name`) once the glyph is drawn, `error` for an unknown name; like the
 * native ones they do not bubble (a bubbling `error` would reach `window.onerror`).
 */
export class UiIcon extends ElementBase {
  static observedAttributes = ["name", "label", "size", "stroke-width", "absolute-stroke-width"];

  readonly #internals = this.attachInternals();
  readonly #svg: SVGSVGElement;
  #shown = "";
  #request = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<svg part="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden></svg><slot></slot>';
    this.#svg = root.querySelector("svg") as SVGSVGElement;
  }

  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(value: IconName | (string & {})) {
    this.setAttribute("name", value);
  }
  get label(): string {
    return this.getAttribute("label") ?? "";
  }
  set label(value: string) {
    this.setAttribute("label", value);
  }

  connectedCallback(): void {
    this.#sync();
    if (this.name && this.#shown !== this.name) this.#load();
  }

  attributeChangedCallback(name: string): void {
    if (name === "name") this.#load();
    this.#sync();
  }

  #sync(): void {
    const size = this.getAttribute("size")?.trim() || "24";
    const stroke = attrNumber(this, "stroke-width", 1.8);
    const px = Number(size);
    const scaled =
      this.hasAttribute("absolute-stroke-width") && px > 0 ? (stroke * 24) / px : stroke;
    this.#svg.setAttribute("width", size);
    this.#svg.setAttribute("height", size);
    this.#svg.setAttribute("stroke-width", String(scaled));
    const label = this.label;
    this.#internals.role = label ? "img" : null;
    this.#internals.ariaLabel = label || null;
    this.#internals.ariaHidden = label ? null : "true";
  }

  #load(): void {
    const name = this.name;
    const request = ++this.#request;
    if (!name) {
      this.#shown = "";
      this.#svg.toggleAttribute("hidden", true);
      this.#svg.replaceChildren();
      return;
    }
    if (!this.isConnected) return;
    loadIcon(name).then((markup) => {
      if (request !== this.#request) return;
      if (markup === undefined) {
        this.#shown = "";
        this.#svg.toggleAttribute("hidden", true);
        this.#svg.replaceChildren();
        this.dispatchEvent(new CustomEvent("error", { detail: { name } }));
        return;
      }
      this.#svg.innerHTML = markup;
      this.#svg.toggleAttribute("hidden", false);
      this.#shown = name;
      this.dispatchEvent(new CustomEvent("load", { detail: { name } }));
    });
  }
}

/** Registers `<ui-icon>` (or `<prefix-icon>`) and returns the tag. */
export function defineIcon(options?: DefineOptions): string {
  return defineElement("icon", UiIcon, options);
}
