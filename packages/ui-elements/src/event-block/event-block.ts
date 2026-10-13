import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import calendarCss from "../internal/e12-calendar.css.js";
import { type CalendarEvent, type CalendarTone, eventButton } from "../internal/e12-calendar.js";
import css from "./event-block.css.js";

const TONES: readonly CalendarTone[] = ["accent", "neutral", "success", "danger", "warning"];

/**
 * `<ui-event-block>`: one calendar event as a block. The shadow root holds one native `<button>`
 * (role, name, Enter and Space are the platform's; focus delegates to it). `variant="detailed"`
 * shows the time range, title and subtitle (a container query drops the trailing part under 28rem
 * and stacks under 9rem); `variant="compact"` is one `time title` line. Data is the `event`
 * property (`CalendarEvent`) or the attributes below; the detailed variant also renders
 * `slot="trailing"` (the React `event.trailing`).
 *
 * Attributes: `heading` (the title), `subtitle`, `start`, `end`, `tone` (`accent` default,
 * `neutral`, `success`, `danger`, `warning`), `variant`, `sr-label`, `event-id`. Events: `open`
 * with `{ id }` on activation (the React `onOpen`); the native `click` bubbles too.
 */
export class UiEventBlock extends ElementBase {
  static observedAttributes = [
    "heading",
    "subtitle",
    "start",
    "end",
    "tone",
    "variant",
    "sr-label",
    "event-id",
  ];

  readonly #root: ShadowRoot;
  #event?: CalendarEvent;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(this.#root, calendarCss);
    adoptStyles(this.#root, css);
    this.#root.addEventListener("click", (event) => {
      if ((event.target as Element).closest("button")) emit(this, "open", { id: this.event.id });
    });
  }

  get event(): CalendarEvent {
    const tone = this.getAttribute("tone") as CalendarTone;
    return (
      this.#event ?? {
        id: this.getAttribute("event-id") ?? "",
        date: "",
        start: this.getAttribute("start") ?? "",
        end: this.getAttribute("end") ?? undefined,
        title: this.getAttribute("heading") ?? "",
        subtitle: this.getAttribute("subtitle") ?? undefined,
        tone: TONES.includes(tone) ? tone : "accent",
        srLabel: this.getAttribute("sr-label") ?? undefined,
      }
    );
  }
  set event(value: CalendarEvent) {
    this.#event = value;
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
    const variant = this.getAttribute("variant") === "compact" ? "compact" : "detailed";
    const event = this.event;
    const slot = event.trailing ? undefined : document.createElement("slot");
    if (slot) slot.name = "trailing";
    const block = eventButton(event, variant, slot);
    const trailing = block.querySelector<HTMLElement>('[data-cal="trailing"]');
    if (slot && trailing) {
      trailing.hidden = true;
      slot.addEventListener("slotchange", () => {
        trailing.hidden = slot.assignedNodes().length === 0;
      });
    }
    const old = this.#root.querySelector("button");
    if (old) old.replaceWith(block);
    else this.#root.append(block);
    if (focused) block.focus();
  }
}

/** Registers `<ui-event-block>` (or `<prefix-event-block>`) and returns the tag. */
export function defineEventBlock(options?: DefineOptions): string {
  return defineElement("event-block", UiEventBlock, options);
}
