// Pure row-level helpers: pinned rows, detail rows and manual reordering.
import { moveColumn, moveColumnTo } from "./model.js";
import type { DisplayRow } from "./types.js";

export type RowPinSide = "top" | "bottom";

export interface PinnedRows {
  top: readonly string[];
  bottom: readonly string[];
}

export const NO_PINNED_ROWS: PinnedRows = { top: [], bottom: [] };

/** Pins `key` to `side`, or unpins it when it is already there. Moving sides keeps one entry. */
export function togglePinnedRow(pinned: PinnedRows, key: string, side: RowPinSide): PinnedRows {
  const without = {
    top: pinned.top.filter((id) => id !== key),
    bottom: pinned.bottom.filter((id) => id !== key),
  };
  if (pinned[side].includes(key)) return without;
  return { ...without, [side]: [...without[side], key] };
}

export function pinnedSideOf(pinned: PinnedRows, key: string): RowPinSide | null {
  if (pinned.top.includes(key)) return "top";
  if (pinned.bottom.includes(key)) return "bottom";
  return null;
}

/**
 * Pulls the pinned data rows out of the flat display list, in pin order. Ids that are no longer
 * shown (filtered out, removed) are skipped.
 */
export function splitPinnedRows<T>(
  display: readonly DisplayRow<T>[],
  pinned: PinnedRows,
): { top: DisplayRow<T>[]; middle: DisplayRow<T>[]; bottom: DisplayRow<T>[] } {
  if (pinned.top.length === 0 && pinned.bottom.length === 0) {
    return { top: [], middle: [...display], bottom: [] };
  }
  const byKey = new Map<string, DisplayRow<T>>();
  for (const row of display) if (row.kind === "data") byKey.set(row.key, row);
  const take = (keys: readonly string[]) =>
    keys.map((key) => byKey.get(key)).filter((row): row is DisplayRow<T> => !!row);
  const top = take(pinned.top);
  const bottom = take(pinned.bottom);
  const taken = new Set<DisplayRow<T>>([...top, ...bottom]);
  return { top, middle: display.filter((row) => !taken.has(row)), bottom };
}

/** Inserts a detail row after every data row whose key is in `expanded`. */
export function insertDetailRows<T>(
  rows: readonly DisplayRow<T>[],
  expanded: ReadonlySet<string>,
  heightOf: (row: T) => number,
): DisplayRow<T>[] {
  if (expanded.size === 0) return [...rows];
  const out: DisplayRow<T>[] = [];
  for (const row of rows) {
    out.push(row);
    if (row.kind === "data" && expanded.has(row.key)) {
      out.push({
        kind: "detail",
        key: `${row.key}::detail`,
        depth: row.depth,
        row: row.row,
        rowKey: row.key,
        height: heightOf(row.row),
      });
    }
  }
  return out;
}

/** Moves a row one step (keyboard). */
export function moveRowBy(order: readonly string[], key: string, delta: number): string[] {
  return moveColumn(order, key, delta);
}

/** Moves a row before or after another one (drag and drop). */
export function moveRowTo(
  order: readonly string[],
  key: string,
  targetKey: string,
  place: "before" | "after",
): string[] {
  return moveColumnTo(order, key, targetKey, place);
}

export function toggleSetMember(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
