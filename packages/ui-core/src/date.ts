/**
 * Calendar-date helpers. Dates are "YYYY-MM-DD" strings handled in UTC so they never shift by
 * time zone. Mirrors the React kit's calendar `date-utils` and day layout.
 */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  return formatDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount)),
  );
}

/** Adds whole months, clamping the day to the target month's length (31 Jan + 1 = 28/29 Feb). */
export function addMonths(value: string, amount: number): string {
  const date = parseDate(value);
  const index = date.getUTCMonth() + amount;
  const last = new Date(Date.UTC(date.getUTCFullYear(), index + 1, 0)).getUTCDate();
  return formatDate(
    new Date(Date.UTC(date.getUTCFullYear(), index, Math.min(date.getUTCDate(), last))),
  );
}

/** First day of the week containing `value`; `weekStartsOn` is 0 (Sunday) to 6 (Saturday). */
export function startOfWeek(value: string, weekStartsOn: WeekStart = 1): string {
  const offset = (parseDate(value).getUTCDay() - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
}

/** The seven days of the week containing `value`. */
export function weekDays(value: string, weekStartsOn: WeekStart = 1): string[] {
  const start = startOfWeek(value, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function startOfMonth(value: string): string {
  const target = parseDate(value);
  return formatDate(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1)));
}

export function endOfMonth(value: string): string {
  const target = parseDate(value);
  return formatDate(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)));
}

export function isSameMonth(a: string, b: string): boolean {
  return startOfMonth(a) === startOfMonth(b);
}

/** Full weeks (7 columns) covering the month that contains `value`. */
export function monthGrid(value: string, weekStartsOn: WeekStart = 1): string[] {
  const start = startOfWeek(startOfMonth(value), weekStartsOn);
  const end = addDays(startOfWeek(endOfMonth(value), weekStartsOn), 6);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function format(
  value: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(parseDate(value));
}

/** Localized short weekday name, e.g. "Mon". */
export function formatWeekday(value: string, locale?: string): string {
  return format(value, locale, { weekday: "short" });
}

/** Localized short weekday followed by the day number, e.g. "Mon 12". */
export function formatWeekdayAndDay(value: string, locale?: string): string {
  return `${formatWeekday(value, locale)} ${parseDate(value).getUTCDate()}`;
}

/** Localized short month name, e.g. "Jan". */
export function formatMonthShort(value: string, locale?: string): string {
  return format(value, locale, { month: "short" });
}

/** Localized hour label for an hour of the day (0-23). */
export function formatHour(hour: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour)));
}

/** Minimum duration (minutes) for an event without an end time. */
const MIN_DURATION = 30;

/** An event of one day: "HH:MM" start and optional end. Extra fields ride along. */
export interface DayEvent {
  start: string;
  end?: string | undefined;
}

export interface TimedEvent<E extends DayEvent = DayEvent> {
  event: E;
  start: number;
  end: number;
}

export interface PositionedEvent<E extends DayEvent = DayEvent> extends TimedEvent<E> {
  /** 0-based column inside its group of overlapping events. */
  column: number;
  /** Number of columns in the group, used to split the width. */
  columns: number;
}

function toMinutes<E extends DayEvent>(events: E[]): TimedEvent<E>[] {
  return events.map((event) => {
    const start = minutesSinceMidnight(event.start);
    const end = event.end ? minutesSinceMidnight(event.end) : start + MIN_DURATION;
    return { event, start, end: Math.max(end, start + 1) };
  });
}

/** Greedy column assignment for the overlapping events of one day. */
export function layoutDayEvents<E extends DayEvent>(events: E[]): PositionedEvent<E>[] {
  const sorted = toMinutes(events).sort((a, b) => a.start - b.start || a.end - b.end);
  const positioned: PositionedEvent<E>[] = [];
  let group: PositionedEvent<E>[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  const closeGroup = () => {
    const columns = group.reduce((max, item) => Math.max(max, item.column + 1), 0);
    for (const item of group) {
      item.columns = columns;
      positioned.push(item);
    }
    group = [];
  };

  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) {
      closeGroup();
      groupEnd = Number.NEGATIVE_INFINITY;
    }
    const columnEnds: number[] = [];
    for (const previous of group) {
      columnEnds[previous.column] = Math.max(columnEnds[previous.column] ?? 0, previous.end);
    }
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) column = columnEnds.length;
    group.push({ ...item, column, columns: 0 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  closeGroup();
  return positioned;
}
