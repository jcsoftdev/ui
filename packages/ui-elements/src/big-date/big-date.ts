import { parseDate } from "@jcsoftdev/ui-core/date";
import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { attrJson } from "../internal/e2-attrs.js";
import css from "./big-date.css.js";

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
};

/**
 * `<ui-big-date>`: a prominent date or number, typically at the top of a card. Give it a `value`
 * (a `YYYY-MM-DD` calendar date, read in UTC so it never shifts by time zone, parsed by
 * `@jcsoftdev/ui-core/date`) and it renders a localized `<time datetime>`; without `value` it
 * shows its children, like the React kit's text-only `BigDate`. No ARIA role.
 *
 * Attributes: `value`, `locale` (default: the page language), `format` (a JSON object of
 * `Intl.DateTimeFormat` options, default weekday + day + month in full), `size` (`normal`,
 * `compact`).
 */
export class UiBigDate extends ElementBase {
  static observedAttributes = ["value", "locale", "format"];

  readonly #time: HTMLTimeElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<time part="date" hidden></time><slot></slot>';
    this.#time = root.querySelector("time") as HTMLTimeElement;
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    this.setAttribute("value", value);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const value = this.value;
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime());
    this.#time.hidden = !valid;
    this.toggleAttribute("data-dated", valid);
    if (!valid) {
      this.#time.textContent = "";
      this.#time.removeAttribute("datetime");
      return;
    }
    const options = { ...DEFAULT_FORMAT, ...attrJson<Intl.DateTimeFormatOptions>(this, "format") };
    this.#time.dateTime = value;
    this.#time.textContent = new Intl.DateTimeFormat(this.getAttribute("locale") || undefined, {
      ...options,
      timeZone: "UTC",
    }).format(parseDate(value));
  }
}

/** Registers `<ui-big-date>` (or `<prefix-big-date>`) and returns the tag. */
export function defineBigDate(options?: DefineOptions): string {
  return defineElement("big-date", UiBigDate, options);
}
