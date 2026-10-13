import { computePinOffsets, type PinnedColumns, sanitizePinned } from "../column-pin.js";

export type GridZone = "start" | "center" | "end";

export interface ColumnArrangement {
  /** Ids in render order: start-pinned, scrolling, end-pinned. */
  ids: string[];
  start: string[];
  center: string[];
  end: string[];
  zoneOf: Map<string, GridZone>;
}

/**
 * Splits the visible columns into the three zones of the grid. Pinned zones keep the order of
 * `order`; hidden and unknown ids are dropped. `left` / `right` are logical (inline start / end),
 * as in `column-pin`, so right-to-left needs no special case.
 */
export function arrangeColumns(
  order: readonly string[],
  hidden: readonly string[],
  pinned: PinnedColumns,
): ColumnArrangement {
  const shown = order.filter((id) => !hidden.includes(id));
  const clean = sanitizePinned(pinned, shown);
  const start = shown.filter((id) => clean.left.includes(id));
  const end = shown.filter((id) => clean.right.includes(id));
  const center = shown.filter((id) => !clean.left.includes(id) && !clean.right.includes(id));
  const zoneOf = new Map<string, GridZone>();
  for (const id of start) zoneOf.set(id, "start");
  for (const id of center) zoneOf.set(id, "center");
  for (const id of end) zoneOf.set(id, "end");
  return { ids: [...start, ...center, ...end], start, center, end, zoneOf };
}

/** Sticky offsets (`inset-inline-start` / `-end`) of the pinned columns, from their widths. */
export function pinInsets(
  widths: Readonly<Record<string, number>>,
  arrangement: ColumnArrangement,
): ReturnType<typeof computePinOffsets> {
  return computePinOffsets(widths, { left: arrangement.start, right: arrangement.end });
}
