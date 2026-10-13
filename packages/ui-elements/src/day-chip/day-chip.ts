import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import calendarCss from "../internal/e12-calendar.css.js";
import { type CalendarMarker, markerButton } from "../internal/e12-calendar.js";
import css from "./day-chip.css.js";

/**
 * `<ui-day-chip>`: a compact single-line chip for a day marker (deadline, reminder, holiday). The
 * shadow root holds one native `<button>`, so the role, name, Enter and Space are the platform's;
 * focus delegates to it. Data is the `marker` property (`CalendarMarker`) or the attributes below.
 *
 * Attributes: `heading` (the title), `subtitle`, `tone` (`accent` default, `danger`), `sr-label`
 * (text announced before the title), `marker-id`. Events: `open` with `{ id }` on activation (the
 * React `onOpen`); the native `click` bubbles too.
 */
export class UiDayChip extends ElementBase {
  static observedAttributes = ["heading", "subtitle", "tone", "sr-label", "marker-id"];

  readonly #root: ShadowRoot;
  #marker?: CalendarMarker;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(this.#root, calendarCss);
    adoptStyles(this.#root, css);
    this.#root.addEventListener("click", (event) => {
      if ((event.target as Element).closest("button")) emit(this, "open", { id: this.marker.id });
    });
  }

  get marker(): CalendarMarker {
    return (
      this.#marker ?? {
        id: this.getAttribute("marker-id") ?? "",
        date: "",
        title: this.getAttribute("heading") ?? "",
        subtitle: this.getAttribute("subtitle") ?? undefined,
        tone: this.getAttribute("tone") === "danger" ? "danger" : "accent",
        srLabel: this.getAttribute("sr-label") ?? undefined,
      }
    );
  }
  set marker(value: CalendarMarker) {
    this.#marker = value;
    this.#render();
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const focused = this.#root.activeElement !== null;
    const chip = markerButton(this.marker);
    const old = this.#root.querySelector("button");
    if (old) old.replaceWith(chip);
    else this.#root.append(chip);
    if (focused) chip.focus();
  }
}

/** Registers `<ui-day-chip>` (or `<prefix-day-chip>`) and returns the tag. */
export function defineDayChip(options?: DefineOptions): string {
  return defineElement("day-chip", UiDayChip, options);
}
