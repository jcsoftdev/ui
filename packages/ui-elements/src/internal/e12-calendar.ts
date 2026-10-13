import type { RovingFocus } from "@jcsoftdev/ui-core/roving";
import { adoptStyles, ElementBase, emit, rootOf } from "./base.js";
import { connectLight } from "./containers.js";
import css from "./e12-calendar.css.js";

/** Visual tone shared by events and markers. */
export type CalendarTone = "accent" | "neutral" | "success" | "danger" | "warning";

/** A calendar event. Dates are "YYYY-MM-DD", times are "HH:mm". */
export interface CalendarEvent {
  id: string;
  date: string;
  start: string;
  end?: string;
  title: string;
  subtitle?: string;
  tone?: CalendarTone;
  /** Screen-reader-only text announced before the title (e.g. the event kind). */
  srLabel?: string;
  /** All-day events render in the week view's top row instead of the hour grid. */
  allDay?: boolean;
  /** Optional text or node rendered at the end of the detailed block (e.g. an avatar). */
  trailing?: string | Node;
}

/** A single-day marker rendered as a chip (deadline, reminder, holiday...). */
export interface CalendarMarker {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  tone?: "danger" | "accent";
  srLabel?: string;
}

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cal: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.cal = cal;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(cal: string, kind: string, id: string): HTMLButtonElement {
  const element = node("button", cal);
  element.type = "button";
  element.dataset.kind = kind;
  element.dataset.id = id;
  element.dataset.key = `${kind}:${id}`;
  return element;
}

const srLabel = (text: string | undefined) => (text ? node("span", "sr", `${text} `) : null);

/** The compact chip button of a marker (React `DayChip`). */
export function markerButton(marker: CalendarMarker): HTMLButtonElement {
  const chip = button("chip", "marker", marker.id);
  chip.dataset.tone = marker.tone ?? "accent";
  chip.append(srLabel(marker.srLabel) ?? "", marker.title);
  if (marker.subtitle) chip.append(node("span", "subtitle", ` · ${marker.subtitle}`));
  return chip;
}

/**
 * The button of an event (React `EventBlock`). `trailing` overrides `event.trailing`; the
 * standalone element passes a slot.
 */
export function eventButton(
  event: CalendarEvent,
  variant: "detailed" | "compact" = "detailed",
  trailing: string | Node | undefined = event.trailing,
): HTMLButtonElement {
  const block = button("event", "event", event.id);
  block.dataset.tone = event.tone ?? "accent";
  block.dataset.variant = variant;
  block.append(srLabel(event.srLabel) ?? "");
  if (variant === "compact") {
    block.append(`${event.start} ${event.title}`);
    return block;
  }
  const layout = node("span", "layout");
  const body = node("span", "body");
  body.append(node("span", "title", event.title));
  if (event.subtitle) body.append(node("span", "subtitle", event.subtitle));
  layout.append(
    node("span", "time", event.end ? `${event.start}–${event.end}` : event.start),
    body,
  );
  if (trailing) {
    const end = node("span", "trailing");
    end.append(
      typeof trailing === "string" || trailing instanceof HTMLSlotElement
        ? trailing
        : trailing.cloneNode(true),
    );
    layout.append(end);
  }
  block.append(layout);
  return block;
}

/** Locale for labels: the `locale` attribute, else the nearest `lang`, else the runtime default. */
export function localeOf(host: Element): string | undefined {
  return (
    (host.getAttribute("locale") ?? host.closest("[lang]")?.getAttribute("lang") ?? undefined) ||
    undefined
  );
}

/**
 * First day of the week: `week-starts-on="0".."6"` (7 also means Sunday), or `auto` for the
 * locale's own week (`Intl.Locale` week info). Defaults to 1 (Monday), like the React kit.
 */
export function weekStartOf(host: Element, locale: string | undefined): WeekStart {
  const value = host.getAttribute("week-starts-on");
  if (value === "auto") {
    try {
      const intl = new Intl.Locale(locale ?? navigator.language) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
      };
      const first = (intl.getWeekInfo?.() ?? intl.weekInfo)?.firstDay;
      if (first) return (first % 7) as WeekStart;
    } catch {
      /* unknown locale: fall through to Monday */
    }
    return 1;
  }
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 0 && number <= 7
    ? ((number % 7) as WeekStart)
    : 1;
}

const list = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function json<T>(value: string | null): T[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Base of the calendar views (light DOM): data in (`events`, `markers`, `shadedDates` properties
 * or JSON/comma attributes), batched re-render, click delegation to `open-event`, `open-marker`
 * and `select-date`, focus kept across renders, and opt-in roving focus (`roving` attribute, ui-core
 * loaded on demand).
 */
export abstract class CalendarView extends ElementBase {
  static observedAttributes: string[] = [
    "today",
    "locale",
    "week-starts-on",
    "shaded-dates",
    "events",
    "markers",
    "roving",
  ];

  #events?: CalendarEvent[];
  #markers?: CalendarMarker[];
  #shaded?: string[];
  #pending = false;
  #roving?: RovingFocus;
  #resize?: ResizeObserver;
  #rovingToken = 0;

  protected abstract readonly name: string;
  protected abstract readonly css: string;
  /** The view's content, rebuilt on every render. */
  protected abstract build(): Node[];

  constructor() {
    super();
    this.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>("button[data-kind]");
      if (!target || !this.contains(target)) return;
      const { kind, id, date } = target.dataset;
      if (kind === "event") emit(this, "open-event", { id });
      else if (kind === "marker") emit(this, "open-marker", { id });
      else if (kind === "more") emit(this, "select-date", { date });
    });
  }

  get events(): CalendarEvent[] {
    return this.#events ?? json<CalendarEvent>(this.getAttribute("events"));
  }
  set events(value: CalendarEvent[]) {
    this.#events = value;
    this.schedule();
  }

  get markers(): CalendarMarker[] {
    return this.#markers ?? json<CalendarMarker>(this.getAttribute("markers"));
  }
  set markers(value: CalendarMarker[]) {
    this.#markers = value;
    this.schedule();
  }

  /** Dates rendered with a hatch pattern (non-working days). */
  get shadedDates(): string[] {
    return this.#shaded ?? list(this.getAttribute("shaded-dates"));
  }
  set shadedDates(value: string[]) {
    this.#shaded = value;
    this.schedule();
  }

  /** "YYYY-MM-DD" highlighted as today; the view never reads the clock. */
  get today(): string {
    return this.getAttribute("today") ?? "";
  }
  set today(value: string) {
    this.setAttribute("today", value);
  }

  protected get locale(): string | undefined {
    return localeOf(this);
  }

  protected get weekStartsOn(): WeekStart {
    return weekStartOf(this, this.locale);
  }

  connectedCallback(): void {
    connectLight(this, this.name, this.css);
    adoptStyles(rootOf(this), css);
    this.render();
  }

  disconnectedCallback(): void {
    this.#rovingToken++;
    this.#stopRoving();
  }

  attributeChangedCallback(): void {
    this.schedule();
  }

  protected schedule(): void {
    if (this.#pending || !this.isConnected) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (this.isConnected) this.render();
    });
  }

  protected render(): void {
    const active = this.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.key
      : undefined;
    this.replaceChildren(...this.build());
    if (active) this.querySelector<HTMLElement>(`[data-key="${CSS.escape(active)}"]`)?.focus();
    void this.#syncRoving();
  }

  async #syncRoving(): Promise<void> {
    const token = ++this.#rovingToken;
    if (!this.hasAttribute("roving")) {
      this.#stopRoving();
      return;
    }
    if (!this.#roving) {
      const { createRovingFocus } = await import("@jcsoftdev/ui-core/roving");
      if (token !== this.#rovingToken || !this.isConnected) return;
      this.#roving = createRovingFocus(this, {
        items: () =>
          Array.from(this.querySelectorAll<HTMLElement>("button[data-kind]")).filter((item) =>
            item.checkVisibility(),
          ),
      });
      // A container query can swap the visible items (chips and dots): keep a tab stop on one.
      this.#resize = new ResizeObserver(() => this.#roving?.update());
      this.#resize.observe(this);
    }
    this.#roving.update();
  }

  #stopRoving(): void {
    this.#roving?.destroy();
    this.#resize?.disconnect();
    this.#roving = this.#resize = undefined;
  }
}

/** Creates an element with `data-cal`; shared by the views' templates. */
export const cal = node;
