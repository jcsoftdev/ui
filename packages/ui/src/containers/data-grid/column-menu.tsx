"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  EllipsisVertical,
  EyeOff,
  Filter,
  Layers,
  type LucideIcon,
  Minus,
  MoveHorizontal,
  PinOff,
  Plus,
  X,
} from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";
import { cn } from "../../utils/cn.js";
import type { DataGridLabels } from "./labels.js";
import {
  checkedSetValues,
  filterKindOf,
  isFilterActive,
  searchOptions,
  toggleSetValues,
} from "./model.js";
import type { DataGridColumn, FilterValue, PinSide, SortDirection } from "./types.js";

export interface ColumnMenuProps<T> {
  column: DataGridColumn<T>;
  labels: DataGridLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the menu closes, instead of focusing the trigger. */
  onCloseFocus: () => void;
  sortDirection: SortDirection | null;
  filter: FilterValue | undefined;
  /** Values for the select filter. */
  values: () => string[];
  pinned: PinSide | null;
  grouped: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canHide: boolean;
  onSort: (direction: SortDirection | null) => void;
  onFilter: (filter: FilterValue | undefined) => void;
  onPin: (side: PinSide | null) => void;
  onGroup: (grouped: boolean) => void;
  onMove: (delta: number) => void;
  onResize: (delta: number | null) => void;
  onHide: () => void;
}

const itemClass =
  "flex min-h-8 w-full items-center gap-2 rounded-xs px-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink disabled:pointer-events-none disabled:opacity-40 aria-pressed:text-accent-ink [&_svg]:size-3.5 [&_svg]:shrink-0";

const inputClass =
  "h-8 w-full min-w-0 rounded-control border border-line-control bg-surface px-2 text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none";

function Item({
  icon: Icon,
  children,
  pressed,
  ...props
}: {
  icon: LucideIcon;
  children: ReactNode;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" aria-pressed={pressed} className={itemClass} {...props}>
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function Section({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="border-line border-t py-1 first:border-t-0 first:pt-0 last:pb-0">
      {label ? (
        <p className="px-2 pt-1 pb-1.5 font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em]">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function parseNumber(text: string): number | null {
  const value = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Searchable checkbox list with a select-all control; unchecking values narrows the rows. */
function SetFilterEditor<T>({
  column,
  filter,
  labels,
  values,
  onFilter,
}: Pick<ColumnMenuProps<T>, "column" | "filter" | "labels" | "values" | "onFilter">) {
  const id = useId();
  const [query, setQuery] = useState("");
  const options = values();
  const visible = searchOptions(options, query);
  const checked = checkedSetValues(options, filter);
  const visibleChecked = visible.filter((value) => checked.has(value)).length;
  const allVisible = visible.length > 0 && visibleChecked === visible.length;
  return (
    <div className="grid gap-1.5">
      <input
        type="search"
        aria-label={`${labels.searchValues}: ${column.header}`}
        placeholder={labels.searchValues}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={inputClass}
      />
      <fieldset className="grid max-h-48 gap-0.5 overflow-y-auto">
        <legend className="sr-only">{`${labels.filter}: ${column.header}`}</legend>
        <label className="flex min-h-7 items-center gap-2 border-line border-b px-1 text-[13px] text-ink-2">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={allVisible}
            disabled={visible.length === 0}
            ref={(node) => {
              if (node) node.indeterminate = visibleChecked > 0 && !allVisible;
            }}
            onChange={() => onFilter(toggleSetValues(options, filter, visible, !allVisible))}
          />
          <span className="flex-1">{labels.selectAllValues}</span>
          <span className="text-[11px] text-ink-3 tabular-nums">
            {labels.valuesChecked(checked.size, options.length)}
          </span>
        </label>
        {visible.length === 0 ? (
          <p className="px-1 py-1.5 text-[13px] text-ink-3">{labels.noMatches}</p>
        ) : null}
        {visible.map((value, index) => (
          <label
            key={value}
            htmlFor={`${id}-${index}`}
            className="flex min-h-7 items-center gap-2 px-1 text-[13px] text-ink"
          >
            <input
              id={`${id}-${index}`}
              type="checkbox"
              className="size-4 accent-accent"
              checked={checked.has(value)}
              onChange={(event) =>
                onFilter(toggleSetValues(options, filter, [value], event.target.checked))
              }
            />
            <span className="truncate">{value || "—"}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function FilterEditor<T>({
  column,
  filter,
  labels,
  values,
  onFilter,
}: Pick<ColumnMenuProps<T>, "column" | "filter" | "labels" | "values" | "onFilter">) {
  const id = useId();
  const kind = filterKindOf(column);
  const name = column.header;

  if (kind === "text") {
    const query = filter?.kind === "text" ? filter.query : "";
    return (
      <input
        type="search"
        aria-label={`${labels.filter}: ${name}`}
        placeholder={labels.contains}
        value={query}
        onChange={(event) => onFilter({ kind: "text", query: event.target.value })}
        className={inputClass}
      />
    );
  }

  if (kind === "range") {
    const range = filter?.kind === "range" ? filter : { kind: "range" as const };
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {(["min", "max"] as const).map((end) => (
          <input
            key={end}
            type="number"
            inputMode="decimal"
            aria-label={`${name}: ${labels[end]}`}
            placeholder={labels[end]}
            value={range[end] ?? ""}
            onChange={(event) =>
              onFilter({ ...range, kind: "range", [end]: parseNumber(event.target.value) })
            }
            className={inputClass}
          />
        ))}
      </div>
    );
  }

  if (kind === "dateRange") {
    const range = filter?.kind === "dateRange" ? filter : { kind: "dateRange" as const };
    return (
      <div className="grid gap-1.5">
        {(["from", "to"] as const).map((end) => (
          <label key={end} className="grid grid-cols-[3.5rem_1fr] items-center gap-1.5">
            <span className="text-[12px] text-ink-3">{labels[end]}</span>
            <input
              type="date"
              value={range[end] ?? ""}
              onChange={(event) =>
                onFilter({ ...range, kind: "dateRange", [end]: event.target.value || null })
              }
              className={inputClass}
            />
          </label>
        ))}
      </div>
    );
  }

  if (kind === "set") {
    return (
      <SetFilterEditor
        column={column}
        filter={filter}
        labels={labels}
        values={values}
        onFilter={onFilter}
      />
    );
  }

  const selected = filter?.kind === "select" ? filter.values : [];
  const options = values();
  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...selected, value] : selected.filter((x) => x !== value);
    onFilter({ kind: "select", values: next });
  };
  return (
    <fieldset className="grid max-h-48 gap-0.5 overflow-y-auto">
      <legend className="sr-only">{`${labels.filter}: ${name}`}</legend>
      <label className="flex min-h-7 items-center gap-2 px-1 text-[13px] text-ink-2">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={selected.length === 0}
          onChange={() => onFilter(undefined)}
        />
        {labels.allValues}
      </label>
      {options.map((value, index) => (
        <label
          key={value}
          htmlFor={`${id}-${index}`}
          className="flex min-h-7 items-center gap-2 px-1 text-[13px] text-ink"
        >
          <input
            id={`${id}-${index}`}
            type="checkbox"
            className="size-4 accent-accent"
            checked={selected.includes(value)}
            onChange={(event) => toggle(value, event.target.checked)}
          />
          <span className="truncate">{value}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Per-column options: sort, filter, pin, group, move, width and hide. */
export function ColumnMenu<T>(props: ColumnMenuProps<T>) {
  const { column, labels, open, onOpenChange, onCloseFocus, sortDirection, filter, pinned } = props;
  const sortable = column.sortable !== false;
  const filterable = column.filterable !== false;
  const pinnable = column.pinnable !== false;
  const groupable = column.groupable === true;
  const resizable = column.resizable !== false;
  const reorderable = column.reorderable !== false;
  const active = isFilterActive(filter);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        tabIndex={-1}
        aria-label={labels.columnMenu(column.header)}
        title={labels.columnMenu(column.header)}
        className={cn(
          "relative grid size-6 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink",
          active && "text-accent-ink",
        )}
      >
        {active ? (
          <Filter aria-hidden="true" className="size-3.5" />
        ) : (
          <EllipsisVertical aria-hidden="true" className="size-3.5" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={labels.columnMenu(column.header)}
        className="w-64 normal-case tracking-normal"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
      >
        {sortable ? (
          <Section>
            <Item
              icon={ArrowUp}
              pressed={sortDirection === "asc"}
              onClick={() => props.onSort("asc")}
            >
              {labels.sortAsc}
            </Item>
            <Item
              icon={ArrowDown}
              pressed={sortDirection === "desc"}
              onClick={() => props.onSort("desc")}
            >
              {labels.sortDesc}
            </Item>
            {sortDirection ? (
              <Item icon={X} onClick={() => props.onSort(null)}>
                {labels.clearSort}
              </Item>
            ) : null}
          </Section>
        ) : null}
        {filterable ? (
          <Section label={labels.filter}>
            <div className="grid gap-1.5 px-1 pb-1">
              <FilterEditor
                column={column}
                filter={filter}
                labels={labels}
                values={props.values}
                onFilter={props.onFilter}
              />
              {active ? (
                <button
                  type="button"
                  className={cn(itemClass, "min-h-7")}
                  onClick={() => props.onFilter(undefined)}
                >
                  <X aria-hidden="true" />
                  {labels.clearFilter}
                </button>
              ) : null}
            </div>
          </Section>
        ) : null}
        {pinnable || groupable ? (
          <Section>
            {pinnable && pinned !== "left" ? (
              <Item icon={ArrowLeftToLine} onClick={() => props.onPin("left")}>
                {labels.pinLeft}
              </Item>
            ) : null}
            {pinnable && pinned !== "right" ? (
              <Item icon={ArrowRightToLine} onClick={() => props.onPin("right")}>
                {labels.pinRight}
              </Item>
            ) : null}
            {pinnable && pinned ? (
              <Item icon={PinOff} onClick={() => props.onPin(null)}>
                {labels.unpin}
              </Item>
            ) : null}
            {groupable ? (
              <Item
                icon={Layers}
                pressed={props.grouped}
                onClick={() => props.onGroup(!props.grouped)}
              >
                {props.grouped ? labels.removeGrouping : labels.groupBy}
              </Item>
            ) : null}
          </Section>
        ) : null}
        {reorderable || resizable || props.canHide ? (
          <Section>
            {reorderable ? (
              <>
                <Item
                  icon={ArrowLeft}
                  disabled={!props.canMoveLeft}
                  onClick={() => props.onMove(-1)}
                >
                  {labels.moveLeft}
                </Item>
                <Item
                  icon={ArrowRight}
                  disabled={!props.canMoveRight}
                  onClick={() => props.onMove(1)}
                >
                  {labels.moveRight}
                </Item>
              </>
            ) : null}
            {resizable ? (
              <>
                <Item icon={Minus} onClick={() => props.onResize(-24)}>
                  {labels.narrower}
                </Item>
                <Item icon={Plus} onClick={() => props.onResize(24)}>
                  {labels.wider}
                </Item>
                <Item icon={MoveHorizontal} onClick={() => props.onResize(null)}>
                  {labels.resetWidth}
                </Item>
              </>
            ) : null}
            {props.canHide ? (
              <Item icon={EyeOff} onClick={props.onHide}>
                {labels.hide}
              </Item>
            ) : null}
          </Section>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
