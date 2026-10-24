"use client";

import {
  type ComponentPropsWithoutRef,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { IconButton } from "../../atoms/icon-button/icon-button.js";
import { EllipsisVertical } from "../../icons/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../overlays/dropdown-menu/dropdown-menu.js";
import { cn } from "../../utils/cn.js";

export interface RowActionItem {
  /** Stable key of the item. */
  id: string;
  label: string;
  onSelect: () => void;
  /** Leading decorative icon. */
  icon?: ReactNode;
  /** `danger` items sort to the end of the menu, behind a separator, and read in the danger colour. */
  tone?: "default" | "danger";
  disabled?: boolean;
}

export interface RowActionsProps
  extends Omit<ComponentPropsWithoutRef<"span">, "children" | "onClick" | "onKeyDown"> {
  /** Accessible name of the overflow trigger. Name the row: "Actions for Ana Quispe". */
  label: string;
  /** At most one inline action, typically a `Button size="sm"`: the one thing the row is mostly for. */
  primary?: ReactNode;
  /** The rest, in the overflow menu. No trigger renders when it is empty. */
  items: readonly RowActionItem[];
}

/**
 * A click or a key inside the actions (the menu is portaled, but React events still bubble
 * through the component tree) never reaches the row, so a clickable row does not also activate.
 */
function contain(event: MouseEvent | KeyboardEvent): void {
  event.stopPropagation();
}

/**
 * One row's actions: at most one inline primary action, the rest in an overflow menu behind a
 * 30px "more" button. It never wraps, so the row keeps its height; destructive items sort last,
 * behind a separator. The menu is a WAI-ARIA menu: arrows, Home/End, typeahead, Escape.
 */
export function RowActions({ label, primary, items, className, ...props }: RowActionsProps) {
  const regular = items.filter((item) => item.tone !== "danger");
  const destructive = items.filter((item) => item.tone === "danger");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops events from bubbling to the row; the controls inside are the interactive parts
    <span
      data-slot="row-actions"
      className={cn(
        "inline-flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap",
        className,
      )}
      {...props}
      onClick={contain}
      onKeyDown={contain}
    >
      {primary}
      {items.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              size="sm"
              variant="secondary"
              label={label}
              // Reveal: on a pointer that hovers, the glyph is muted until its row is hovered or
              // holds focus; it never hides, so touch and keyboard users always see it.
              className="transition-[scale,color] duration-(--motion-duration) ease-(--motion-ease) motion-reduce:transition-none [@media(hover:hover)]:text-ink-3 [@media(hover:hover)]:group-focus-within/row:text-ink [@media(hover:hover)]:group-hover/row:text-ink data-[state=open]:text-ink"
            >
              <EllipsisVertical aria-hidden="true" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {[regular, destructive].map((group, index) =>
              group.length === 0 ? null : (
                <Fragment key={index === 0 ? "regular" : "destructive"}>
                  {index === 1 && regular.length > 0 ? <DropdownMenuSeparator /> : null}
                  {group.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      disabled={item.disabled}
                      onSelect={() => item.onSelect()}
                      data-tone={item.tone === "danger" ? "danger" : undefined}
                      className={cn(
                        "[&_svg]:size-4 [&_svg]:shrink-0",
                        item.tone === "danger" && "text-danger data-highlighted:bg-danger-soft",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </Fragment>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </span>
  );
}
