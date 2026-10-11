"use client";

import { type ReactNode, type Ref, useEffect, useState } from "react";
import { Menu, Search } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || "");
}

export interface TopbarProps {
  /** Breadcrumb trail in order; the last entry is the current view. */
  breadcrumbs: string[];
  /** Accessible name of the breadcrumb landmark. */
  breadcrumbsLabel: string;
  /** Menu button (shown when the `AppShell` container is under 900 px, matching the Sidebar drawer) that opens the sidebar drawer. Needs an `@container/app` ancestor, which `AppShell` provides. Omitted when not set. */
  onOpenMenu?: () => void;
  menuLabel?: string;
  /** Ref to the menu button so the opener can restore focus when the drawer closes. */
  menuButtonRef?: Ref<HTMLButtonElement>;
  /** Called by the search trigger and by Cmd/Ctrl+K. */
  onSearch: () => void;
  searchLabel: string;
  searchPlaceholder: string;
  /** Slot between the search trigger and the end block (status, notifications, primary action). */
  actions?: ReactNode;
  /** Slot at the far end (e.g. the account menu). */
  end?: ReactNode;
  className?: string;
}

export function Topbar({
  breadcrumbs,
  breadcrumbsLabel,
  onOpenMenu,
  menuLabel,
  menuButtonRef,
  onSearch,
  searchLabel,
  searchPlaceholder,
  actions,
  end,
  className,
}: TopbarProps) {
  const [shortcut, setShortcut] = useState("Ctrl+K");

  useEffect(() => {
    setShortcut(isApplePlatform() ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      onSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch]);

  const current = breadcrumbs.at(-1);
  const previous = breadcrumbs.slice(0, -1);

  return (
    <header
      className={cn(
        "@container/topbar sticky top-0 z-30 h-top-height border-b-divider bg-bg",
        className,
      )}
    >
      <div className="flex h-full min-w-0 items-center gap-2.5 px-4 @min-[640px]/topbar:px-7">
        {onOpenMenu ? (
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuLabel}
            onClick={onOpenMenu}
            className="hidden size-8.5 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink @max-[900px]/app:inline-flex"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        ) : null}

        <nav
          aria-label={breadcrumbsLabel}
          className="flex min-w-0 shrink items-center gap-2 whitespace-nowrap text-ink-3 text-meta"
        >
          {previous.map((crumb) => (
            <span key={crumb} className="flex items-center gap-2 @max-[560px]/topbar:hidden">
              <span>{crumb}</span>
              <span aria-hidden="true" className="text-line-control">
                /
              </span>
            </span>
          ))}
          <strong aria-current="page" className="min-w-0 truncate font-semibold text-ink">
            {current}
          </strong>
        </nav>

        <button
          type="button"
          aria-label={searchLabel}
          onClick={onSearch}
          className="ml-auto flex h-8.5 w-[min(320px,38cqw)] shrink-0 items-center gap-2 rounded-input border-control bg-surface-control pr-2 pl-2.5 text-ink-3 text-meta @max-[700px]/topbar:w-8.5 @max-[700px]/topbar:justify-center @max-[700px]/topbar:px-0"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate @max-[700px]/topbar:hidden">{searchPlaceholder}</span>
          <span className="ml-auto rounded-xs border-divider bg-surface-2 px-1.25 py-0.5 font-mono text-count text-ink-2 @max-[700px]/topbar:hidden">
            {shortcut}
          </span>
        </button>

        {actions}
        {end}
      </div>
    </header>
  );
}
