"use client";

import type { ReactNode } from "react";
import { Search } from "../../icons/index.js";
import * as Command from "../../primitives/command/command.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  /** Secondary text at the end of the row. */
  hint?: string;
  /** Extra terms that should match this item when filtering. */
  keywords?: string[];
  onSelect: () => void;
}

export type CommandPalettePart =
  | "root"
  | "overlay"
  | "header"
  | "searchIcon"
  | "input"
  | "closeKey"
  | "list"
  | "empty"
  | "group"
  | "item"
  | "itemLabel"
  | "itemHint";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  /** Accessible name of the dialog. */
  label: string;
  placeholder: string;
  /** Text shown when nothing matches. */
  emptyLabel: string;
  /** Screen-reader announcement of the result count, e.g. `(n) => \`${n} results\``. */
  formatResultCount: (count: number) => string;
  /** Hint for the close key shown next to the input. */
  closeKeyLabel?: string;
  /** Controlled query, so the parent can react to typing (e.g. debounced remote search). */
  query?: string;
  onQueryChange?: (query: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<CommandPalettePart>;
}

function groupItems(items: CommandPaletteItem[]): [string, CommandPaletteItem[]][] {
  const groups = new Map<string, CommandPaletteItem[]>();
  for (const item of items) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  return [...groups.entries()];
}

function ResultCount({ format }: { format: (count: number) => string }) {
  const count = Command.useCommandState((state) => state.filtered.count);
  return (
    <span data-palette-results aria-live="polite" className="sr-only">
      {format(count)}
    </span>
  );
}

/** Global search/command palette built on the in-house command primitive, shown in a modal dialog. */
export function CommandPalette({
  open,
  onClose,
  items,
  label,
  placeholder,
  emptyLabel,
  formatResultCount,
  closeKeyLabel = "Esc",
  query,
  onQueryChange,
  className,
  classNames,
}: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      label={label}
      overlayClassName={cn("fixed inset-0 z-50 bg-scrim", classNames?.overlay)}
      contentClassName={cn(
        "@container/palette fixed top-[9vh] left-1/2 z-50 flex max-h-[70vh] w-[min(560px,calc(100vw-1rem))] -translate-x-1/2 flex-col overflow-hidden rounded-dialog surface-overlay shadow-overlay",
        className,
        classNames?.root,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 border-b-divider px-3 py-3 @min-[420px]/palette:px-4 @min-[420px]/palette:py-3.5",
          classNames?.header,
        )}
      >
        <Search
          className={cn("size-4.5 shrink-0 text-ink-3", classNames?.searchIcon)}
          aria-hidden="true"
        />
        <Command.Input
          autoFocus
          placeholder={placeholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3",
            classNames?.input,
          )}
          {...(onQueryChange ? { value: query ?? "", onValueChange: onQueryChange } : {})}
        />
        <span
          className={cn(
            "shrink-0 rounded-xs border-divider bg-surface-2 px-1.25 py-1 font-mono @max-[360px]/palette:hidden text-count text-ink-2",
            classNames?.closeKey,
          )}
        >
          {closeKeyLabel}
        </span>
      </div>
      <ResultCount format={formatResultCount} />
      <Command.List
        className={cn("overflow-y-auto p-1.5 @min-[420px]/palette:p-2", classNames?.list)}
      >
        <Command.Empty className={cn("p-4 text-center text-ink-3 text-meta", classNames?.empty)}>
          {emptyLabel}
        </Command.Empty>
        {groupItems(items).map(([group, groupItemsList]) => (
          <Command.Group
            key={group}
            heading={group}
            className={cn(
              "[&_[data-ui-command-group-heading]]:px-2.5 [&_[data-ui-command-group-heading]]:pt-1.5 [&_[data-ui-command-group-heading]]:pb-1 [&_[data-ui-command-group-heading]]:text-meta [&_[data-ui-command-group-heading]]:text-ink-3",
              classNames?.group,
            )}
          >
            {groupItemsList.map((item) => (
              <Command.Item
                key={item.id}
                value={item.id}
                keywords={[item.label, item.hint ?? "", ...(item.keywords ?? [])]}
                onSelect={() => {
                  item.onSelect();
                  onClose();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-ink text-meta data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3",
                  classNames?.item,
                )}
              >
                {item.icon}
                <span className={cn("min-w-0 truncate", classNames?.itemLabel)}>{item.label}</span>
                {item.hint ? (
                  <span
                    className={cn(
                      "ml-auto max-w-[40%] shrink-0 truncate text-ink-3 text-meta in-data-[selected=true]:text-ink-2 @max-[360px]/palette:hidden",
                      classNames?.itemHint,
                    )}
                  >
                    {item.hint}
                  </span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
