import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { gather, part } from "../internal/e10.js";
import css from "./timeline.css.js";

/**
 * `<ui-timeline>`: a vertical activity feed with a marker rail on the left, grouped by day,
 * newest first by convention. Put `<ui-timeline-item>` children in it.
 *
 * ARIA: a `role="list"` of `role="listitem"`; the marker rail is decorative. Items with the same
 * `group` sit under one heading (the heading is shown when the group differs from the previous
 * item's).
 */
export class UiTimeline extends ElementBase {
  #observer: MutationObserver | undefined;

  connectedCallback(): void {
    connectLight(this, "timeline", css);
    this.setAttribute("role", "list");
    this.#observer = new MutationObserver(() => this.refresh());
    this.#observer.observe(this, { childList: true });
    this.refresh();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  /** Recomputes the group headings (also when items are added or removed); items call it when their `group` changes. */
  refresh(): void {
    let previous: string | null = null;
    for (const item of this.children) {
      if (!(item instanceof UiTimelineItem)) continue;
      const group = item.getAttribute("group");
      item.showGroup(group && group !== previous ? group : null);
      previous = group;
    }
  }
}

/**
 * `<ui-timeline-item>`: one entry of a timeline. Attributes: `heading` (the title), `description`,
 * `time` (display text such as "Hace 5 min"), `datetime` (machine value of the `<time>` element),
 * `actor`, `tone` (`neutral` default, `accent`, `success`, `warning`, `danger`), `group`. A child
 * with `slot="icon"` goes in the marker (without it the marker is a dot); any other child goes
 * under the text (attachments, chips, actions).
 */
export class UiTimelineItem extends ElementBase {
  static observedAttributes = [
    "heading",
    "description",
    "time",
    "datetime",
    "actor",
    "tone",
    "group",
  ];

  readonly #group = part("h4", "group");
  readonly #row = part("div", "row");
  readonly #marker = part("span", "marker");
  readonly #dot = part("span", "dot");
  readonly #connector = part("span", "connector");
  readonly #content = part("div", "content");
  readonly #header = part("div", "header");
  readonly #title = part("span", "title");
  readonly #time = part("time", "time");
  readonly #actor = part("span", "actor");
  readonly #description = part("p", "description");
  readonly #extras = part("div", "extras");
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#marker.setAttribute("aria-hidden", "true");
    this.#connector.setAttribute("aria-hidden", "true");
    const rail = part("div", "rail");
    rail.append(this.#marker, this.#connector);
    this.#header.append(this.#title);
    this.#content.append(this.#header);
    this.#row.append(rail, this.#content);
    this.#marker.append(this.#dot);
  }

  connectedCallback(): void {
    connectLight(this, "timeline-item", css);
    this.setAttribute("role", "listitem");
    this.append(this.#row);
    this.#stop = gather(
      this,
      (child) => (child.getAttribute("slot") === "icon" ? this.#marker : this.#extras),
      (child) => child === this.#row || child === this.#group,
      () => this.#render(),
    );
    this.#render();
    this.#parent()?.refresh();
  }

  disconnectedCallback(): void {
    this.#stop?.();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    this.#render();
    if (name === "group") this.#parent()?.refresh();
  }

  /** Shows `group` as this item's heading, or no heading for `null`. Called by the timeline. */
  showGroup(group: string | null): void {
    this.#group.textContent = group ?? "";
    if (group) this.prepend(this.#group);
    else this.#group.remove();
  }

  #parent(): UiTimeline | null {
    const parent = this.closest('[data-ui="timeline"]');
    return parent instanceof UiTimeline ? parent : null;
  }

  #render(): void {
    this.dataset.tone = this.getAttribute("tone") ?? "neutral";
    this.#title.textContent = this.getAttribute("heading") ?? "";
    const time = this.getAttribute("time");
    if (time) {
      this.#time.textContent = time;
      const dateTime = this.getAttribute("datetime");
      if (dateTime) this.#time.dateTime = dateTime;
      else this.#time.removeAttribute("datetime");
      this.#header.append(this.#time);
    } else this.#time.remove();
    const actor = this.getAttribute("actor");
    this.#actor.textContent = actor ?? "";
    const description = this.getAttribute("description");
    this.#description.textContent = description ?? "";
    this.#content.replaceChildren(
      this.#header,
      ...(actor ? [this.#actor] : []),
      ...(description ? [this.#description] : []),
      ...(this.#extras.firstChild ? [this.#extras] : []),
    );
    const custom = Array.from(this.#marker.children).some((child) => child !== this.#dot);
    if (custom) this.#dot.remove();
    else if (!this.#dot.isConnected) this.#marker.append(this.#dot);
  }
}

/** Registers `<ui-timeline>` and `<ui-timeline-item>` (or the same under another prefix); returns the timeline tag. */
export function defineTimeline(options?: DefineOptions): string {
  defineElement("timeline-item", UiTimelineItem, options);
  return defineElement("timeline", UiTimeline, options);
}
