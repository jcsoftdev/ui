import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import {
  generateMark,
  type MarkDescription,
  type MarkOptions,
  serializeMark,
} from "../internal/e15-brand.js";
import { markOptionsFromAttributes, renderMark } from "../internal/e15-brand-dom.js";
import css from "./logo-mark.css.js";

const ATTRIBUTES = [
  "name",
  "tagline",
  "initials",
  "initials-count",
  "shape",
  "monogram",
  "glyph",
  "layout",
  "fill",
  "palette",
  "palette-primary",
  "palette-secondary",
  "palette-ink",
  "seed",
  "ring",
  "weight",
  "tracking",
  "uppercase",
  "background",
  "wordmark-color",
  "size",
] as const;

/**
 * `<ui-logo-mark>`: a generated brand mark (shape, monogram or glyph, optional wordmark and
 * tagline) drawn as an inline `<svg role="img">` whose accessible name is the mark's label. It is
 * deterministic: the same attributes always give the same SVG, so server and client agree.
 *
 * Attributes (React prop in parentheses): `name`, `tagline`, `initials`, `initials-count` (1-3),
 * `shape` (circle, squircle, shield, hexagon, badge, ribbon, none), `monogram` (initials | glyph),
 * `glyph`, `layout` (icon | horizontal | stacked), `fill` (solid | gradient | outline), `palette` (a
 * palette id such as `navaja`; `palette-primary`, `palette-secondary` and `palette-ink` make a custom
 * one), `seed`, `ring`, `weight`, `tracking`, `uppercase` (the `wordmark` object), `background`,
 * `wordmark-color`, `size` (`size`: any CSS width, default the full container). The `options`
 * property takes a full `MarkOptions` object and wins over the attributes; `mark` returns the
 * generated description (viewBox, size, label) and `toSvg()` the standalone SVG source.
 */
export class UiLogoMark extends ElementBase {
  static observedAttributes: string[] = [...ATTRIBUTES];

  readonly #internals = this.attachInternals();
  readonly #root: ShadowRoot;
  #options: MarkOptions | undefined;
  #mark: MarkDescription | undefined;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    adoptStyles(this.#root, css);
    this.#internals.role = "img";
  }

  /** Full generator options; when set, they replace the attribute-derived ones. */
  get options(): MarkOptions | undefined {
    return this.#options;
  }
  set options(value: MarkOptions | undefined) {
    this.#options = value;
    this.#render();
  }

  /** The generated mark (`undefined` until connected). */
  get mark(): MarkDescription | undefined {
    return this.#mark;
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  /** The standalone SVG source of the current mark. */
  toSvg(): string {
    return serializeMark(
      this.#mark ?? generateMark(this.#options ?? markOptionsFromAttributes(this)),
    );
  }

  #render(): void {
    const mark = generateMark(this.#options ?? markOptionsFromAttributes(this));
    this.#mark = mark;
    this.#internals.ariaLabel = mark.label;
    const svg = renderMark(mark, this.getAttribute("size") ?? "100%");
    // The host is the image (role and name on ElementInternals); the drawing is decorative.
    svg.removeAttribute("role");
    svg.removeAttribute("aria-label");
    svg.setAttribute("aria-hidden", "true");
    this.#root.replaceChildren(svg);
  }
}

/** Registers `<ui-logo-mark>` (or `<prefix-logo-mark>`) and returns the tag. */
export function defineLogoMark(options?: DefineOptions): string {
  return defineElement("logo-mark", UiLogoMark, options);
}
