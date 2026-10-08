"use client";

import { useMemo, useState } from "react";
import { cn } from "../../../utils/cn.js";
import type { MapLabels } from "./map-labels.js";

export interface MapDataRow {
  id: string;
  name: string;
  /** `null`: the region has no data. */
  value: number | null;
  /** Value as text. */
  display: string;
  /** CSS color of the region on the map. */
  color: string;
}

type SortKey = "name" | "value";

/**
 * Visible, sortable table with the same numbers as a choropleth: the accessible alternative to
 * the colors. A bar next to each value repeats the magnitude without relying on hue. Rows
 * without data always sort last.
 */
export function MapDataTable({
  caption,
  rows,
  valueName,
  labels,
  height,
  onRowClick,
}: {
  caption: string;
  rows: readonly MapDataRow[];
  valueName: string;
  labels: MapLabels;
  /** Height in px of the scrolling area. */
  height: number;
  onRowClick?: (row: MapDataRow) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "value",
    direction: "desc",
  });
  const top = useMemo(() => Math.max(0, ...rows.map((row) => row.value ?? 0)), [rows]);
  const sorted = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "name") return factor * a.name.localeCompare(b.name);
      if (a.value == null || b.value == null) {
        return a.value == null ? (b.value == null ? 0 : 1) : -1;
      }
      return factor * (a.value - b.value);
    });
  }, [rows, sort]);
  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  const header = (key: SortKey, text: string, className?: string) => (
    <th
      scope="col"
      aria-sort={
        sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn("sticky top-0 bg-surface px-2 py-1.5 text-left font-bold text-ink", className)}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        aria-label={labels.sortBy(text)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-xs border-0 bg-transparent p-0 font-bold text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      >
        {text}
        <span aria-hidden="true" className="text-[10px] text-ink-3">
          {sort.key === key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
  return (
    <div
      className="@container/table overflow-auto rounded-event border border-line"
      style={{ height }}
    >
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-line border-b">
            {header("name", labels.region)}
            {header("value", valueName, "text-right")}
            <th scope="col" className="sticky top-0 hidden w-1/3 bg-surface @sm/table:table-cell">
              <span className="sr-only">{labels.share}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-line border-b last:border-b-0",
                onRowClick && "cursor-pointer hover:bg-surface-2",
              )}
            >
              <th scope="row" className="px-2 py-1.5 text-left font-semibold text-ink">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-[3px] border border-line"
                    style={{ background: row.color }}
                  />
                  {row.name}
                </span>
              </th>
              <td className="px-2 py-1.5 text-right text-ink tabular-nums">
                {row.value == null ? (
                  <span className="text-ink-3">{labels.noData}</span>
                ) : (
                  row.display
                )}
              </td>
              <td className="hidden px-2 py-1.5 @sm/table:table-cell" aria-hidden="true">
                {row.value != null && top > 0 ? (
                  <span
                    className="block h-1.5 rounded-pill"
                    style={{
                      width: `${Math.max(2, (Math.max(0, row.value) / top) * 100)}%`,
                      background: "var(--accent-word)",
                      opacity: 0.75,
                    }}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
