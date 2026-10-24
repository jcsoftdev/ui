"use client";

import type { ReactNode } from "react";
import { Checkbox } from "../../atoms/checkbox/checkbox.js";
import { useUiStrings } from "../../i18n/index.js";
import { Columns3 } from "../../icons/index.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";
import { EmptyState } from "../../states/empty-state/empty-state.js";
import { cn } from "../../utils/cn.js";

export interface TableEmptyProps {
  /** Number of columns to span: the count of header cells. */
  colSpan: number;
  /** Defaults to the localized "No rows to show". */
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Call to action, e.g. a button that clears the filters. */
  action?: ReactNode;
  className?: string;
}

/** Single row that holds an `EmptyState` across every column. Put it in `TableBody` when there are no rows. */
export function TableEmpty({
  colSpan,
  title,
  description,
  icon,
  action,
  className,
}: TableEmptyProps) {
  const strings = useUiStrings();
  return (
    <tr>
      <td colSpan={colSpan} className={cn("p-0", className)}>
        <EmptyState
          title={title ?? strings.tableEmpty}
          description={description}
          icon={icon}
          action={action}
        />
      </td>
    </tr>
  );
}

export interface TableLoadingProps {
  /** Number of columns of the table. */
  columns: number;
  /** Placeholder rows. Default 5. */
  rows?: number;
  /** Text announced to screen readers. Defaults to the localized "Loading". */
  label?: string;
}

const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6"] as const;

/** Placeholder rows for the first load. The rows are decorative; one status region announces the load. */
export function TableLoading({ columns, rows = 5, label }: TableLoadingProps) {
  const strings = useUiStrings();
  return Array.from({ length: Math.max(0, rows) }, (_, row) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
    <tr key={row} aria-hidden={row === 0 ? undefined : "true"} className="border-b-divider">
      {Array.from({ length: Math.max(1, columns) }, (_, column) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cells have no identity
        <td key={column} className="px-4 py-2.75 align-middle @max-sm/table:px-2.5">
          {row === 0 && column === 0 ? (
            <span role="status" className="sr-only">
              {label ?? strings.loading}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "block h-3 animate-pulse rounded-xs bg-surface-2",
              WIDTHS[(row + column) % WIDTHS.length],
            )}
          />
        </td>
      ))}
    </tr>
  ));
}

export interface TableColumnOption {
  id: string;
  label: string;
}

export interface TableColumnsMenuProps {
  columns: readonly TableColumnOption[];
  /** Ids of the hidden columns; pass the same list to `Table` as `hiddenColumns`. */
  hiddenColumns: readonly string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  /** Trigger text. Defaults to the localized "Columns". */
  label?: string;
}

/** Popover with a checkbox per column. The last visible column cannot be hidden. */
export function TableColumnsMenu({
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
  label,
}: TableColumnsMenuProps) {
  const strings = useUiStrings();
  const name = label ?? strings.columns;
  const visible = columns.filter((column) => !hiddenColumns.includes(column.id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-control-sm items-center gap-1.5 rounded-control bg-surface-control px-2.5 text-fs-125 text-ink shadow-control hover:bg-surface-2 focus-visible:focus-ring [&_svg]:size-4"
        >
          <Columns3 aria-hidden="true" />
          {name}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={name}>
        <ul className="m-0 grid list-none gap-1 p-0">
          {columns.map((column) => {
            const shown = !hiddenColumns.includes(column.id);
            return (
              <li key={column.id} className="px-1.5 py-1">
                <Checkbox
                  label={column.label}
                  checked={shown}
                  disabled={shown && visible.length === 1}
                  onCheckedChange={() =>
                    onHiddenColumnsChange(
                      shown
                        ? [...hiddenColumns, column.id]
                        : hiddenColumns.filter((id) => id !== column.id),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
