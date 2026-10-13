// Category axis with dates: "6 oct" labels, the calendar-aligned time mode, and locale and
// time zone options. Builds on chart/category-axis for point and band layouts.

import type { CategoryAxis, CategoryAxisOptions, XValue } from "./category-axis.ts";
import { allDates, buildCategoryAxis as buildBaseAxis } from "./category-axis.ts";
import {
  type DateLocaleOptions,
  dayOfMonth,
  formatDate,
  shortMonth,
  timeScale,
} from "./scale-time.ts";

export type { CategoryAxis, CategoryAxisMode, XValue } from "./category-axis.ts";
export { allDates };

export interface TimeCategoryAxisOptions extends CategoryAxisOptions, DateLocaleOptions {}

/** Short default label: "6 oct" for dates, the value itself otherwise. */
export function defaultCategoryLabel(value: XValue, options: DateLocaleOptions = {}): string {
  if (value instanceof Date) return `${dayOfMonth(value, options)} ${shortMonth(value, options)}`;
  return String(value);
}

/** Long label for tooltips and tables: "mar 6 oct 2026" for dates. */
export function fullCategoryLabel(value: XValue, options: DateLocaleOptions = {}): string {
  return value instanceof Date ? formatDate(value, options) : String(value);
}

/** Like chart/category-axis, with date labels and the `time` mode. */
export function buildCategoryAxis(
  categories: readonly XValue[],
  width: number,
  options: TimeCategoryAxisOptions,
): CategoryAxis {
  const { mode, locale, timeZone, tickCount } = options;
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
  return buildBaseAxis(categories, width, {
    ...options,
    format: options.format ?? ((value) => defaultCategoryLabel(value, { locale, timeZone })),
  });
}
