"use client";

import { Command, useCommandState } from "cmdk";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
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
  const count = useCommandState((state) => state.filtered.count);
  return (
    <span data-palette-results aria-live="polite" className="sr-only">
      {format(count)}
    </span>
  );
}

/** Global search/command palette built on `cmdk`, shown in a modal dialog. */
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
}: CommandPaletteProps) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      label={label}
      overlayClassName="fixed inset-0 z-50 bg-scrim"
      contentClassName={cn(
        "fixed top-[9vh] left-1/2 z-50 flex max-h-[70vh] w-[min(560px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-dialog bg-float shadow-pop",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-line border-b px-4 py-3.5">
        <Search className="size-4.5 text-ink-3" aria-hidden="true" />
        <Command.Input
          autoFocus
          placeholder={placeholder}
          className="flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
          {...(onQueryChange ? { value: query ?? "", onValueChange: onQueryChange } : {})}
        />
        <span className="rounded-xs border border-line bg-surface-2 px-1.25 py-1 font-mono text-count text-ink-2">
          {closeKeyLabel}
        </span>
      </div>
      <ResultCount format={formatResultCount} />
      <Command.List className="overflow-y-auto p-2">
        <Command.Empty className="p-4 text-center text-ink-3 text-meta">{emptyLabel}</Command.Empty>
        {groupItems(items).map(([group, groupItemsList]) => (
          <Command.Group
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:text-ink-3"
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
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-ink text-meta data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3"
              >
                {item.icon}
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="ml-auto text-ink-3 text-meta">{item.hint}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
