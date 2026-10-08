import type { ValueFormat } from "../format.js";
import type { DensityPoint } from "./stats.js";

/**
 * Samples per category for one series: `data[i]` holds the raw values of
 * `categories[i]` (e.g. every service duration of one barber).
 */
export interface DistributionSeries {
  id: string;
  name: string;
  data: ReadonlyArray<ReadonlyArray<number | null>>;
  /** CSS color; defaults to the palette slot of the series. */
  color?: string;
  /** Overrides the chart `valueFormat` for this series. */
  format?: ValueFormat;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** `[value, cross]` to screen `x,y`, swapping axes for horizontal charts. */
export function toXY(horizontal: boolean, value: number, cross: number): string {
  return horizontal ? `${round(value)},${round(cross)}` : `${round(cross)},${round(value)}`;
}

export type ViolinSide = "both" | "start" | "end";

export interface ViolinPathInput {
  density: readonly DensityPoint[];
  /** Value to pixel along the value axis. */
  map: (value: number) => number;
  /** Pixel of the violin axis on the cross axis. */
  center: number;
  /** Pixel half-width given to `maxDensity`. */
  halfWidth: number;
  maxDensity: number;
  horizontal: boolean;
  /**
   * "both" mirrors the curve; "start" draws only the side toward smaller cross
   * pixels (left, or up when horizontal); "end" only the other side.
   */
  side?: ViolinSide;
  /** Value range to keep (the axis domain): the curve is cut there instead of spilling out. */
  domain?: readonly [number, number];
}

/** Closed outline of a (half) violin from a density curve. */
export function violinPath({
  density: curve,
  map,
  center,
  halfWidth,
  maxDensity,
  horizontal,
  side = "both",
  domain,
}: ViolinPathInput): string {
  let density = curve;
  if (domain) {
    const [lo, hi] = domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
    density = density.filter((point) => point.value >= lo && point.value <= hi);
  }
  if (density.length < 2 || maxDensity <= 0) return "";
  const at = (point: DensityPoint, sign: number) =>
    toXY(horizontal, map(point.value), center + sign * (point.density / maxDensity) * halfWidth);
  const axisAt = (point: DensityPoint) => toXY(horizontal, map(point.value), center);
  const first = density[0] as DensityPoint;
  const last = density[density.length - 1] as DensityPoint;
  let points: string[];
  if (side === "both") {
    points = [...density.map((p) => at(p, -1)), ...[...density].reverse().map((p) => at(p, 1))];
  } else {
    const sign = side === "start" ? -1 : 1;
    points = [axisAt(first), ...density.map((p) => at(p, sign)), axisAt(last)];
  }
  return `M${points.join("L")}Z`;
}
