import { type AxisTick, thinTicks } from "./axis.ts";
import {
  bandScale,
  type DateLocaleOptions,
  dayOfMonth,
  formatDate,
  pointScale,
  shortMonth,
  timeScale,
} from "./scale.ts";

/** A category or time stamp on the category axis. */
export type XValue = string | number | Date;

export type CategoryAxisMode = "point" | "band" | "time";

export interface CategoryAxis {
  mode: CategoryAxisMode;
  /** Pixel center of every category. */
  positions: number[];
  /** Distance between neighbours (the smallest gap on a time axis). */
  step: number;
  /** Width available to a mark centered on a category (bars, candles). */
  bandwidth: number;
  ticks: AxisTick[];
  /** Nearest category to a pixel; -1 when there are none. */
  indexAt(pixel: number): number;
}

export interface CategoryAxisOptions extends DateLocaleOptions {
  mode: CategoryAxisMode;
  /** Tick label of a category; dates get "6 oct", others `String`. */
  format?: (value: XValue) => string;
  /** Band mode gap between marks, fraction of the step. */
  paddingInner?: number;
  /** Point/band mode space at both ends, fraction of the step. */
  padding?: number;
  /** Desired tick count for time axes. */
  tickCount?: number;
}

/** Short default label: "6 oct" for dates, the value itself otherwise. */
export function defaultCategoryLabel(value: XValue, options: DateLocaleOptions = {}): string {
  if (value instanceof Date) return `${dayOfMonth(value, options)} ${shortMonth(value, options)}`;
  return String(value);
}

/** Long label for tooltips and tables: "mar 6 oct 2026" for dates. */
export function fullCategoryLabel(value: XValue, options: DateLocaleOptions = {}): string {
  return value instanceof Date ? formatDate(value, options) : String(value);
}

/** True when every category is a Date, so a time scale makes sense. */
export function allDates(categories: readonly XValue[]): boolean {
  return categories.length > 0 && categories.every((value) => value instanceof Date);
}

/**
 * Turns categories into pixel positions, ticks and hit-testing for charts
 * that share a horizontal category or time axis.
 */
export function buildCategoryAxis(
  categories: readonly XValue[],
  width: number,
  { mode, format, locale, timeZone, paddingInner = 0.25, padding, tickCount }: CategoryAxisOptions,
): CategoryAxis {
  const count = categories.length;
  const label = format ?? ((value: XValue) => defaultCategoryLabel(value, { locale, timeZone }));
  if (mode === "time" && allDates(categories)) {
    const times = categories.map((value) => +(value as Date));
    const scale = timeScale({
      domain: [Math.min(...times), Math.max(...times)],
      range: [0, width],
      locale,
      timeZone,
    });
    const positions = times.map((time) => scale.map(time));
    let step = width;
    for (let i = 1; i < positions.length; i += 1) {
      const gap = Math.abs((positions[i] as number) - (positions[i - 1] as number));
      if (gap > 0) step = Math.min(step, gap);
    }
    const ticks = scale
      .timeTicks(tickCount ?? Math.max(2, Math.floor(width / 84)))
      .map((tick) => ({ key: tick.value, position: scale.map(tick.value), label: tick.label }));
    return {
      mode: "time",
      positions,
      step,
      bandwidth: step,
      ticks,
      indexAt: (pixel) => {
        let best = -1;
        let bestGap = Number.POSITIVE_INFINITY;
        positions.forEach((position, index) => {
          const gap = Math.abs(position - pixel);
          if (gap < bestGap) {
            best = index;
            bestGap = gap;
          }
        });
        return best;
      },
    };
  }
  const scale =
    mode === "band"
      ? bandScale({ count, range: [0, width], paddingInner, paddingOuter: padding ?? 0.1 })
      : pointScale({ count, range: [0, width], padding: padding ?? 0 });
  const positions = categories.map((_, index) => scale.center(index));
  const ticks = thinTicks(
    categories.map((value, index) => ({
      key: index,
      position: positions[index] as number,
      label: label(value),
    })),
  );
  return {
    mode: mode === "band" ? "band" : "point",
    positions,
    step: scale.step,
    bandwidth: scale.bandwidth || scale.step,
    ticks,
    indexAt: (pixel) => scale.indexAt(pixel),
  };
}
