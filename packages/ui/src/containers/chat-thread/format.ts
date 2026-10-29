export type ChatTimestamp = Date | string | number;

export interface ChatThreadFormat {
  locale?: string | undefined;
  timeZone?: string | undefined;
}

const toDate = (at: ChatTimestamp) => (at instanceof Date ? at : new Date(at));

/** `YYYY-MM-DD` of the instant in `timeZone` (the local zone when omitted). */
export function dayKey(at: ChatTimestamp, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDate(at));
}

function shiftDay(key: string, days: number): string {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function formatTime(at: ChatTimestamp, { locale, timeZone }: ChatThreadFormat = {}): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(at));
}

/** "Today" and "Yesterday" relative to `now`, otherwise a long date (with the year when it differs). */
export function formatDay(
  at: ChatTimestamp,
  now: ChatTimestamp,
  labels: { today: string; yesterday: string },
  { locale, timeZone }: ChatThreadFormat = {},
): string {
  const key = dayKey(at, timeZone);
  const today = dayKey(now, timeZone);
  if (key === today) return labels.today;
  if (key === shiftDay(today, -1)) return labels.yesterday;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(toDate(at));
}

/** Items in order, each flagged with whether a new day starts at it. */
export function withDayBreaks<T extends { at: ChatTimestamp }>(
  items: readonly T[],
  timeZone?: string,
): Array<{ item: T; dayStart: boolean }> {
  let previous: string | null = null;
  return items.map((item) => {
    const key = dayKey(item.at, timeZone);
    const dayStart = key !== previous;
    previous = key;
    return { item, dayStart };
  });
}
