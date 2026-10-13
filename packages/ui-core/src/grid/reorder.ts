import { createSortable, type Sortable, type SortableMove } from "../sortable.js";
import type { GridZone } from "./pin.js";

export interface ColumnReorderOptions {
  /** Ids of the header cells currently rendered, in DOM (inline) order. */
  rendered: () => readonly string[];
  /** Zone of a column: a column never leaves its zone. */
  zoneOf: (id: string) => GridZone | undefined;
  /** Called with the dragged column and the neighbour it lands next to. Return `false` to refuse. */
  onReorder: (id: string, targetId: string, place: "before" | "after") => boolean | undefined;
  rtl?: () => boolean;
  /** Names used in announcements. */
  label?: (id: string) => string;
  announce?: (message: string) => void;
  canStartPointer?: (event: PointerEvent, item: HTMLElement) => boolean;
  onDragOver?: (target: { listId: string; index: number } | null, id: string) => void;
  onDragEnd?: () => void;
}

/** The id of the header list: put `data-sortable-list="columns"` on the header row. */
export const COLUMNS_LIST = "columns";

/**
 * Pointer reordering of column headers on top of `createSortable` (horizontal axis, `rtl`,
 * announcements and the `onMove` refusal all come from it). Headers are `[data-sortable-item=id]`
 * inside `[data-sortable-list="columns"]`. Under virtualisation only rendered headers are
 * candidates, so a drop is resolved to a neighbour among them. The keyboard is left to the owner,
 * because Enter and Space sort the column.
 */
export function attachColumnReorder(
  root: HTMLElement,
  options: ColumnReorderOptions,
): Sortable<string> {
  return createSortable<string>(root, {
    axis: "x",
    grabKeys: [],
    lists: () => [{ id: COLUMNS_LIST, items: options.rendered() }],
    getId: (id) => id,
    rtl: options.rtl,
    itemLabel: options.label,
    listLabel: () => "columns",
    announce: options.announce,
    canStartPointer: options.canStartPointer,
    onDragOver: options.onDragOver,
    onDragEnd: options.onDragEnd,
    onMove: (move: SortableMove, lists) => {
      const ids = lists[0]?.items ?? [];
      const at = ids.indexOf(move.itemId);
      const neighbour = at > 0 ? ids[at - 1] : ids[1];
      if (!neighbour) return false;
      const zone = options.zoneOf(move.itemId);
      if (zone === undefined || zone !== options.zoneOf(neighbour)) return false;
      return options.onReorder(move.itemId, neighbour, at > 0 ? "after" : "before");
    },
  });
}
