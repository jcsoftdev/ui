import { shortMonth } from "../core/scales/time.js";

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
 * Packs overlapping intervals into the fewest lanes: items are placed in
 * start order into the first lane that is already free. Intervals that only
 * touch (one ends when the next starts) share a lane.
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
const STEPS = [15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE);

const clock = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "09:30" in 24-hour time. */
export function formatClock(value: number | Date): string {
  return clock.format(value);
}

export interface ClockTick {
  value: number;
  label: string;
}

/**
 * Round clock ticks (every 15 min ... 1 day, aligned to local midnight) for a
 * span of hours, at most about `count` of them.
 */
export function clockTicks(start: number, end: number, count = 8): ClockTick[] {
  const span = Math.max(1, end - start);
  const step =
    STEPS.find((candidate) => span / candidate <= count) ??
    STEPS[STEPS.length - 1] ??
    1440 * MINUTE;
  const origin = new Date(start);
  origin.setHours(0, 0, 0, 0);
  const first = origin.getTime() + Math.ceil((start - origin.getTime()) / step) * step;
  const out: ClockTick[] = [];
  for (let t = first; t <= end && out.length < 200; t += step) {
    const date = new Date(t);
    out.push({
      value: t,
      label: step >= 1440 * MINUTE ? `${date.getDate()} ${shortMonth(date)}` : formatClock(date),
    });
  }
  return out;
}
