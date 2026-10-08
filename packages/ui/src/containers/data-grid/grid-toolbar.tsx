"use client";

import { Columns3, Download, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";
import { cn } from "../../utils/cn.js";
import type { DataGridLabels } from "./labels.js";
import type { DataGridColumn, Density } from "./types.js";

const DENSITIES: Density[] = ["compact", "normal", "comfortable"];

const buttonClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-surface px-2.5 font-[600] text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink [&_svg]:size-3.5";

export interface GridToolbarProps<T> {
  labels: DataGridLabels;
  search: string;
  onSearch: (value: string) => void;
  activeFilters: number;
  onClearFilters: () => void;
  groupBy: readonly string[];
  columns: readonly DataGridColumn<T>[];
  onUngroup: (id: string) => void;
  density: Density;
  onDensity: (density: Density) => void;
  hidden: readonly string[];
  onHidden: (id: string, hidden: boolean) => void;
  onResetColumns: () => void;
  onExport?: () => void;
  rowCount: number;
  selectedCount: number | null;
  /** Extra content at the end of the toolbar. */
  actions?: ReactNode;
}

/** Search, filter and grouping chips, column visibility, density and export. Wraps when narrow. */
export function GridToolbar<T>({
  labels,
  search,
  onSearch,
  activeFilters,
  onClearFilters,
  groupBy,
  columns,
  onUngroup,
  density,
  onDensity,
  hidden,
  onHidden,
  onResetColumns,
  onExport,
  rowCount,
  selectedCount,
  actions,
}: GridToolbarProps<T>) {
  const hideable = columns.filter((column) => column.hideable !== false);
  const visibleCount = columns.length - hidden.length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-line border-b p-2">
      <label className="relative flex h-8 w-full min-w-0 items-center @md/grid:w-60">
        <span className="sr-only">{labels.search}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 size-3.5 text-ink-3"
        />
        <input
          type="search"
          value={search}
          placeholder={labels.searchPlaceholder}
          onChange={(event) => onSearch(event.target.value)}
          className="h-8 w-full min-w-0 rounded-control border border-line-control bg-surface pr-2 pl-8 text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none"
        />
      </label>

      {activeFilters > 0 ? (
        <button type="button" className={buttonClass} onClick={onClearFilters}>
          <X aria-hidden="true" />
          <span>
            {labels.filtersActive(activeFilters)} · {labels.clearFilters}
          </span>
        </button>
      ) : null}

      {groupBy.map((id) => {
        const header = columns.find((column) => column.id === id)?.header ?? id;
        return (
          <button
            key={id}
            type="button"
            className={cn(buttonClass, "border-accent-line bg-accent-soft text-accent-ink")}
            aria-label={`${labels.removeGrouping}: ${header}`}
            onClick={() => onUngroup(id)}
          >
            <span className="font-normal">{labels.groupedBy}</span> {header}
            <X aria-hidden="true" />
          </button>
        );
      })}

      <p className="mr-auto text-[12px] text-ink-3" aria-live="polite">
        {labels.rowsCount(rowCount)}
        {selectedCount ? ` · ${labels.selectedCount(selectedCount)}` : ""}
      </p>

      {actions}

      <fieldset className="flex h-8 items-center rounded-control border border-line bg-surface p-0.5">
        <legend className="sr-only">{labels.density}</legend>
        {DENSITIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={density === option}
            onClick={() => onDensity(option)}
            className="h-full rounded-xs px-2 font-[600] text-[12px] text-ink-3 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-ink"
          >
            {labels.densities[option]}
          </button>
        ))}
      </fieldset>

      <Popover>
        <PopoverTrigger className={buttonClass}>
          <Columns3 aria-hidden="true" />
          {labels.columns}
        </PopoverTrigger>
        <PopoverContent align="end" aria-label={labels.columns} className="w-60">
          <fieldset className="grid max-h-72 gap-0.5 overflow-y-auto p-1">
            <legend className="sr-only">{labels.columns}</legend>
            {hideable.map((column) => {
              const isHidden = hidden.includes(column.id);
              return (
                <label
                  key={column.id}
                  className="flex min-h-8 items-center gap-2 rounded-xs px-1.5 text-[13px] text-ink hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={!isHidden}
                    disabled={!isHidden && visibleCount <= 1}
                    onChange={(event) => onHidden(column.id, !event.target.checked)}
                  />
                  <span className="truncate">{column.header}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="border-line border-t p-1 pt-1.5">
            <button
              type="button"
              className={cn(buttonClass, "w-full justify-center")}
              onClick={onResetColumns}
            >
              {labels.resetColumns}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {onExport ? (
        <button type="button" className={buttonClass} onClick={onExport}>
          <Download aria-hidden="true" />
          {labels.exportCsv}
        </button>
      ) : null}
    </div>
  );
}
