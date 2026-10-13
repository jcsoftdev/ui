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

export function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cal: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.cal = cal;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function button(cal: string, kind: string, id: string): HTMLButtonElement {
  const element = node("button", cal);
  element.type = "button";
  element.dataset.kind = kind;
  element.dataset.id = id;
  element.dataset.key = `${kind}:${id}`;
  return element;
}

export const srLabel = (text: string | undefined) => (text ? node("span", "sr", `${text} `) : null);

/** Locale for labels: the `locale` attribute, else the nearest `lang`, else the runtime default. */
export function localeOf(host: Element): string | undefined {
  return (
    (host.getAttribute("locale") ?? host.closest("[lang]")?.getAttribute("lang") ?? undefined) ||
    undefined
  );
}

/** Creates an element with `data-cal`. */
export const cal = node;
