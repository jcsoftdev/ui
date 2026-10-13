import type { GridColumn } from "./model.js";

/** Column layout the user can change. */
export interface GridLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  pinned: { left: string[]; right: string[] };
}

const DEFAULT_WIDTH: Record<string, number> = {
  text: 180,
  number: 110,
  currency: 120,
  date: 130,
  status: 140,
};

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 640;

/** Width the uppercase header label needs next to its sort and menu buttons. */
export function headerFitWidth<T>(column: GridColumn<T>): number {
  return Math.ceil(column.header.length * 8.6 + 64);
}

export function clampWidth<T>(width: number, column: GridColumn<T>): number {
  const min = column.minWidth ?? MIN_COLUMN_WIDTH;
  const max = Math.max(min, column.maxWidth ?? MAX_COLUMN_WIDTH);
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** Starting width: the column's own or the type default, never narrower than its header. */
export function defaultWidth<T>(column: GridColumn<T>): number {
  const base = column.width ?? DEFAULT_WIDTH[column.type ?? "text"] ?? 160;
  return clampWidth(Math.max(base, headerFitWidth(column)), column);
}

/** Share of the leftover width a column takes: `grow`, else 1 for text columns and 0 for the rest. */
export function growWeight<T>(column: GridColumn<T>): number {
  if (column.grow !== undefined) return Math.max(0, column.grow);
  return (column.type ?? "text") === "text" ? 1 : 0;
}

/**
 * Widths that fill `available` pixels: the leftover goes to flexible columns in proportion to
 * `growWeight`. Nothing shrinks, a column stops at its `maxWidth`, and a column the user resized
 * (width other than `defaultWidth`) keeps its width.
 */
export function fillColumnWidths<T>(
  columns: readonly GridColumn<T>[],
  widths: Readonly<Record<string, number>>,
  available: number,
  reserved = 0,
): Record<string, number> {
  const result: Record<string, number> = { ...widths };
  const widthOf = (column: GridColumn<T>) => widths[column.id] ?? defaultWidth(column);
  let leftover = available - reserved - columns.reduce((sum, column) => sum + widthOf(column), 0);
  let active = columns.filter(
    (column) => growWeight(column) > 0 && widthOf(column) === defaultWidth(column),
  );
  if (leftover < 1 || active.length === 0) return result;

  for (;;) {
    const total = active.reduce((sum, column) => sum + growWeight(column), 0);
    const capped = active.filter(
      (column) =>
        column.maxWidth !== undefined &&
        widthOf(column) + (leftover * growWeight(column)) / total > column.maxWidth,
    );
    if (capped.length === 0) break;
    for (const column of capped) {
      const max = Math.max(widthOf(column), column.maxWidth as number);
      leftover -= max - widthOf(column);
      result[column.id] = max;
    }
    active = active.filter((column) => !capped.includes(column));
    if (active.length === 0 || leftover < 1) return result;
  }

  const total = active.reduce((sum, column) => sum + growWeight(column), 0);
  let given = 0;
  for (const column of active) {
    const share = Math.floor((leftover * growWeight(column)) / total);
    result[column.id] = widthOf(column) + share;
    given += share;
  }
  const last = active[active.length - 1] as GridColumn<T>;
  result[last.id] = (result[last.id] ?? 0) + (Math.floor(leftover) - given);
  return result;
}

/** Moves `id` one step (`delta` -1 / +1) in `order`. */
export function moveColumn(order: readonly string[], id: string, delta: number): string[] {
  const index = order.indexOf(id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= order.length) return [...order];
  const next = [...order];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return next;
}

/** Moves `id` before or after `targetId` (drag and drop). */
export function moveColumnTo(
  order: readonly string[],
  id: string,
  targetId: string,
  place: "before" | "after",
): string[] {
  if (id === targetId || !order.includes(id) || !order.includes(targetId)) return [...order];
  const next = order.filter((x) => x !== id);
  const index = next.indexOf(targetId) + (place === "after" ? 1 : 0);
  next.splice(index, 0, id);
  return next;
}

/** Reconciles a stored layout with the current columns: unknown ids drop, new ones append. */
export function reconcileLayout<T>(
  columns: readonly GridColumn<T>[],
  stored: Partial<GridLayout> | null,
  fallback: GridLayout,
): GridLayout {
  if (!stored) return fallback;
  const ids = columns.map((column) => column.id);
  const known = (id: unknown): id is string => typeof id === "string" && ids.includes(id);
  const order = [...new Set((stored.order ?? []).filter(known))];
  for (const id of ids) if (!order.includes(id)) order.push(id);
  const widths: Record<string, number> = { ...fallback.widths };
  for (const column of columns) {
    const width = stored.widths?.[column.id];
    if (typeof width === "number" && Number.isFinite(width)) {
      widths[column.id] = clampWidth(width, column);
    }
  }
  const left = [...new Set((stored.pinned?.left ?? []).filter(known))];
  const right = [...new Set((stored.pinned?.right ?? []).filter(known))].filter(
    (id) => !left.includes(id),
  );
  return {
    order,
    hidden: [...new Set((stored.hidden ?? []).filter(known))],
    widths,
    pinned: { left, right },
  };
}

export function parseStoredLayout(raw: string | null): Partial<GridLayout> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Partial<GridLayout>;
  } catch {
    return null;
  }
}

/** Prefix sums of `widths`: `offsets[i]` is where column `i` starts, the last entry is the total. */
export function columnOffsets(widths: readonly number[]): number[] {
  const offsets = new Array<number>(widths.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < widths.length; i += 1)
    offsets[i + 1] = (offsets[i] as number) + (widths[i] as number);
  return offsets;
}
