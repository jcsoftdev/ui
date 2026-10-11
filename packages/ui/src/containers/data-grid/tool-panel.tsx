"use client";

import { type ReactNode, useId } from "react";
import { ArrowDown, ArrowUp } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import type { DataGridLabels } from "./labels.js";
import type { PivotConfig } from "./pivot.js";
import type { AggregateKind, DataGridColumn } from "./types.js";

const AGGREGATES: AggregateKind[] = ["sum", "avg", "count", "min", "max"];

export const EMPTY_PIVOT: PivotConfig = {
  enabled: false,
  rows: [],
  column: "",
  value: "",
  aggregate: "sum",
};

export interface GridToolPanelProps<T> {
  labels: DataGridLabels;
  columns: readonly DataGridColumn<T>[];
  /** Columns the grid shows now (a pivot replaces them); `columns` when absent. */
  shownColumns?: readonly DataGridColumn<T>[];
  /** Every column id in layout order. */
  order: readonly string[];
  hidden: readonly string[];
  onHidden: (id: string, hidden: boolean) => void;
  onMove: (id: string, delta: number) => void;
  groupBy: readonly string[];
  onGroup: (id: string, on: boolean) => void;
  pivot: PivotConfig;
  onPivot: (next: PivotConfig) => void;
  pivotValid: boolean;
  /** Row grouping is off while a tree, pivot or remote source drives the rows. */
  canGroup: boolean;
  canPivot: boolean;
  /** Height cap in px; the panel scrolls inside it. */
  maxHeight?: number;
  className?: string;
}

const selectClass =
  "h-control-sm w-full min-w-0 rounded-input border-control bg-surface-control px-2 text-fs-130 text-ink focus-visible:border-accent focus-visible:outline-none";
const iconButton =
  "grid size-6 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1 border-b-divider p-2 last:border-b-0">
      <h3 className="px-1 pb-0.5 font-[650] text-fs-110 text-ink-3 uppercase tracking-[.07em]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Check({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-7 min-w-0 flex-1 items-center gap-2 text-fs-130 text-ink">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-accent"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="truncate">{children}</span>
    </label>
  );
}

/**
 * Side panel to show, hide and reorder columns, group rows and configure a pivot (row fields,
 * pivot column, aggregated value). It stacks above the grid when its container is narrow.
 */
export function GridToolPanel<T>({
  labels,
  columns,
  shownColumns,
  order,
  hidden,
  onHidden,
  onMove,
  groupBy,
  onGroup,
  pivot,
  onPivot,
  pivotValid,
  canGroup,
  canPivot,
  maxHeight,
  className,
}: GridToolPanelProps<T>) {
  const id = useId();
  const byId = new Map((shownColumns ?? columns).map((column) => [column.id, column]));
  const ordered = order.map((key) => byId.get(key)).filter((c): c is DataGridColumn<T> => !!c);
  const visibleCount = ordered.length - hidden.length;
  const groupable = columns.filter((column) => column.groupable === true);
  const dimensions = columns.filter(
    (column) => column.type !== "number" && column.type !== "currency",
  );
  const measures = columns.filter(
    (column) => column.type === "number" || column.type === "currency",
  );
  const patch = (next: Partial<PivotConfig>) => onPivot({ ...pivot, ...next });
  const pivotOn = pivot.enabled !== false && canPivot;

  return (
    <aside
      aria-label={labels.toolPanel}
      style={maxHeight ? { maxHeight } : undefined}
      className={cn(
        "min-h-0 min-w-0 overflow-y-auto bg-surface-2/40 text-fs-130 @max-2xl/grid:max-h-72 @max-2xl/grid:border-b-divider @2xl/grid:w-64 @2xl/grid:shrink-0 @2xl/grid:border-l-divider",
        className,
      )}
    >
      <Section title={labels.panelColumns}>
        <ul className="grid gap-0.5">
          {ordered.map((column, index) => {
            const isHidden = hidden.includes(column.id);
            return (
              <li
                key={column.id}
                className="flex items-center gap-1 rounded-xs px-1 hover:bg-surface"
              >
                <Check
                  checked={!isHidden}
                  disabled={column.hideable === false || (!isHidden && visibleCount <= 1)}
                  onChange={(checked) => onHidden(column.id, !checked)}
                >
                  {column.header}
                </Check>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`${labels.moveColumnUp}: ${column.header}`}
                  title={labels.moveColumnUp}
                  disabled={index === 0 || column.reorderable === false}
                  onClick={() => onMove(column.id, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`${labels.moveColumnDown}: ${column.header}`}
                  title={labels.moveColumnDown}
                  disabled={index === ordered.length - 1 || column.reorderable === false}
                  onClick={() => onMove(column.id, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {groupable.length > 0 ? (
        <Section title={labels.panelRowGroups}>
          <ul className="grid gap-0.5">
            {groupable.map((column) => (
              <li key={column.id} className="flex items-center gap-1 px-1">
                <Check
                  checked={groupBy.includes(column.id)}
                  disabled={!canGroup}
                  onChange={(checked) => onGroup(column.id, checked)}
                >
                  {column.header}
                </Check>
                {groupBy.includes(column.id) ? (
                  <span className="text-fs-110 text-ink-3 tabular-nums">
                    {groupBy.indexOf(column.id) + 1}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {measures.length > 0 && dimensions.length > 1 ? (
        <Section title={labels.panelPivot}>
          <Check
            checked={pivotOn}
            disabled={!canPivot}
            onChange={(checked) => patch({ enabled: checked })}
          >
            {labels.pivotMode}
          </Check>
          {pivotOn ? (
            <div className="grid gap-2 pt-1">
              <fieldset className="grid gap-0.5 border-0 p-0">
                <legend className="px-1 pb-0.5 text-fs-120 text-ink-3">{labels.pivotRows}</legend>
                {dimensions
                  .filter((column) => column.id !== pivot.column)
                  .map((column) => (
                    <div key={column.id} className="flex items-center px-1">
                      <Check
                        checked={pivot.rows.includes(column.id)}
                        onChange={(checked) =>
                          patch({
                            rows: checked
                              ? [...pivot.rows, column.id]
                              : pivot.rows.filter((x) => x !== column.id),
                          })
                        }
                      >
                        {column.header}
                      </Check>
                    </div>
                  ))}
              </fieldset>
              <label className="grid gap-1" htmlFor={`${id}-column`}>
                <span className="px-1 text-fs-120 text-ink-3">{labels.pivotColumn}</span>
                <select
                  id={`${id}-column`}
                  className={selectClass}
                  value={pivot.column}
                  onChange={(event) =>
                    patch({
                      column: event.target.value,
                      rows: pivot.rows.filter((x) => x !== event.target.value),
                    })
                  }
                >
                  <option value="">{labels.noneOption}</option>
                  {dimensions.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.header}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1" htmlFor={`${id}-value`}>
                <span className="px-1 text-fs-120 text-ink-3">{labels.pivotValue}</span>
                <select
                  id={`${id}-value`}
                  className={selectClass}
                  value={pivot.value}
                  onChange={(event) => patch({ value: event.target.value })}
                >
                  <option value="">{labels.noneOption}</option>
                  {measures.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.header}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1" htmlFor={`${id}-aggregate`}>
                <span className="px-1 text-fs-120 text-ink-3">{labels.pivotAggregate}</span>
                <select
                  id={`${id}-aggregate`}
                  className={selectClass}
                  value={pivot.aggregate}
                  onChange={(event) => patch({ aggregate: event.target.value as AggregateKind })}
                >
                  {AGGREGATES.map((kind) => (
                    <option key={kind} value={kind}>
                      {labels.aggregate[kind]}
                    </option>
                  ))}
                </select>
              </label>
              {pivotValid ? null : (
                <p role="status" className="px-1 text-fs-120 text-ink-3">
                  {labels.pivotIncomplete}
                </p>
              )}
            </div>
          ) : null}
        </Section>
      ) : null}
    </aside>
  );
}
