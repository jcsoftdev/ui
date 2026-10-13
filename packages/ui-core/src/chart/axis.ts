// Axis tick generation: round linear ticks, label thinning and scale-to-tick conversion.
import { clean, linearTicks, niceDomain, tickStep } from "../internal/chart-ticks.ts";
import type { ContinuousScale } from "./scale.ts";

export { clean, linearTicks, niceDomain, tickStep };

export interface AxisTick {
  /** Stable key. */
  key: string | number;
  /** Pixel position along the axis, inside the plot. */
  position: number;
  label: string;
}

/** Approximate rendered width of a tick label at 11px (tabular figures). */
export function estimateTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.58;
}

/**
 * Drops labels that would collide, keeping an even rhythm (every 2nd, 3rd, ...)
 * so the first label always stays.
 */
export function thinTicks(ticks: readonly AxisTick[], gap = 10): AxisTick[] {
  if (ticks.length < 3) return [...ticks];
  const widest = Math.max(...ticks.map((tick) => estimateTextWidth(tick.label)));
  const first = ticks[0] as AxisTick;
  const second = ticks[1] as AxisTick;
  const spacing = Math.abs(second.position - first.position) || 1;
  const every = Math.max(1, Math.ceil((widest + gap) / spacing));
  return ticks.filter((_, index) => index % every === 0);
}

/** Ticks of a continuous scale that fall inside its domain, as pixel-positioned labels. */
export function valueTicks(
  scale: ContinuousScale,
  count: number,
  format: (value: number) => string,
): AxisTick[] {
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: format(value) }));
}
