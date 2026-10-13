// Category axis for point and band layouts: pixel positions, thinned tick labels and hit testing.
// Date categories get their labels and the time mode from chart/category-axis-time.
import { type AxisTick, thinTicks } from "./axis.ts";
import { bandScale, pointScale } from "./scale.ts";

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

export interface CategoryAxisOptions {
  mode: CategoryAxisMode;
  /** Tick label of a category (`String` by default; chart/category-axis-time labels dates). */
  format?: (value: XValue) => string;
  /** Band mode gap between marks, fraction of the step. */
  paddingInner?: number;
  /** Point/band mode space at both ends, fraction of the step. */
  padding?: number;
  /** Desired tick count for time axes. */
  tickCount?: number;
}

/** True when every category is a Date, so a time scale makes sense. */
export function allDates(categories: readonly XValue[]): boolean {
  return categories.length > 0 && categories.every((value) => value instanceof Date);
}

/**
 * Pixel positions, ticks and hit-testing for a horizontal category axis. `time` mode behaves
 * as `point` here; use buildCategoryAxis from chart/category-axis-time for a calendar axis.
 */
export function buildCategoryAxis(
  categories: readonly XValue[],
  width: number,
  { mode, format = String, paddingInner = 0.25, padding }: CategoryAxisOptions,
): CategoryAxis {
  const count = categories.length;
  const label = format;
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
