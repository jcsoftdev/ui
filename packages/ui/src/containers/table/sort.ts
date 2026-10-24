export type TableSortDirection = "ascending" | "descending";

/** The sorted column and its direction. `null` stands for "not sorted". */
export interface TableSort {
  columnId: string;
  direction: TableSortDirection;
}

export type AriaSort = "ascending" | "descending" | "none";

/**
 * Next sort when a header is activated: unsorted -> ascending -> descending -> unsorted. Activating
 * another column starts it at ascending.
 */
export function nextTableSort(current: TableSort | null, columnId: string): TableSort | null {
  if (!current || current.columnId !== columnId) return { columnId, direction: "ascending" };
  return current.direction === "ascending" ? { columnId, direction: "descending" } : null;
}

/** `aria-sort` value of a sortable header: only the sorted column reports a direction. */
export function ariaSortFor(current: TableSort | null, columnId: string): AriaSort {
  return current?.columnId === columnId ? current.direction : "none";
}
