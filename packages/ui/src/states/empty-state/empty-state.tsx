import type { ReactNode } from "react";
import { Inbox, Lock, Search } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";

/** Domain icons shipped with the state: nothing yet, nothing found, not allowed. */
export type EmptyStateIconName = "inbox" | "search" | "lock";

const DOMAIN_ICONS = { inbox: Inbox, search: Search, lock: Lock } as const;

export interface EmptyStateProps {
  /** Decorative icon (hidden from screen readers): a node, or `"inbox"`, `"search"`, `"lock"`. */
  icon?: ReactNode | EmptyStateIconName;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action. */
  action?: ReactNode;
  /** `outlined` draws a dashed border around the state. */
  variant?: "plain" | "outlined";
  /**
   * `md` (default) is the centered block state. `sm` is the inline state for a list, a table cell
   * or a card body: one muted row (icon, title, description) with the action after it.
   */
  size?: "sm" | "md";
  className?: string;
}

function renderIcon(icon: EmptyStateProps["icon"], iconClass: string): ReactNode {
  if (typeof icon === "string" && icon in DOMAIN_ICONS) {
    const Domain = DOMAIN_ICONS[icon as EmptyStateIconName];
    return <Domain className={iconClass} />;
  }
  return icon;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "plain",
  size = "md",
  className,
}: EmptyStateProps) {
  const small = size === "sm";
  const iconNode = icon ? renderIcon(icon, small ? "size-4" : "size-8") : null;
  return (
    <div
      data-size={size}
      className={cn(
        "@container/empty flex min-w-0",
        small
          ? "flex-wrap items-center gap-x-2 gap-y-1 px-1 py-2 text-fs-130 text-ink-3"
          : "flex-col items-center gap-2 px-4 py-8 text-center @min-[360px]/empty:px-6 @min-[360px]/empty:py-12",
        variant === "outlined" && "rounded-card border border-line-control border-dashed",
        className,
      )}
    >
      {iconNode ? (
        <span aria-hidden="true" className="shrink-0 text-ink-3">
          {iconNode}
        </span>
      ) : null}
      <p
        className={cn(
          "max-w-full [overflow-wrap:anywhere]",
          small ? "font-medium" : "font-semibold text-fs-140 text-ink",
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            "[overflow-wrap:anywhere]",
            small ? "min-w-0" : "max-w-[42ch] text-fs-130 text-ink-3",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div
          className={cn(
            "flex max-w-full flex-wrap gap-2",
            small ? "ms-1 items-center" : "mt-2 justify-center",
          )}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
