export type SelectionMode = "none" | "single" | "multi";

export interface SelectionState {
  keys: ReadonlySet<string>;
  /** Row the next shift-range starts from. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { keys: new Set(), anchor: null };

/** How a selection action finds rows. Lets 100k-row grids avoid building a key array. */
export interface SelectionRows {
  count: number;
  indexOf: (key: string) => number;
  keyAt: (index: number) => string;
}

/** Ids between `anchor` and `target` (inclusive) in display order; just `target` without anchor. */
export function rangeBetween(
  ids: readonly string[],
  anchor: string | null,
  target: string,
): string[] {
  const end = ids.indexOf(target);
  const start = anchor === null ? -1 : ids.indexOf(anchor);
  if (end === -1) return [];
  if (start === -1) return [target];
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}

function between(rows: SelectionRows, anchor: string | null, target: string): string[] {
  const end = rows.indexOf(target);
  if (end < 0) return [];
  const start = anchor === null ? -1 : rows.indexOf(anchor);
  if (start < 0) return [target];
  const keys: string[] = [];
  for (let i = Math.min(start, end); i <= Math.max(start, end); i += 1) keys.push(rows.keyAt(i));
  return keys;
}

/**
 * Checkbox / Space / row-tap toggle. Multi mode follows the React kit's `toggleRow`: the row (or,
 * with `range`, every row from the anchor to it) is checked when it was unchecked and unchecked
 * when it was checked. Single mode keeps at most one row; toggling the selected one clears it.
 */
export function toggleRow(
  state: SelectionState,
  key: string,
  mode: SelectionMode,
  rows: SelectionRows,
  range = false,
): SelectionState {
  if (mode === "none") return state;
  const willSelect = !state.keys.has(key);
  if (mode === "single") {
    return { keys: new Set(willSelect ? [key] : []), anchor: key };
  }
  const next = new Set(state.keys);
  for (const k of range ? between(rows, state.anchor, key) : [key]) {
    if (willSelect) next.add(k);
    else next.delete(k);
  }
  return { keys: next, anchor: key };
}

/**
 * A plain tap or click on a row: it becomes the only selected row (multi mode too), unless
 * `additive` (Ctrl / Meta) toggles it or `range` (Shift) extends from the anchor.
 */
export function pressRow(
  state: SelectionState,
  key: string,
  mode: SelectionMode,
  rows: SelectionRows,
  { range = false, additive = false }: { range?: boolean; additive?: boolean } = {},
): SelectionState {
  if (mode === "none") return state;
  if (mode === "single") return { keys: new Set([key]), anchor: key };
  if (additive) return toggleRow(state, key, mode, rows, false);
  if (range)
    return { keys: new Set(between(rows, state.anchor, key)), anchor: state.anchor ?? key };
  return { keys: new Set([key]), anchor: key };
}

/** Header checkbox: checks every row, or clears them when all are already checked. */
export function toggleAll(
  state: SelectionState,
  mode: SelectionMode,
  rows: SelectionRows,
): SelectionState {
  if (mode !== "multi") return state;
  const everything = rows.count > 0 && selectedCount(state, rows) === rows.count;
  if (everything) return { keys: new Set(), anchor: null };
  const keys = new Set<string>();
  for (let i = 0; i < rows.count; i += 1) keys.add(rows.keyAt(i));
  return { keys, anchor: state.anchor };
}

/** How many selected keys are still among `rows` (selection can outlive a filter or a reload). */
export function selectedCount(state: SelectionState, rows: SelectionRows): number {
  let count = 0;
  for (const key of state.keys) if (rows.indexOf(key) >= 0) count += 1;
  return count;
}

/** `"all"`, `"some"` or `"none"`: the state of the header checkbox. */
export function selectionLevel(
  state: SelectionState,
  rows: SelectionRows,
): "all" | "some" | "none" {
  const count = selectedCount(state, rows);
  return count === 0 ? "none" : count === rows.count ? "all" : "some";
}
