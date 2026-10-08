import type { ValueAxisOptions } from "../types.js";

/** A value axis of a cartesian chart: `id` is what a series' `axis` refers to. */
export interface CartesianAxisSpec extends ValueAxisOptions {
  id: string;
  /** Side of the plot; "left" for the `"left"` id, "right" for any other. */
  side?: "left" | "right";
  /** Color of the tick labels and axis line, to match the series it measures. */
  color?: string;
}

export interface ResolvedAxis {
  id: string;
  side: "left" | "right";
  options: ValueAxisOptions;
  color?: string;
}

/**
 * Axes in drawing order. `yAxis` and `rightAxis` are sugar for the axes with
 * id "left" and "right"; `extra` entries merge into those or add more axes
 * (on the right unless they say otherwise). Axes no series uses are dropped,
 * and the first remaining one is the primary axis (grid, zero line, bars).
 */
export function resolveAxes(
  yAxis: ValueAxisOptions,
  rightAxis: ValueAxisOptions,
  extra: readonly CartesianAxisSpec[],
  used: ReadonlySet<string>,
): ResolvedAxis[] {
  const list: ResolvedAxis[] = [
    { id: "left", side: "left", options: yAxis },
    { id: "right", side: "right", options: rightAxis },
  ];
  for (const { id, side, color, ...options } of extra) {
    const at = list.findIndex((axis) => axis.id === id);
    const current = list[at];
    if (current) {
      list[at] = {
        ...current,
        side: side ?? current.side,
        color: color ?? current.color,
        options: { ...current.options, ...options },
      };
    } else {
      list.push({ id, side: side ?? "right", options, color });
    }
  }
  const others = list.some((axis) => axis.id !== "left" && used.has(axis.id));
  return list.filter((axis) => used.has(axis.id) || (axis.id === "left" && !others));
}

export interface AxisSlot {
  id: string;
  side: "left" | "right";
  /** Pixels the axis needs beside the plot: its widest label plus padding. */
  width: number;
}

export interface AxisStack {
  left: number;
  right: number;
  /** Distance of each axis from the plot edge it hangs on; later axes sit further out. */
  offsets: Map<string, number>;
}

/**
 * Margins and offsets for axes that stack outward from the plot on each side,
 * in the order given. The left margin never drops below `minLeft`; with no
 * right axis the right margin is `rightFallback` (room for the last x label).
 */
export function stackAxes(
  slots: readonly AxisSlot[],
  { minLeft, rightFallback }: { minLeft: number; rightFallback: number },
): AxisStack {
  const used = { left: 0, right: 0 };
  const offsets = new Map<string, number>();
  for (const slot of slots) {
    offsets.set(slot.id, used[slot.side]);
    used[slot.side] += slot.width;
  }
  const hasRight = slots.some((slot) => slot.side === "right");
  return {
    left: Math.max(minLeft, used.left),
    right: hasRight ? used.right : rightFallback,
    offsets,
  };
}
