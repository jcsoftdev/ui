"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";

const MOBILE_QUERY = "(max-width: 900px)";

/**
 * Starts as `false` on both server and first client render so hydration matches;
 * the real value is applied in an effect.
 */
function useIsMobile(query: string): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}

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
  /** Drawer state at <=900px. Ignored on desktop, where the sidebar is always visible. */
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

const defaultRenderLink: SidebarRenderLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

/**
 * Main navigation. Always visible on desktop; an off-canvas drawer at <=900px,
 * `inert` while closed so it is not reachable by keyboard.
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
}: SidebarProps) {
  const isMobile = useIsMobile(MOBILE_QUERY);
  const closedOnMobile = isMobile && !open;
  const openOnMobile = isMobile && open;
  const asideRef = useRef<HTMLElement>(null);

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
          "fixed inset-y-0 left-0 z-45 flex h-screen w-side-width flex-col gap-4.5 overflow-y-auto border-line border-r bg-surface px-3 pt-3.5 pb-3 transition-transform duration-200 min-[901px]:sticky min-[901px]:top-0 min-[901px]:translate-x-0",
          closedOnMobile ? "-translate-x-full" : "translate-x-0",
          openOnMobile && "shadow-pop",
          className,
        )}
      >
        {header}
        {groups.map((group) => (
          <nav key={group.id} aria-label={group.label} className="flex flex-col gap-px">
            <div className="px-2.5 pb-1.5 text-overline text-ink-3">{group.label}</div>
            {group.items.map((item) => {
              const badgeTone =
                item.badgeTone === "danger"
                  ? "bg-danger-soft text-danger"
                  : "bg-surface-2 text-ink-2";
              return (
                <div key={item.id}>
                  {renderLink({
                    href: item.href,
                    "aria-current": item.active ? "page" : undefined,
                    className: cn(
                      "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-control text-ink-2 hover:bg-surface-2 hover:text-ink [&_svg]:size-4.25 [&_svg]:shrink-0",
                      item.active && "bg-accent-soft font-bold text-accent-ink",
                    ),
                    children: (
                      <>
                        {item.icon}
                        <span className="min-w-0 truncate">{item.label}</span>
                        {item.badge !== undefined ? (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-chip px-1.5 py-0.75 text-count",
                              badgeTone,
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
        {footer ? <div className="mt-auto">{footer}</div> : null}
      </aside>
      {openOnMobile ? (
        <div
          data-sidebar-scrim
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-44 bg-scrim"
        />
      ) : null}
    </>
  );
}
