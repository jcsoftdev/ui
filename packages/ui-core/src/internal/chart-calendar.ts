// Zone-aware calendar arithmetic shared by chart/scale and chart/time-range.

/** Locale and time zone of date labels and calendar-aligned ticks. */
export interface DateLocaleOptions {
  /** BCP 47 tag for month and weekday names (default "es-PE"). */
  locale?: string;
  /** IANA zone such as "UTC" or "America/Lima" (default: the runtime's local time). */
  timeZone?: string;
}

export const LOCALE = "es-PE";
const formats = new Map<string, Intl.DateTimeFormat>();

export function dateFormat(
  options: Intl.DateTimeFormatOptions,
  { locale, timeZone }: DateLocaleOptions,
) {
  const key = `${locale ?? LOCALE}|${timeZone ?? ""}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(
      locale ?? LOCALE,
      timeZone ? { ...options, timeZone } : options,
    );
    formats.set(key, format);
  }
  return format;
}

/**
 * Calendar arithmetic in one zone. A "wall" date is a Date whose accessors read the zone's
 * calendar fields: the local accessors by default, the UTC accessors over shifted time for a zone.
 */
export interface Calendar {
  wall(ms: number): Date;
  instant(wall: Date): number;
  year(d: Date): number;
  month(d: Date): number;
  date(d: Date): number;
  day(d: Date): number;
  midnight(d: Date): void;
  setDate(d: Date, value: number): void;
  setMonth(d: Date, value: number): void;
  setYear(d: Date, value: number): void;
}

export const localCalendar: Calendar = {
  wall: (ms) => new Date(ms),
  instant: (d) => +d,
  year: (d) => d.getFullYear(),
  month: (d) => d.getMonth(),
  date: (d) => d.getDate(),
  day: (d) => d.getDay(),
  midnight: (d) => void d.setHours(0, 0, 0, 0),
  setDate: (d, value) => void d.setDate(value),
  setMonth: (d, value) => void d.setMonth(value),
  setYear: (d, value) => void d.setFullYear(value),
};

export function zonedCalendar(timeZone: string): Calendar {
  const parts = dateFormat(
    {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
      era: "short",
    },
    { locale: "en-US", timeZone },
  );
  const shifted = (ms: number) => {
    const f: Record<string, string> = {};
    for (const part of parts.formatToParts(ms)) f[part.type] = part.value;
    const year = f.era === "BC" ? 1 - Number(f.year) : Number(f.year);
    return Date.UTC(
      year,
      Number(f.month) - 1,
      Number(f.day),
      Number(f.hour),
      Number(f.minute),
      Number(f.second),
    );
  };
  return {
    wall: (ms) => new Date(shifted(Math.floor(ms / 1000) * 1000) + (((ms % 1000) + 1000) % 1000)),
    instant: (d) => {
      const wall = +d;
      let ms = wall - (shifted(wall) - wall);
      ms = wall - (shifted(ms) - ms);
      return ms;
    },
    year: (d) => d.getUTCFullYear(),
    month: (d) => d.getUTCMonth(),
    date: (d) => d.getUTCDate(),
    day: (d) => d.getUTCDay(),
    midnight: (d) => void d.setUTCHours(0, 0, 0, 0),
    setDate: (d, value) => void d.setUTCDate(value),
    setMonth: (d, value) => void d.setUTCMonth(value),
    setYear: (d, value) => void d.setUTCFullYear(value),
  };
}

export function calendarFor(timeZone: string | undefined): Calendar {
  return timeZone ? zonedCalendar(timeZone) : localCalendar;
}
