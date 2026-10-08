"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../utils/cn.js";
import {
  addChild,
  emptyGroup,
  type FilterCondition,
  type FilterGroup,
  type FilterNode,
  newCondition,
  operatorNeedsValue,
  operatorsFor,
  removeNode,
  updateNode,
  valueKindOf,
} from "./filter-builder.js";
import { type DataGridLabels, DEFAULT_DATA_GRID_LABELS } from "./labels.js";
import { filterKindOf } from "./model.js";
import type { DataGridColumn } from "./types.js";

export interface FilterBuilderProps<T> {
  columns: readonly DataGridColumn<T>[];
  value: FilterGroup;
  onChange: (next: FilterGroup) => void;
  /** Values offered for select-like columns; a text box is used when absent or empty. */
  valuesOf?: (columnId: string) => string[];
  labels?: Partial<DataGridLabels>;
  className?: string;
}

const fieldClass =
  "h-8 w-full min-w-0 rounded-control border border-line-control bg-surface px-2 text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none";
const buttonClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-surface px-2.5 font-[600] text-[12.5px] text-ink-2 hover:border-line-strong hover:text-ink [&_svg]:size-3.5";

/**
 * Builds a filter of nested AND / OR groups of conditions (column, operator, value). It is a
 * controlled editor over a `FilterGroup`; `applyAdvancedFilter` evaluates it. It adapts to the
 * width of its container: fields stack when it is narrow.
 */
export function FilterBuilder<T>({
  columns,
  value,
  onChange,
  valuesOf,
  labels: labelsProp,
  className,
}: FilterBuilderProps<T>) {
  const labels = { ...DEFAULT_DATA_GRID_LABELS, ...labelsProp };
  const filterable = columns.filter((column) => column.filterable !== false);
  return (
    <div className={cn("@container/fb min-w-0", className)}>
      <GroupEditor
        group={value}
        root={value}
        isRoot
        columns={filterable}
        labels={labels}
        valuesOf={valuesOf}
        onChange={onChange}
      />
    </div>
  );
}

interface EditorContext<T> {
  root: FilterGroup;
  columns: readonly DataGridColumn<T>[];
  labels: DataGridLabels;
  valuesOf?: (columnId: string) => string[];
  onChange: (next: FilterGroup) => void;
}

function GroupEditor<T>({
  group,
  isRoot,
  ...context
}: EditorContext<T> & { group: FilterGroup; isRoot?: boolean }) {
  const { root, columns, labels, onChange } = context;
  const first = columns[0];
  return (
    <fieldset
      className={cn(
        "m-0 grid min-w-0 gap-2 border-0 p-0",
        !isRoot && "border-line border-l-2 pl-2.5 @md/fb:pl-3",
      )}
    >
      <legend className="sr-only">{labels.filterGroupLabel}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex h-8 items-center rounded-control border border-line bg-surface p-0.5">
          <legend className="sr-only">{labels.filterGroupLabel}</legend>
          {(["and", "or"] as const).map((logic) => (
            <button
              key={logic}
              type="button"
              aria-pressed={group.logic === logic}
              onClick={() =>
                onChange(updateNode(root, group.id, (n) => ({ ...n, logic }) as FilterNode))
              }
              className="h-full rounded-xs px-2 font-[600] text-[12px] text-ink-3 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-ink"
            >
              {logic === "and" ? labels.matchAll : labels.matchAny}
            </button>
          ))}
        </fieldset>
        <span className="flex-1" />
        {first ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => onChange(addChild(root, group.id, newCondition(first)))}
          >
            <Plus aria-hidden="true" />
            {labels.addCondition}
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(addChild(root, group.id, emptyGroup("or")))}
        >
          <Plus aria-hidden="true" />
          {labels.addGroup}
        </button>
        {isRoot ? null : (
          <button
            type="button"
            className={cn(buttonClass, "px-2")}
            aria-label={labels.removeNode}
            title={labels.removeNode}
            onClick={() => onChange(removeNode(root, group.id))}
          >
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </div>
      {group.children.length === 0 ? (
        <p className="px-1 text-[12.5px] text-ink-3">{labels.noConditions}</p>
      ) : (
        <ul className="grid gap-2">
          {group.children.map((child, index) => (
            <li key={child.id} className="grid gap-1">
              {index > 0 ? (
                <span className="font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em]">
                  {group.logic === "and" ? labels.filterAnd : labels.filterOr}
                </span>
              ) : null}
              {child.type === "group" ? (
                <GroupEditor group={child} {...context} />
              ) : (
                <ConditionEditor condition={child} {...context} />
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function ConditionEditor<T>({
  condition,
  root,
  columns,
  labels,
  valuesOf,
  onChange,
}: EditorContext<T> & { condition: FilterCondition }) {
  const column = columns.find((c) => c.id === condition.columnId) ?? columns[0];
  if (!column) return null;
  const operators = operatorsFor(column);
  const kind = valueKindOf(column);
  const options = ["select", "set"].includes(filterKindOf(column))
    ? (valuesOf?.(column.id) ?? [])
    : [];
  const patch = (next: Partial<FilterCondition>) =>
    onChange(updateNode(root, condition.id, (node) => ({ ...node, ...next }) as FilterNode));
  const needsValue = operatorNeedsValue(condition.operator);
  const valueField = (key: "value" | "value2", label: string) =>
    options.length > 0 ? (
      <select
        aria-label={label}
        value={condition[key] ?? ""}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={fieldClass}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input
        type={kind === "date" ? "date" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        aria-label={label}
        placeholder={label}
        value={condition[key] ?? ""}
        onChange={(event) => patch({ [key]: event.target.value })}
        className={fieldClass}
      />
    );

  return (
    <div className="grid gap-1.5 @md/fb:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] @md/fb:items-center">
      <select
        aria-label={labels.filterColumn}
        value={column.id}
        onChange={(event) => {
          const next = columns.find((c) => c.id === event.target.value);
          if (next) {
            patch({
              columnId: next.id,
              operator: operatorsFor(next)[0] ?? "contains",
              value: "",
              value2: "",
            });
          }
        }}
        className={fieldClass}
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.header}
          </option>
        ))}
      </select>
      <select
        aria-label={labels.filterOperator}
        value={condition.operator}
        onChange={(event) => patch({ operator: event.target.value as FilterCondition["operator"] })}
        className={fieldClass}
      >
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {labels.operators[operator]}
          </option>
        ))}
      </select>
      {needsValue ? (
        <div className={cn("grid gap-1.5", condition.operator === "between" && "grid-cols-2")}>
          {valueField("value", labels.filterValue)}
          {condition.operator === "between" ? valueField("value2", labels.filterValueTo) : null}
        </div>
      ) : (
        <span aria-hidden="true" className="hidden @md/fb:block" />
      )}
      <button
        type="button"
        className={cn(buttonClass, "justify-self-start px-2 @md/fb:justify-self-auto")}
        aria-label={labels.removeNode}
        title={labels.removeNode}
        onClick={() => onChange(removeNode(root, condition.id))}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}
