"use client";

import { type ReactNode, type Ref, useEffect, useState } from "react";
import { useGlassLens } from "../../glass/use-glass-lens.js";
import { Menu, Search } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass, materialStyle } from "../../utils/material.js";

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || "");
}

export type TopbarPart =
  | "root"
  | "inner"
  | "menuButton"
  | "breadcrumbs"
  | "crumb"
  | "separator"
  | "current"
  | "search"
  | "searchText"
  | "shortcut";

export interface TopbarProps {
  /** Breadcrumb trail in order; the last entry is the current view. Nothing renders when absent or empty. */
  breadcrumbs?: string[];
  /** Accessible name of the breadcrumb landmark. */
  breadcrumbsLabel?: string;
  /** Menu button (shown when the `AppShell` container is under 900 px, matching the Sidebar drawer) that opens the sidebar drawer. Needs an `@container/app` ancestor, which `AppShell` provides. Omitted when not set. */
  onOpenMenu?: () => void;
  menuLabel?: string;
  /** Ref to the menu button so the opener can restore focus when the drawer closes. */
  menuButtonRef?: Ref<HTMLButtonElement>;
  /** Called by the search trigger and by Cmd/Ctrl+K. The trigger and the shortcut are absent without it. */
  onSearch?: () => void;
  /** Accessible name of the search trigger; defaults to the placeholder. */
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Slot between the search trigger and the end block (status, notifications, primary action). */
  actions?: ReactNode;
  /** Slot at the far end (e.g. the account menu). */
  end?: ReactNode;
  className?: string;
  /**
   * Surface material. Omitted keeps the default for this layer (opaque, glass in the glass
   * preset); `"glass"` and `"glass-clear"` opt into Liquid Glass, `"solid"` forces opaque.
   */
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<TopbarPart>;
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
  material,
  className,
  classNames,
}: TopbarProps) {
  const [shortcut, setShortcut] = useState("Ctrl+K");
  const lens = useGlassLens<HTMLElement>();

  useEffect(() => {
    setShortcut(isApplePlatform() ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    if (!onSearch) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      onSearch?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch]);

  const trail = breadcrumbs ?? [];
  const current = trail.at(-1);
  const previous = trail.slice(0, -1);

  return (
    <header
      ref={lens}
      className={cn(
        "@container/topbar sticky top-0 z-30 h-top-height border-b-divider surface-nav",
        materialClass(material, "surface-solid [--surface-solid:var(--bg)]"),
        classNames?.root,
        className,
      )}
      style={materialStyle(material)}
    >
      <div
        className={cn(
          "flex h-full min-w-0 items-center gap-2.5 px-4 @min-[640px]/topbar:px-7",
          classNames?.inner,
        )}
      >
        {onOpenMenu ? (
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuLabel}
            onClick={onOpenMenu}
            className={cn(
              "hidden size-8.5 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink @max-[900px]/app:inline-flex",
              classNames?.menuButton,
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        ) : null}

        {trail.length > 0 ? (
          <nav
            aria-label={breadcrumbsLabel}
            className={cn(
              "flex min-w-0 shrink items-center gap-2 whitespace-nowrap text-ink-3 text-meta",
              classNames?.breadcrumbs,
            )}
          >
            {previous.map((crumb) => (
              <span
                key={crumb}
                className={cn(
                  "flex items-center gap-2 @max-[560px]/topbar:hidden",
                  classNames?.crumb,
                )}
              >
                <span>{crumb}</span>
                <span aria-hidden="true" className={cn("text-line-control", classNames?.separator)}>
                  /
                </span>
              </span>
            ))}
            <strong
              aria-current="page"
              className={cn("min-w-0 truncate font-semibold text-ink", classNames?.current)}
            >
              {current}
            </strong>
          </nav>
        ) : null}

        {onSearch ? (
          <button
            type="button"
            aria-label={searchLabel ?? searchPlaceholder}
            onClick={onSearch}
            className={cn(
              "ml-auto flex h-8.5 w-[min(320px,38cqw)] shrink-0 items-center gap-2 rounded-input border-control bg-surface-control pr-2 pl-2.5 text-ink-3 text-meta @max-[700px]/topbar:w-8.5 @max-[700px]/topbar:justify-center @max-[700px]/topbar:px-0",
              classNames?.search,
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className={cn("truncate @max-[700px]/topbar:hidden", classNames?.searchText)}>
              {searchPlaceholder}
            </span>
            <span
              className={cn(
                "ml-auto rounded-xs border-divider bg-surface-2 px-1.25 py-0.5 font-mono text-count text-ink-2 @max-[700px]/topbar:hidden",
                classNames?.shortcut,
              )}
            >
              {shortcut}
            </span>
          </button>
        ) : (
          <span aria-hidden="true" className="ml-auto" />
        )}

        {actions}
        {end}
      </div>
    </header>
  );
}
