"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { focusRowByKey } from "../../utils/list-navigation.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.js";

/** Container widths (px) from which `layout="auto"` shows the table. The set is closed so every query is a literal class. */
export type ResponsiveListBreakpoint = 480 | 640 | 672 | 768 | 960 | 1280;

const tableClasses: Record<ResponsiveListBreakpoint, { table: string; cards: string }> = {
  480: {
    table: "hidden @min-[480px]/responsive-list:block",
    cards: "@min-[480px]/responsive-list:hidden",
  },
  640: {
    table: "hidden @min-[640px]/responsive-list:block",
    cards: "@min-[640px]/responsive-list:hidden",
  },
  672: {
    table: "hidden @min-[42rem]/responsive-list:block",
    cards: "@min-[42rem]/responsive-list:hidden",
  },
  768: {
    table: "hidden @min-[768px]/responsive-list:block",
    cards: "@min-[768px]/responsive-list:hidden",
  },
  960: {
    table: "hidden @min-[960px]/responsive-list:block",
    cards: "@min-[960px]/responsive-list:hidden",
  },
  1280: {
    table: "hidden @min-[1280px]/responsive-list:block",
    cards: "@min-[1280px]/responsive-list:hidden",
  },
};

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
  /**
   * `"auto"` (default) is a table from `breakpoint` of the list's own container width up and cards
   * below it. `"cards"` always renders the cards, for a list that sits in a narrow pane (a master
   * list next to its detail).
   */
  layout?: "auto" | "cards";
  /** Container width (px) from which `layout="auto"` shows the table. Defaults to 672 (42rem). */
  breakpoint?: ResponsiveListBreakpoint;
  /**
   * `"visible"` (default) shows each field label in the cards. `"hidden"` keeps them for screen
   * readers only, for cards whose values explain themselves (a price, a status).
   */
  cardLabels?: "visible" | "hidden";
  /** Key of the selected row, or `null`/`undefined` for none. Only used together with `onSelect`. */
  selectedKey?: string | null;
  /**
   * Makes rows selectable (click, Enter or Space) and adds keyboard navigation (arrows, Home, End).
   * Without `renderActions` the cards are a `listbox` of `option`s and the table a `grid` whose
   * rows carry `aria-selected`; with it the rows keep plain list/table semantics and the selected
   * one gets `aria-current="true"`, because actions cannot live inside an option.
   */
  onSelect?: (key: string, item: T) => void;
  /** Arrow keys select the row they land on, not only move focus. Off by default. */
  selectOnFocus?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ResponsiveListPart>;
}

/** A table from `breakpoint` of its own width up and a stack of cards below it, from one column definition. */
export function ResponsiveList<T>({
  caption,
  items,
  columns,
  rowKey,
  renderActions,
  actionsHeader,
  rowClassName,
  layout = "auto",
  breakpoint = 672,
  cardLabels = "visible",
  selectedKey,
  onSelect,
  selectOnFocus = false,
  className,
  classNames,
}: ResponsiveListProps<T>) {
  const strings = useUiStrings();
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const details = columns.filter((column) => column !== primary);
  const selectable = onSelect !== undefined;
  const listbox = selectable && !renderActions;
  const firstKey = items[0] ? rowKey(items[0]) : undefined;
  const stopKey =
    selectedKey != null && items.some((item) => rowKey(item) === selectedKey)
      ? selectedKey
      : firstKey;

  const rowProps = (item: T, kind: "grid" | "card") => {
    if (!selectable) return {};
    const key = rowKey(item);
    const selected = key === selectedKey;
    const select = () => onSelect(key, item);
    return {
      tabIndex: key === stopKey ? 0 : -1,
      "data-selected": selected ? "true" : undefined,
      ...(kind === "grid" || listbox
        ? { "aria-selected": selected }
        : { "aria-current": selected ? ("true" as const) : undefined }),
      ...(kind === "card" && listbox ? { role: "option" as const } : {}),
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (
          (event.target as HTMLElement).closest(
            "a, button, input, select, textarea, [data-row-actions]",
          )
        )
          return;
        select();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
          return;
        }
        const scope = event.currentTarget.closest("[data-row-scope]");
        if (!scope || event.altKey || event.ctrlKey || event.metaKey) return;
        const row = focusRowByKey(scope, event.currentTarget, event.key);
        if (!row) return;
        event.preventDefault();
        if (selectOnFocus) {
          const nextKey = row.getAttribute("data-row-key");
          const next = items.find((candidate) => rowKey(candidate) === nextKey);
          if (next) onSelect(rowKey(next), next);
        }
      },
    };
  };

  return (
    <div className={cn("@container/responsive-list min-w-0", classNames?.root, className)}>
      {layout === "auto" ? (
        <div
          className={cn(
            "rounded-card border-card shadow-card surface-card",
            tableClasses[breakpoint].table,
            classNames?.tableWrapper,
          )}
        >
          <Table
            {...(selectable ? { role: "grid", "aria-label": caption, "data-row-scope": "" } : {})}
          >
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
                  className={cn(
                    rowClassName?.(item),
                    selectable &&
                      "cursor-pointer focus-visible:focus-ring data-[selected=true]:bg-accent-soft",
                  )}
                  {...rowProps(item, "grid")}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} alignRight={column.align === "end"}>
                      {column.cell(item)}
                    </TableCell>
                  ))}
                  {renderActions ? (
                    <TableCell alignRight>
                      <div
                        data-row-actions=""
                        className={cn("flex flex-wrap justify-end gap-2", classNames?.actions)}
                      >
                        {renderActions(item)}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <ul
        aria-label={caption}
        {...(listbox ? { role: "listbox" } : {})}
        {...(selectable ? { "data-row-scope": "" } : {})}
        className={cn(
          "m-0 flex list-none flex-col gap-density p-0",
          layout === "auto" && tableClasses[breakpoint].cards,
          classNames?.cards,
        )}
      >
        {items.map((item) => (
          <li
            key={rowKey(item)}
            data-row-key={rowKey(item)}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-card border-card p-card shadow-card surface-card",
              selectable &&
                "cursor-pointer focus-visible:focus-ring data-[selected=true]:bg-accent-soft data-[selected=true]:shadow-selected",
              rowClassName?.(item),
              classNames?.card,
            )}
            {...rowProps(item, "card")}
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
                      cardLabels === "hidden" && "justify-start",
                      classNames?.cardDetail,
                    )}
                  >
                    <dt
                      className={cn(
                        "shrink-0 text-ink-3 text-meta",
                        cardLabels === "hidden" && "sr-only",
                        classNames?.cardLabel,
                      )}
                    >
                      {column.header}
                    </dt>
                    <dd
                      className={cn(
                        "m-0 min-w-0 text-right text-body text-ink [overflow-wrap:anywhere]",
                        cardLabels === "hidden" && "text-left",
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
              <div data-row-actions="" className={cn("flex flex-wrap gap-2", classNames?.actions)}>
                {renderActions(item)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
