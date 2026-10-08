"use client";

import {
  Columns3,
  Download,
  ListFilter,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";
import { cn } from "../../utils/cn.js";
import type { DataGridLabels } from "./labels.js";
import type { DataGridColumn, Density } from "./types.js";

const DENSITIES: Density[] = ["compact", "normal", "comfortable"];

const buttonClass =
  "inline-flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border-divider bg-surface-control px-2.5 font-[600] text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink [&_svg]:size-3.5";

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
  /** Advanced filter editor shown in a popover; the button is hidden without it. */
  advancedFilter?: ReactNode;
  advancedFilterCount?: number;
  onClearAdvancedFilter?: () => void;
  /** Toggle of the side tool panel; hidden when absent. */
  toolPanel?: { open: boolean; onToggle: () => void };
  /** The export button exports the selected rows. */
  exportSelected?: boolean;
  /** Hides the column picker (pivot and tool-panel modes manage columns elsewhere). */
  hideColumnPicker?: boolean;
  /** Undo / redo buttons; hidden when absent. */
  history?: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  /** Add / remove row buttons; each is hidden when its handler is absent. */
  rowTools?: { onAdd?: () => void; onRemove?: () => void; removeDisabled: boolean };
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
  advancedFilter,
  advancedFilterCount = 0,
  onClearAdvancedFilter,
  toolPanel,
  exportSelected = false,
  hideColumnPicker = false,
  history,
  rowTools,
}: GridToolbarProps<T>) {
  const hideable = columns.filter((column) => column.hideable !== false);
  const visibleCount = columns.length - hidden.length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b-divider p-2">
      <label className="relative flex h-control-sm w-full min-w-0 items-center @md/grid:w-60">
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
          className="h-control-sm w-full min-w-0 rounded-input border-control bg-surface-control pr-2 pl-8 text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none"
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

      {advancedFilter ? (
        <Popover>
          <PopoverTrigger
            className={cn(
              buttonClass,
              advancedFilterCount > 0 && "border-accent-line bg-accent-soft text-accent-ink",
            )}
          >
            <ListFilter aria-hidden="true" />
            {labels.advancedFilter}
            {advancedFilterCount > 0 ? (
              <span className="tabular-nums">· {advancedFilterCount}</span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={labels.advancedFilter}
            className="w-[36rem] p-3"
          >
            {advancedFilter}
            {advancedFilterCount > 0 && onClearAdvancedFilter ? (
              <div className="mt-3 flex justify-end border-t-divider pt-2">
                <button type="button" className={buttonClass} onClick={onClearAdvancedFilter}>
                  <X aria-hidden="true" />
                  {labels.clearAdvancedFilter}
                </button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
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

      {history ? (
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{labels.history}</legend>
          <button
            type="button"
            className={cn(buttonClass, "px-2")}
            disabled={!history.canUndo}
            title={labels.undo}
            aria-label={labels.undo}
            onClick={history.onUndo}
          >
            <Undo2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(buttonClass, "px-2")}
            disabled={!history.canRedo}
            title={labels.redo}
            aria-label={labels.redo}
            onClick={history.onRedo}
          >
            <Redo2 aria-hidden="true" />
          </button>
        </fieldset>
      ) : null}

      {rowTools?.onAdd ? (
        <button type="button" className={buttonClass} onClick={rowTools.onAdd}>
          <Plus aria-hidden="true" />
          {labels.addRow}
        </button>
      ) : null}
      {rowTools?.onRemove ? (
        <button
          type="button"
          className={buttonClass}
          disabled={rowTools.removeDisabled}
          onClick={rowTools.onRemove}
        >
          <Trash2 aria-hidden="true" />
          {labels.removeRows}
        </button>
      ) : null}

      {actions}

      <fieldset className="flex h-control-sm items-center rounded-control border-divider bg-surface-control p-0.5">
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

      {hideColumnPicker ? null : (
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
            <div className="border-t-divider p-1 pt-1.5">
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
      )}

      {toolPanel ? (
        <button
          type="button"
          className={cn(
            buttonClass,
            toolPanel.open && "border-accent-line bg-accent-soft text-accent-ink",
          )}
          aria-pressed={toolPanel.open}
          onClick={toolPanel.onToggle}
        >
          <PanelRight aria-hidden="true" />
          {labels.toolPanel}
        </button>
      ) : null}

      {onExport ? (
        <button type="button" className={buttonClass} onClick={onExport}>
          <Download aria-hidden="true" />
          {exportSelected ? labels.exportSelection : labels.exportCsv}
        </button>
      ) : null}
    </div>
  );
}
