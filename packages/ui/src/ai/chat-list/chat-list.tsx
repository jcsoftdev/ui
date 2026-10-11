"use client";

import { useMemo } from "react";
import { Button } from "../../atoms/button/button.js";
import { Plus, Trash2 } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { IconAction } from "../internal/icon-action.js";
import { groupByDate } from "./group.js";

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: Date | string | number;
  /** Last message excerpt. */
  preview?: string;
  unread?: boolean;
}

export type ChatListPart =
  | "root"
  | "newButton"
  | "empty"
  | "group"
  | "groupTitle"
  | "list"
  | "item"
  | "row"
  | "title"
  | "preview"
  | "delete";

export interface ChatListProps {
  items: ChatListItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
  /** Shows a delete button per row. */
  onDelete?: (id: string) => void;
  /** Reference date for the groups; defaults to the current time. Pass it for stable output. */
  now?: Date | string | number;
  /** Accessible name of the navigation landmark. */
  label?: string;
  emptyText?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ChatListPart>;
}

/** Sidebar list of conversations grouped by date (Hoy, Ayer, Últimos 7 días…). */
export function ChatList({
  items,
  activeId,
  onSelect,
  onNew,
  onDelete,
  now,
  label = "Conversaciones",
  emptyText = "Aún no hay conversaciones.",
  className,
  classNames,
}: ChatListProps) {
  const groups = useMemo(() => groupByDate(items, now ?? Date.now()), [items, now]);

  return (
    <nav
      aria-label={label}
      className={cn(
        "@container/chatlist grid min-w-0 content-start gap-density",
        classNames?.root,
        className,
      )}
    >
      {onNew ? (
        <Button
          variant="primary"
          size="sm"
          onClick={onNew}
          className={cn("w-full", classNames?.newButton)}
        >
          <Plus aria-hidden />
          Nueva conversación
        </Button>
      ) : null}
      {groups.length === 0 ? (
        <p className={cn("px-2 text-meta text-ink-3", classNames?.empty)}>{emptyText}</p>
      ) : null}
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`chat-group-${group.id}`}
          className={cn("grid gap-0.5", classNames?.group)}
        >
          <h3
            id={`chat-group-${group.id}`}
            className={cn(
              "px-2 text-overline font-semibold uppercase text-ink-3",
              classNames?.groupTitle,
            )}
          >
            {group.label}
          </h3>
          <ul className={cn("grid gap-0.5", classNames?.list)}>
            {group.items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id} className={cn("group/row relative", classNames?.item)}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect?.(item.id)}
                    className={cn(
                      "grid w-full min-w-0 cursor-pointer gap-0.5 rounded-button px-2 py-1.5 text-left pressable focus-visible:focus-ring",
                      onDelete && "pr-9",
                      active
                        ? "bg-accent-soft text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      classNames?.row,
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {item.unread ? (
                        <>
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
                          <span className="sr-only">Sin leer: </span>
                        </>
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-body",
                          item.unread || active ? "font-semibold" : "font-medium",
                          classNames?.title,
                        )}
                      >
                        {item.title}
                      </span>
                    </span>
                    {item.preview ? (
                      <span
                        className={cn(
                          "hidden truncate text-meta text-ink-3 @xs/chatlist:block",
                          classNames?.preview,
                        )}
                      >
                        {item.preview}
                      </span>
                    ) : null}
                  </button>
                  {onDelete ? (
                    <IconAction
                      label={`Eliminar ${item.title}`}
                      onClick={() => onDelete(item.id)}
                      className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
                        classNames?.delete,
                      )}
                    >
                      <Trash2 aria-hidden />
                    </IconAction>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
