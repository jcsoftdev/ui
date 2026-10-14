// Timeline layout: packing overlapping intervals into lanes, round clock ticks and the lane height
// that fills a given room. Pure; labels follow the locale and time zone of the options.
import { calendarFor, type DateLocaleOptions, dateFormat } from "../internal/chart-calendar.ts";
import { shortMonth } from "./scale-time.ts";

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
const DAY = 1440 * MINUTE;
const STEPS = [15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE);

/** "09:30" in 24-hour time. */
export function formatClock(value: number | Date, options: DateLocaleOptions = {}): string {
  return dateFormat({ hour: "2-digit", minute: "2-digit", hour12: false }, options).format(value);
}

export interface ClockTick {
  value: number;
  label: string;
}

/**
 * Round clock ticks (every 15 min ... 1 day, aligned to midnight of the zone) for a span of
 * hours, at most about `count` of them.
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
  const origin = cal.wall(start);
  cal.midnight(origin);
  const midnight = cal.instant(origin);
  const first = midnight + Math.ceil((start - midnight) / step) * step;
  const out: ClockTick[] = [];
  for (let t = first; t <= end && out.length < 200; t += step) {
    const date = new Date(t);
    out.push({
      value: t,
      label:
        step >= DAY
          ? `${cal.date(cal.wall(t))} ${shortMonth(date, options)}`
          : formatClock(date, options),
    });
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
