import { formatMonthShort, formatWeekdayAndDay } from "@jcsoftdev/ui-core/date";
import { type DefineOptions, defineElement } from "../internal/base.js";
import { cal } from "../internal/e12-cal.js";
import chipCss from "../internal/e12-chip.css.js";
import { markerButton } from "../internal/e12-chip.js";
import eventCss from "../internal/e12-event.css.js";
import { eventButton } from "../internal/e12-event.js";
import { CalendarView } from "../internal/e12-view.js";
import css from "./timeline-view.css.js";

/**
 * `<ui-timeline-view>`: an agenda list, one row per day that has markers or events (plus today),
 * each a `role="group"` named "<weekday> <day>" (with the today label on today's). Light DOM; the
 * markers (chips) and events (detailed blocks, sorted by start time) are native buttons in reading
 * order. Under 34rem of width (a container query) the heading stacks above the items.
 *
 * Data: the `events` and `markers` properties (or JSON attributes). Attributes: `today`
 * (always listed and highlighted; the view never reads the clock), `hidden-dates` (comma-separated
 * dates left out unless they are today), `today-label` (default "today"), `empty-label` (text of a
 * day without items, default "Nothing scheduled"), `locale` (defaults to the nearest `lang`, then
 * the runtime).
 *
 * Events (bubbling, composed): `open-event` and `open-marker` with `{ id }`.
 */
export class UiTimelineView extends CalendarView {
  static override observedAttributes: string[] = [
    ...CalendarView.observedAttributes,
    "hidden-dates",
    "today-label",
    "empty-label",
  ];

  protected readonly name = "timeline-view";
  protected readonly css = css;
  protected readonly shared = [chipCss, eventCss];
  #hidden?: string[];

  /** Dates left out of the list unless they are today. */
  get hiddenDates(): string[] {
    return (
      this.#hidden ??
      (this.getAttribute("hidden-dates") ?? "")
        .split(",")
        .map((date) => date.trim())
        .filter(Boolean)
    );
  }
  set hiddenDates(value: string[]) {
    this.#hidden = value;
    this.schedule();
  }

  protected build(): Node[] {
    const locale = this.locale;
    const { today, events, markers } = this;
    const hidden = new Set(this.hiddenDates);
    const todayLabel = this.getAttribute("today-label") ?? "today";
    const emptyLabel = this.getAttribute("empty-label") ?? "Nothing scheduled";
    const dates = [
      ...new Set([
        ...(today ? [today] : []),
        ...events.map((event) => event.date),
        ...markers.map((marker) => marker.date),
      ]),
    ]
      .filter((date) => date === today || !hidden.has(date))
      .sort();

    return dates.map((date) => {
      const isToday = date === today;
      const label = formatWeekdayAndDay(date, locale);
      const day = cal("div", "day");
      day.setAttribute("role", "group");
      day.setAttribute("aria-label", isToday ? `${label} · ${todayLabel}` : label);
      day.dataset.date = date;
      if (isToday) day.dataset.today = "";

      const heading = cal("div", "heading");
      const weekday = cal("b", "weekday", label);
      const dateLabel = cal(
        "span",
        "date",
        `${formatMonthShort(date, locale)}${isToday ? ` · ${todayLabel}` : ""}`,
      );
      heading.append(weekday, dateLabel);

      const items = cal("div", "items");
      const dayMarkers = markers.filter((marker) => marker.date === date);
      const dayEvents = events
        .filter((event) => event.date === date)
        .sort((a, b) => a.start.localeCompare(b.start));
      if (dayMarkers.length === 0 && dayEvents.length === 0)
        items.append(cal("span", "empty", emptyLabel));
      for (const marker of dayMarkers) items.append(markerButton(marker));
      for (const event of dayEvents) items.append(eventButton(event));
      day.append(heading, items);
      return day;
    });
  }
}

/** Registers `<ui-timeline-view>` (or `<prefix-timeline-view>`) and returns the tag. */
export function defineTimelineView(options?: DefineOptions): string {
  return defineElement("timeline-view", UiTimelineView, options);
}
