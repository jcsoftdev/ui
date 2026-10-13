import { formatNumber, type NumberFormatConfig } from "@jcsoftdev/ui-core/number";
import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { attrJson } from "../internal/e2-attrs.js";
import css from "./kpi.css.js";

const PARTS = ["label", "value", "suffix", "description"] as const;
type Part = (typeof PARTS)[number];

/**
 * `<ui-kpi>`: a metric tile: a label, a highlighted value, an optional suffix (`/12`) and an
 * optional description. Each part comes from an attribute or, for rich content, from a slot of the
 * same name (`slot="label"`, `"value"`, `"suffix"`, `"description"`; a slotted part wins). Put a
 * `<ui-number-value slot="value">` there for a count-up value. No ARIA role.
 *
 * Attributes: `label`, `value`, `suffix`, `description`, `variant` (`default`, `danger`). The value
 * is shown as written ("already formatted by the consumer", like the React kit). Add `format`
 * (a JSON object of Intl options) or `locale` and a numeric `value` is formatted with
 * `@jcsoftdev/ui-core/number` instead. The value shrinks when the tile is narrower than 9rem.
 */
export class UiKpi extends ElementBase {
  static observedAttributes = ["label", "value", "suffix", "description", "format", "locale"];

  readonly #parts = {} as Record<Part, HTMLElement>;
  readonly #slots = {} as Record<Part, HTMLSlotElement>;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<span part="label"><slot name="label"></slot></span>' +
      '<span part="value"><slot name="value"></slot><small part="suffix"><slot name="suffix"></slot></small></span>' +
      '<span part="description"><slot name="description"></slot></span>';
    for (const part of PARTS) {
      const slot = root.querySelector<HTMLSlotElement>(`slot[name=${part}]`) as HTMLSlotElement;
      this.#slots[part] = slot;
      this.#parts[part] = slot.parentElement as HTMLElement;
      slot.addEventListener("slotchange", () => this.#render());
    }
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #text(part: Part): string {
    const raw = this.getAttribute(part);
    if (raw === null || part !== "value") return raw ?? "";
    const format = attrJson<NumberFormatConfig>(this, "format");
    const locale = this.getAttribute("locale");
    const number = raw.trim() === "" ? Number.NaN : Number(raw);
    if ((!format && !locale) || !Number.isFinite(number)) return raw;
    return formatNumber(number, { ...format, ...(locale ? { locale } : {}) });
  }

  #render(): void {
    for (const part of PARTS) {
      const slot = this.#slots[part];
      const text = this.#text(part);
      slot.textContent = text;
      this.#parts[part].hidden = text === "" && slot.assignedNodes().length === 0;
    }
  }
}

/** Registers `<ui-kpi>` (or `<prefix-kpi>`) and returns the tag. */
export function defineKpi(options?: DefineOptions): string {
  return defineElement("kpi", UiKpi, options);
}
