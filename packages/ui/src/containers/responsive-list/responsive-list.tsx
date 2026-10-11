"use client";

import type { ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.js";

export interface ResponsiveListColumn<T> {
  key: string;
  header: string;
  cell: (item: T) => ReactNode;
  /** Title of the stacked card. Defaults to the first column. */
  primary?: boolean;
  align?: "start" | "end";
}

export interface ResponsiveListProps<T> {
  /** Accessible name of the table and of the card list. */
  caption: string;
  items: readonly T[];
  columns: readonly ResponsiveListColumn<T>[];
  rowKey: (item: T) => string;
  /** Per-row actions: a last table column, and a footer row on each card. */
  renderActions?: (item: T) => ReactNode;
  /** Header of the actions column. Defaults to the localized "Actions". */
  actionsHeader?: string;
  rowClassName?: (item: T) => string | undefined;
  className?: string;
}

/** A table from `md` up and a stack of cards below it, from one column definition. */
export function ResponsiveList<T>({
  caption,
  items,
  columns,
  rowKey,
  renderActions,
  actionsHeader,
  rowClassName,
  className,
}: ResponsiveListProps<T>) {
  const strings = useUiStrings();
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const details = columns.filter((column) => column !== primary);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="hidden rounded-card border-card shadow-card surface-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHead>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHeaderCell key={column.key} scope="col" alignRight={column.align === "end"}>
                  {column.header}
                </TableHeaderCell>
              ))}
              {renderActions ? (
                <TableHeaderCell scope="col" alignRight>
                  {actionsHeader ?? strings.actions}
                </TableHeaderCell>
              ) : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={rowKey(item)}
                data-row-key={rowKey(item)}
                className={rowClassName?.(item)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} alignRight={column.align === "end"}>
                    {column.cell(item)}
                  </TableCell>
                ))}
                {renderActions ? (
                  <TableCell alignRight>
                    <div className="flex flex-wrap justify-end gap-2">{renderActions(item)}</div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={caption} className="m-0 flex list-none flex-col gap-density p-0 md:hidden">
        {items.map((item) => (
          <li
            key={rowKey(item)}
            data-row-key={rowKey(item)}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-card border-card p-card shadow-card surface-card",
              rowClassName?.(item),
            )}
          >
            <div className="min-w-0 font-semibold text-[15px] text-ink [overflow-wrap:anywhere]">
              {primary?.cell(item)}
            </div>
            {details.length > 0 ? (
              <dl className="m-0 flex flex-col gap-2">
                {details.map((column) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-ink-3 text-meta">{column.header}</dt>
                    <dd className="m-0 min-w-0 text-right text-body text-ink [overflow-wrap:anywhere]">
                      {column.cell(item)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {renderActions ? (
              <div className="flex flex-wrap gap-2">{renderActions(item)}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
