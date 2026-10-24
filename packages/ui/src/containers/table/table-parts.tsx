"use client";

import type { ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
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
