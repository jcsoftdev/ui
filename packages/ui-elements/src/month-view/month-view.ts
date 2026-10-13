import { formatWeekday, monthGrid, parseDate } from "@jcsoftdev/ui-core/date";
import { type DefineOptions, defineElement } from "../internal/base.js";
import {
  type CalendarEvent,
  type CalendarMarker,
  type CalendarTone,
  CalendarView,
  cal,
  eventButton,
  markerButton,
} from "../internal/e12-calendar.js";
import css from "./month-view.css.js";

const MAX_VISIBLE_ITEMS = 3;

type DayItem = { kind: "marker"; item: CalendarMarker } | { kind: "event"; item: CalendarEvent };

/**
 * `<ui-month-view>`: a month grid of day cells, each with its markers (chips) and events (compact
 * blocks), up to three per day and a "+n more" button for the rest. Under 40rem of width (a
 * container query) the items collapse into dots. Light DOM; like the React kit it is a set of
 * native buttons in reading order, with no grid role: Tab walks the items. The optional `roving`
 * attribute makes the items a single tab stop moved with the arrow keys, Home and End (ui-core's
 * `roving`, loaded on demand), in DOM order.
 *
 * Data: the `events` and `markers` properties (or JSON attributes) and `shadedDates` (or a
 * comma-separated `shaded-dates`). Attributes: `month` (any "YYYY-MM-DD" in the month; defaults to
 * `today`), `today` (highlighted; the view never reads the clock), `locale` (weekday labels;
 * defaults to the nearest `lang`, then the runtime), `week-starts-on` (0 Sunday to 6, or `auto`
 * for the locale's week; default 1), `more-label` (a template with `{count}`, default
 * `+{count} more`, or set the `formatMore` property), `roving`.
 *
 * Events (bubbling, composed): `open-event` and `open-marker` with `{ id }`, `select-date` with
 * `{ date }` (the "+n more" button).
 */
export class UiMonthView extends CalendarView {
  static override observedAttributes: string[] = [
    ...CalendarView.observedAttributes,
    "month",
    "more-label",
  ];

  protected readonly name = "month-view";
  protected readonly css = css;
  #formatMore?: (count: number) => string;

  /** Label of the overflow button; overrides `more-label`. */
  get formatMore(): (count: number) => string {
    return (
      this.#formatMore ??
      ((count) =>
        (this.getAttribute("more-label") ?? "+{count} more").replace("{count}", `${count}`))
    );
  }
  set formatMore(value: (count: number) => string) {
    this.#formatMore = value;
    this.schedule();
  }

  protected build(): Node[] {
    const month = this.getAttribute("month") || this.today;
    if (!month) return [];
    const { locale, weekStartsOn, today, events, markers } = {
      locale: this.locale,
      weekStartsOn: this.weekStartsOn,
      today: this.today,
      events: this.events,
      markers: this.markers,
    };
    const monthIndex = parseDate(month).getUTCMonth();
    const days = monthGrid(month, weekStartsOn);
    const shaded = new Set(this.shadedDates);
    const nodes: Node[] = days
      .slice(0, 7)
      .map((date) => cal("div", "weekday", formatWeekday(date, locale)));

    for (const date of days) {
      const parsed = parseDate(date);
      const outside = parsed.getUTCMonth() !== monthIndex;
      const cell = cal("div", "day");
      cell.dataset.date = date;
      if (date === today) cell.dataset.today = "";
      if (outside) cell.dataset.outsideMonth = "";
      if (shaded.has(date)) cell.dataset.shaded = "";

      const items: DayItem[] = [
        ...markers
          .filter((m) => m.date === date)
          .map((item): DayItem => ({ kind: "marker", item })),
        ...events.filter((e) => e.date === date).map((item): DayItem => ({ kind: "event", item })),
      ];
      const visible = items.slice(0, MAX_VISIBLE_ITEMS);
      const hidden = items.length - visible.length;

      const list = cal("div", "items");
      for (const { kind, item } of visible)
        list.append(kind === "marker" ? markerButton(item) : eventButton(item, "compact"));
      if (hidden > 0) {
        const more = cal("button", "more", this.formatMore(hidden));
        more.type = "button";
        more.dataset.kind = "more";
        more.dataset.date = date;
        more.dataset.key = `more:${date}`;
        list.append(more);
      }
      cell.append(cal("span", "day-number", `${parsed.getUTCDate()}`), list);

      if (items.length > 0) {
        const dots = cal("div", "dots");
        for (const { kind, item } of items) {
          const dot = cal("button", "dot");
          dot.type = "button";
          dot.dataset.kind = kind;
          dot.dataset.id = item.id;
          dot.dataset.key = `dot:${kind}:${item.id}`;
          dot.dataset.tone =
            kind === "marker"
              ? item.tone === "danger"
                ? "danger"
                : "accent"
              : ((item.tone ?? "accent") satisfies CalendarTone);
          dot.setAttribute("aria-label", item.title);
          dots.append(dot);
        }
        cell.append(dots);
      }
      nodes.push(cell);
    }
    return nodes;
  }
}

/** Registers `<ui-month-view>` (or `<prefix-month-view>`) and returns the tag. */
export function defineMonthView(options?: DefineOptions): string {
  return defineElement("month-view", UiMonthView, options);
}
