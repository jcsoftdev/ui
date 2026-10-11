"use client";

import type { ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
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

export type ResponsiveListPart =
  | "root"
  | "tableWrapper"
  | "cards"
  | "card"
  | "cardTitle"
  | "cardDetails"
  | "cardDetail"
  | "cardLabel"
  | "cardValue"
  | "actions";

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
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<ResponsiveListPart>;
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
  classNames,
}: ResponsiveListProps<T>) {
  const strings = useUiStrings();
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const details = columns.filter((column) => column !== primary);

  return (
    <div className={cn("min-w-0", className, classNames?.root)}>
      <div
        className={cn(
          "hidden rounded-card border-card shadow-card surface-card md:block",
          classNames?.tableWrapper,
        )}
      >
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
                    <div className={cn("flex flex-wrap justify-end gap-2", classNames?.actions)}>
                      {renderActions(item)}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul
        aria-label={caption}
        className={cn("m-0 flex list-none flex-col gap-density p-0 md:hidden", classNames?.cards)}
      >
        {items.map((item) => (
          <li
            key={rowKey(item)}
            data-row-key={rowKey(item)}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-card border-card p-card shadow-card surface-card",
              rowClassName?.(item),
              classNames?.card,
            )}
          >
            <div
              className={cn(
                "min-w-0 font-semibold text-fs-150 text-ink [overflow-wrap:anywhere]",
                classNames?.cardTitle,
              )}
            >
              {primary?.cell(item)}
            </div>
            {details.length > 0 ? (
              <dl className={cn("m-0 flex flex-col gap-2", classNames?.cardDetails)}>
                {details.map((column) => (
                  <div
                    key={column.key}
                    className={cn(
                      "flex items-baseline justify-between gap-4",
                      classNames?.cardDetail,
                    )}
                  >
                    <dt className={cn("shrink-0 text-ink-3 text-meta", classNames?.cardLabel)}>
                      {column.header}
                    </dt>
                    <dd
                      className={cn(
                        "m-0 min-w-0 text-right text-body text-ink [overflow-wrap:anywhere]",
                        classNames?.cardValue,
                      )}
                    >
                      {column.cell(item)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {renderActions ? (
              <div className={cn("flex flex-wrap gap-2", classNames?.actions)}>
                {renderActions(item)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
