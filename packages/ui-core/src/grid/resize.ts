import { clampWidth } from "./columns.js";
import type { GridColumn } from "./model.js";
import type { GridZone } from "./pin.js";

/** Pixels a Shift+Arrow press resizes a column by. */
export const RESIZE_STEP = 16;

/**
 * Width after a pointer drag of `dx` pixels (screen x). The handle sits on the inline-end edge of
 * a column, or the inline-start edge of an end-pinned one, so the sign depends on the zone and on
 * the writing direction.
 */
export function widthFromPointer<T>(
  startWidth: number,
  dx: number,
  { rtl, zone }: { rtl: boolean; zone: GridZone },
  column: GridColumn<T>,
): number {
  const sign = (rtl ? -1 : 1) * (zone === "end" ? -1 : 1);
  return clampWidth(startWidth + sign * dx, column);
}

/**
 * Width after a keyboard step toward the inline `direction` (+1 inline end). The key points the
 * way the edge moves, so it matches the pointer: in an end-pinned column the edge is the start one.
 */
export function widthFromKey<T>(
  width: number,
  direction: 1 | -1,
  zone: GridZone,
  column: GridColumn<T>,
  step = RESIZE_STEP,
): number {
  return clampWidth(width + (zone === "end" ? -direction : direction) * step, column);
}
