// Multi-level column headers: spans of adjacent columns that share a group path.
import type { DataGridColumn } from "./types.js";

export function groupPathOf<T>(column: DataGridColumn<T>): string[] {
  if (column.group === undefined) return [];
  return typeof column.group === "string" ? [column.group] : [...column.group];
}

export interface HeaderGroupCell {
  /** Group label; empty for the columns that have no group at this level. */
  label: string;
  /** Index of the first column it covers. */
  start: number;
  span: number;
}

/**
 * One list of cells per header level, outermost first. Adjacent columns with the same path up to
 * a level share a cell; columns without a group at that level get blank cells. Spans never cross
 * a `breaks` index (pinned zone edges, where the table adds its filler cell).
 */
export function buildHeaderGroups(
  paths: readonly (readonly string[])[],
  breaks: readonly number[] = [],
): HeaderGroupCell[][] {
  const depth = paths.reduce((max, path) => Math.max(max, path.length), 0);
  const breakSet = new Set(breaks);
  const levels: HeaderGroupCell[][] = [];
  for (let level = 0; level < depth; level += 1) {
    const cells: HeaderGroupCell[] = [];
    paths.forEach((path, index) => {
      const label = path[level] ?? "";
      const prefix = path.slice(0, level + 1).join("\u0001");
      const last = cells[cells.length - 1];
      const lastPrefix = last ? paths[last.start]?.slice(0, level + 1).join("\u0001") : undefined;
      if (last && !breakSet.has(index) && last.label === label && lastPrefix === prefix) {
        last.span += 1;
      } else {
        cells.push({ label, start: index, span: 1 });
      }
    });
    levels.push(cells);
  }
  return levels;
}
