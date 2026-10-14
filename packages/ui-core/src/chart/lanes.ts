// Timeline layout: packing overlapping intervals into lanes, round clock ticks and the lane height
// that fills a given room. Pure; labels follow the locale and time zone of the options.
import { calendarFor, type DateLocaleOptions } from "../internal/chart-calendar.ts";

export type { DateLocaleOptions };

export interface Interval {
  start: number;
  end: number;
}

export interface LaneAssignment {
  /** Lane index per input item, same order as the input. */
  lanes: number[];
  /** Number of lanes used (0 when there are no items). */
  count: number;
}

/**
 * Packs overlapping intervals into the fewest lanes: items are placed in start order into the
 * first lane that is already free. Intervals that only touch (one ends when the next starts)
 * share a lane.
 */
export function assignLanes(items: ReadonlyArray<Interval>): LaneAssignment {
  const order = items
    .map((_, index) => index)
    .sort(
      (a, b) =>
        (items[a] as Interval).start - (items[b] as Interval).start ||
        (items[a] as Interval).end - (items[b] as Interval).end ||
        a - b,
    );
  const laneEnds: number[] = [];
  const lanes = new Array<number>(items.length).fill(0);
  for (const index of order) {
    const item = items[index] as Interval;
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    lanes[index] = lane;
  }
  return { lanes, count: laneEnds.length };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STEPS = [15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE);

const formats = new Map<string, Intl.DateTimeFormat>();
/** A formatter in the locale of the options, or the browser's own when none is given. */
function format(options: Intl.DateTimeFormatOptions, { locale, timeZone }: DateLocaleOptions) {
  const key = `${locale ?? ""}|${timeZone ?? ""}|${JSON.stringify(options)}`;
  let found = formats.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(locale, timeZone ? { ...options, timeZone } : options);
    formats.set(key, found);
  }
  return found;
}

/** "09:30" in 24-hour time. */
export function formatClock(value: number | Date, options: DateLocaleOptions = {}): string {
  return format({ hour: "2-digit", minute: "2-digit", hour12: false }, options).format(value);
}

/** The whole hour at or before (`floor`) or after (`ceil`) `ms` on the clock of the zone, so a +05:30 zone rounds to its own hours. */
export function hourEdge(ms: number, edge: "floor" | "ceil", timeZone?: string): number {
  if (!timeZone) {
    const d = new Date(ms);
    d.setMinutes(0, 0, 0);
    if (edge === "ceil" && +d < ms) d.setHours(d.getHours() + 1);
    return +d;
  }
  const cal = calendarFor(timeZone);
  const wall = +cal.wall(ms);
  const floor = Math.floor(wall / HOUR) * HOUR;
  return cal.instant(new Date(edge === "ceil" && floor < wall ? floor + HOUR : floor));
}

export interface ClockTick {
  value: number;
  label: string;
}

/**
 * Round clock ticks (every 15 min ... 1 day, on the wall clock of the zone, so a daylight-saving
 * change does not shift the ticks after it) for a span of hours, at most about `count` of them.
 */
export function clockTicks(
  start: number,
  end: number,
  count = 8,
  options: DateLocaleOptions = {},
): ClockTick[] {
  const span = Math.max(1, end - start);
  const step =
    STEPS.find((candidate) => span / candidate <= count) ?? STEPS[STEPS.length - 1] ?? DAY;
  const cal = calendarFor(options.timeZone);
  const minutes = step / MINUTE;
  const day = cal.wall(start);
  cal.midnight(day);
  const out: ClockTick[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (let days = 0; days < 400 && out.length < 200; days += 1) {
    let finished = false;
    for (let at = 0; at < 1440; at += minutes) {
      const wall = new Date(+day);
      if (options.timeZone) wall.setUTCMinutes(wall.getUTCMinutes() + at);
      else wall.setMinutes(wall.getMinutes() + at);
      const t = cal.instant(wall);
      if (t > end) {
        finished = true;
        break;
      }
      if (t >= start && t > previous) {
        previous = t;
        out.push({
          value: t,
          label:
            step >= DAY
              ? format({ day: "numeric", month: "short" }, options).format(t).replace(".", "")
              : formatClock(t, options),
        });
      }
    }
    if (finished) break;
    cal.setDate(day, cal.date(day) + 1);
  }
  return out;
}

export interface FitLaneInput {
  /** Lanes per row. */
  counts: readonly number[];
  /** Height available for all the rows together (axis margins already removed). */
  available: number;
  gap: number;
  rowPad: number;
  min?: number;
  max?: number;
}

/**
 * Lane height that makes the rows fill `available` exactly:
 * `sum(count * (lane + gap) - gap + 2 * rowPad) = available`, clamped to `[min, max]`.
 */
export function fitLaneHeight({
  counts,
  available,
  gap,
  rowPad,
  min = 14,
  max = 72,
}: FitLaneInput): number {
  const lanes = counts.reduce((sum, count) => sum + count, 0);
  if (lanes <= 0) return min;
  const fixed = counts.length * (2 * rowPad - gap) + lanes * gap;
  return Math.min(max, Math.max(min, (available - fixed) / lanes));
}
