import type { RovingFocus } from "@jcsoftdev/ui-core/roving";
import { adoptStyles, ElementBase, emit, rootOf } from "./base.js";
import { connectLight } from "./containers.js";
import type { CalendarEvent, CalendarMarker } from "./e12-cal.js";
import { localeOf } from "./e12-cal.js";

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
  /** Sheets of the chips and blocks the view renders. */
  protected abstract readonly shared: readonly string[];
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

  connectedCallback(): void {
    connectLight(this, this.name, this.css);
    for (const sheet of this.shared) adoptStyles(rootOf(this), sheet);
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
