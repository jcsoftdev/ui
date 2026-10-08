export interface TocItem {
  /** DOM id of the heading element. */
  id: string;
  label: string;
  /** Indentation level, 1 (default) to 3. */
  level?: 1 | 2 | 3;
}

/**
 * Active section from the headings currently intersecting the observation band: the first
 * visible one in document order. When none is visible the previous active one stays, so the
 * highlight never blinks off between two headings.
 */
export function pickActive(
  order: readonly string[],
  visible: ReadonlySet<string>,
  previous: string | null,
): string | null {
  for (const id of order) {
    if (visible.has(id)) return id;
  }
  return previous && order.includes(previous) ? previous : (order[0] ?? null);
}
