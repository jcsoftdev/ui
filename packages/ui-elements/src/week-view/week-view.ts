import {
  formatHour,
  formatWeekdayAndDay,
  minutesSinceMidnight,
  weekDays,
} from "@jcsoftdev/ui-core/date";
import { layoutDayEvents } from "@jcsoftdev/ui-core/date/layout";
import { type DefineOptions, defineElement } from "../internal/base.js";
import { cal } from "../internal/e12-cal.js";
import chipCss from "../internal/e12-chip.css.js";
import { markerButton } from "../internal/e12-chip.js";
import eventCss from "../internal/e12-event.css.js";
import { eventButton } from "../internal/e12-event.js";
import { CalendarView } from "../internal/e12-view.js";
import { weekStartOf } from "../internal/e12-week-start.js";
import css from "./week-view.css.js";

const INITIAL_SCROLL_HOUR = 8;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * `<ui-week-view>`: seven day columns over a 24-hour grid, an all-day row (markers and all-day
 * events) and overlapping events packed side by side (ui-core's `date/layout`, the React kit's
 * greedy column assignment). The header and the all-day row stick while the hours scroll, which
 * starts at 08:00. Light DOM; like the React kit it is a set of native buttons in reading order
 * (all-day row first, then each day top to bottom), with no grid role. The optional `roving`
 * attribute makes the items a single tab stop moved with the arrow keys, Home and End (ui-core's
 * `roving`, loaded on demand), in DOM order.
 *
 * Data: the `events` and `markers` properties (or JSON attributes) and `shadedDates` (or a
 * comma-separated `shaded-dates`). Attributes: `week` (any "YYYY-MM-DD" in the week; defaults to
 * `today`), `today` (highlighted; the view never reads the clock), `current-time` ("HH:mm", draws
 * the now line in today's column), `working-hours` (`9,17`: a highlighted band, [start, end) in
 * hours), `all-day-label` (default "All day"), `locale` (day and hour labels; defaults to the
 * nearest `lang`, then the runtime), `week-starts-on` (0 Sunday to 6, or `auto` for the locale's
 * week; default 1), `roving`.
 *
 * Events (bubbling, composed): `open-event` and `open-marker` with `{ id }`.
 */
export class UiWeekView extends CalendarView {
  static override observedAttributes: string[] = [
    ...CalendarView.observedAttributes,
    "week",
    "current-time",
    "working-hours",
    "all-day-label",
  ];

  protected readonly name = "week-view";
  protected readonly css = css;
  protected readonly shared = [chipCss, eventCss];

  /** Keeps the scroll position across renders; the first one starts at 08:00. */
  protected override render(): void {
    const top = this.querySelector<HTMLElement>("[data-hours-scroll]")?.scrollTop;
    super.render();
    const scroll = this.querySelector<HTMLElement>("[data-hours-scroll]");
    if (!scroll) return;
    const hour = Number.parseFloat(getComputedStyle(this).getPropertyValue("--agenda-hour")) || 48;
    scroll.scrollTop = top ?? INITIAL_SCROLL_HOUR * hour;
  }

  protected build(): Node[] {
    const week = this.getAttribute("week") || this.today;
    if (!week) return [];
    const locale = this.locale;
    const { today, events, markers } = this;
    const days = weekDays(week, weekStartOf(this, locale));
    const shaded = new Set(this.shadedDates);
    const currentTime = this.getAttribute("current-time");
    const [from, to] = (this.getAttribute("working-hours") ?? "").split(/[,-]/).map(Number);
    const working = from !== undefined && to !== undefined && to > from ? [from, to] : undefined;

    const header = cal("div", "header");
    header.append(cal("div", "gutter"));
    for (const date of days) {
      const head = cal("div", "day-header", formatWeekdayAndDay(date, locale));
      head.dataset.date = date;
      if (date === today) head.dataset.today = "";
      header.append(head);
    }

    const allDay = cal("div", "all-day");
    allDay.dataset.allDayRow = "";
    allDay.append(cal("div", "gutter", this.getAttribute("all-day-label") ?? "All day"));
    for (const date of days) {
      const cell = cal("div", "all-day-cell");
      for (const marker of markers.filter((m) => m.date === date))
        cell.append(markerButton(marker));
      for (const event of events.filter((e) => e.date === date && e.allDay)) {
        const wrap = document.createElement("div");
        wrap.dataset.event = event.id;
        wrap.append(eventButton(event, "compact"));
        cell.append(wrap);
      }
      allDay.append(cell);
    }

    const grid = cal("div", "hours");
    const gutter = cal("div", "gutter");
    for (const hour of HOURS) {
      const label = cal("span", "hour-label", formatHour(hour, locale));
      label.style.setProperty("--ui-week-view-from", `${hour}`);
      gutter.append(label);
    }
    grid.append(gutter);

    for (const date of days) {
      const column = cal("div", "column");
      column.dataset.date = date;
      column.dataset.hoursColumn = "";
      if (date === today) column.dataset.today = "";
      if (shaded.has(date)) column.dataset.shaded = "";
      if (working) {
        const band = cal("div", "working-hours");
        band.dataset.workingHours = "";
        band.style.setProperty("--ui-week-view-from", `${working[0]}`);
        band.style.setProperty("--ui-week-view-to", `${working[1]}`);
        column.append(band);
      }
      const positioned = layoutDayEvents(events.filter((e) => e.date === date && !e.allDay));
      for (const { event, start, end, column: col, columns } of positioned) {
        const slot = cal("div", "slot");
        slot.dataset.event = event.id;
        slot.style.setProperty("--ui-week-view-from", `${start}`);
        slot.style.setProperty("--ui-week-view-to", `${end}`);
        slot.style.setProperty("--ui-week-view-col", `${col}`);
        slot.style.setProperty("--ui-week-view-cols", `${columns}`);
        slot.append(eventButton(event, end - start <= 30 ? "compact" : "detailed"));
        column.append(slot);
      }
      if (date === today && currentTime) {
        const now = cal("div", "now");
        now.dataset.nowLine = "";
        now.style.setProperty("--ui-week-view-from", `${minutesSinceMidnight(currentTime)}`);
        column.append(now);
      }
      grid.append(column);
    }

    const inner = cal("div", "inner");
    inner.append(header, allDay, grid);
    const scroll = cal("div", "scroll");
    scroll.dataset.hoursScroll = "";
    scroll.append(inner);
    return [scroll];
  }
}

/** Registers `<ui-week-view>` (or `<prefix-week-view>`) and returns the tag. */
export function defineWeekView(options?: DefineOptions): string {
  return defineElement("week-view", UiWeekView, options);
}
