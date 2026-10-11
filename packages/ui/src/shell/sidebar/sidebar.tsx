"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useAppShell, useCompactContainer } from "../app-shell/app-shell.js";

export interface SidebarLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  "aria-current"?: "page";
}

/** Renders a navigation link; inject your router's link component here. */
export type SidebarRenderLink = (props: SidebarLinkProps) => ReactNode;

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  /** Short badge content (a count, a status node...). */
  badge?: ReactNode;
  badgeTone?: "default" | "danger";
  /** Screen-reader-only context announced after the badge. */
  badgeLabel?: string;
}

export interface SidebarGroup {
  id: string;
  label: string;
  items: SidebarItem[];
}

export type SidebarPart =
  | "root"
  | "group"
  | "groupLabel"
  | "item"
  | "link"
  | "label"
  | "badge"
  | "footer"
  | "scrim";

export interface SidebarProps {
  groups: SidebarGroup[];
  /** Accessible name of the sidebar landmark. */
  ariaLabel: string;
  /** Brand block shown at the top. */
  header?: ReactNode;
  /** Block pinned to the bottom (e.g. the current user). */
  footer?: ReactNode;
  /** Link renderer; defaults to a plain anchor. */
  renderLink?: SidebarRenderLink;
  /** Drawer state when the app container is under 900 px. Ignored above it, where the sidebar is always visible. */
  open?: boolean;
  onClose?: () => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SidebarPart>;
}

const defaultRenderLink: SidebarRenderLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

/**
 * Main navigation. Always visible when its app container is wide; an off-canvas drawer under
 * 900 px of container width, `inert` while closed so it is not reachable by keyboard.
 * Render it inside `AppShell`: the container decides, never the viewport. Without an `AppShell`
 * it measures its parent element instead.
 */
export function Sidebar({
  groups,
  ariaLabel,
  header,
  footer,
  renderLink = defaultRenderLink,
  open = false,
  onClose,
  className,
  classNames,
}: SidebarProps) {
  const shell = useAppShell();
  const asideRef = useRef<HTMLElement>(null);
  const parentCompact = useCompactContainer(asideRef, (aside) => aside.parentElement, !shell);
  const isMobile = shell ? shell.compact : parentCompact;
  const closedOnMobile = isMobile && !open;
  const openOnMobile = isMobile && open;

  useEffect(() => {
    if (!openOnMobile) return;
    asideRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
  }, [openOnMobile]);

  useEffect(() => {
    if (!openOnMobile || !onClose) return;
    const close = onClose;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openOnMobile, onClose]);

  return (
    <>
      <aside
        ref={asideRef}
        aria-label={ariaLabel}
        inert={closedOnMobile || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-45 flex h-screen w-side-width flex-col gap-4.5 overflow-y-auto border-r-divider bg-surface px-3 pt-3.5 pb-3 transition-transform duration-200",
          // Inside AppShell the container query decides before any script runs (no flash on a
          // narrow first paint); the measured state only drives inert, the scrim and focus.
          shell
            ? cn(
                open ? "translate-x-0" : "-translate-x-full",
                "@min-[900px]/app:sticky @min-[900px]/app:top-0 @min-[900px]/app:translate-x-0",
              )
            : cn(
                isMobile ? "fixed" : "sticky top-0",
                closedOnMobile ? "-translate-x-full" : "translate-x-0",
              ),
          openOnMobile && "shadow-overlay",
          classNames?.root,
          className,
        )}
      >
        {header}
        {groups.map((group) => (
          <nav
            key={group.id}
            aria-label={group.label}
            className={cn("flex flex-col gap-px", classNames?.group)}
          >
            <div className={cn("px-2.5 pb-1.5 text-overline text-ink-3", classNames?.groupLabel)}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const badgeTone =
                item.badgeTone === "danger"
                  ? "bg-danger-soft text-danger"
                  : "bg-surface-2 text-ink-2";
              return (
                <div key={item.id} className={classNames?.item}>
                  {renderLink({
                    href: item.href,
                    "aria-current": item.active ? "page" : undefined,
                    className: cn(
                      "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-control text-ink-2 hover:bg-surface-2 hover:text-ink [&_svg]:size-4.25 [&_svg]:shrink-0",
                      item.active && "bg-accent-soft font-bold text-accent-ink",
                      classNames?.link,
                    ),
                    children: (
                      <>
                        {item.icon}
                        <span className={cn("min-w-0 truncate", classNames?.label)}>
                          {item.label}
                        </span>
                        {item.badge !== undefined ? (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-chip px-1.5 py-0.75 text-count",
                              badgeTone,
                              classNames?.badge,
                            )}
                          >
                            {item.badge}
                            {item.badgeLabel ? (
                              <span className="sr-only"> {item.badgeLabel}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </>
                    ),
                  })}
                </div>
              );
            })}
          </nav>
        ))}
        {footer ? <div className={cn("mt-auto", classNames?.footer)}>{footer}</div> : null}
      </aside>
      {openOnMobile ? (
        <div
          data-sidebar-scrim
          aria-hidden="true"
          onClick={onClose}
          className={cn("fixed inset-0 z-44 bg-scrim", classNames?.scrim)}
        />
      ) : null}
    </>
  );
}
