"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";
import { ChevronDown } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { useAppShell, useCompactContainer } from "../app-shell/app-shell.js";

export interface SidebarLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  "aria-current"?: "page";
  /** Set in rail mode, where the label is visually hidden. */
  title?: string;
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
  /**
   * Turns the group label into a button that shows or hides the items (`aria-expanded`). Ignored
   * in rail mode, where every item stays visible.
   */
  collapsible?: boolean;
  /**
   * Starts collapsed when `collapsible`. A group that contains the active item starts open
   * regardless, and an uncontrolled group opens when one of its items becomes active later, so
   * the current page is never hidden.
   */
  defaultCollapsed?: boolean;
  /** Controlled collapsed state of a `collapsible` group. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export type SidebarPart =
  | "root"
  | "group"
  | "groupLabel"
  | "groupToggle"
  | "groupItems"
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
  /** Icons-only rail with the labels as tooltips. Ignored while the sidebar is a drawer. */
  collapsed?: boolean;
  className?: string;
  /** Inline style of the root (for example `liquidStyle()` options). */
  style?: CSSProperties;
  /**
   * Surface material. Omitted keeps the default for this layer (opaque, glass in the glass
   * preset); `"glass"` and `"glass-clear"` are frosted glass, `"liquid"` and `"liquid-clear"`
   * Liquid Glass, `"solid"` forces opaque. Liquid options go in `style` (`liquidStyle()` from
   * `@jcsoftdev/ui/liquid`); the lens needs `<LiquidGlass />` mounted once.
   */
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SidebarPart>;
}

const defaultRenderLink: SidebarRenderLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

interface SidebarGroupSectionProps {
  group: SidebarGroup;
  rail: boolean;
  renderLink: SidebarRenderLink;
  classNames: ClassNames<SidebarPart> | undefined;
}

/** Whether an uncontrolled group must open: one of its items just became the active page. */
export function opensOnActivation(
  wasActive: boolean,
  isActive: boolean,
  controlled: boolean,
): boolean {
  return isActive && !wasActive && !controlled;
}

function SidebarGroupSection({ group, rail, renderLink, classNames }: SidebarGroupSectionProps) {
  const itemsId = useId();
  const collapsible = group.collapsible === true && !rail;
  const holdsActive = group.items.some((item) => item.active);
  const [collapsedState, setCollapsed] = useControllableState<boolean>({
    prop: group.collapsed,
    defaultProp: (group.defaultCollapsed ?? false) && !holdsActive,
    onChange: group.onCollapsedChange,
  });
  const collapsed = collapsible && collapsedState;
  const wasActive = useRef(holdsActive);
  const uncontrolled = group.collapsed === undefined;
  useEffect(() => {
    if (opensOnActivation(wasActive.current, holdsActive, !uncontrolled)) setCollapsed(false);
    wasActive.current = holdsActive;
  }, [holdsActive, uncontrolled, setCollapsed]);
  return (
    <nav aria-label={group.label} className={cn("flex flex-col gap-px", classNames?.group)}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={itemsId}
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center gap-1 rounded-control px-2.5 pb-1.5 text-left text-overline text-ink-3 hover:text-ink focus-visible:focus-ring",
            classNames?.groupLabel,
            classNames?.groupToggle,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}
          />
        </button>
      ) : (
        <div
          className={cn(
            "px-2.5 pb-1.5 text-overline text-ink-3",
            rail && "sr-only",
            classNames?.groupLabel,
          )}
        >
          {group.label}
        </div>
      )}
      <div
        id={itemsId}
        hidden={collapsed}
        className={cn("flex flex-col gap-px", classNames?.groupItems)}
      >
        {group.items.map((item) => {
          const badgeTone =
            item.badgeTone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2";
          return (
            <div key={item.id} className={classNames?.item}>
              {renderLink({
                href: item.href,
                "aria-current": item.active ? "page" : undefined,
                title: rail ? item.label : undefined,
                className: cn(
                  "flex min-h-(--touch-target) items-center gap-2.5 rounded-control px-2.5 py-2 text-control text-ink-2 hover:bg-surface-2 hover:text-ink [&_svg]:size-4.25 [&_svg]:shrink-0",
                  rail && "relative justify-center",
                  item.active && "bg-accent-soft font-bold text-accent-ink",
                  classNames?.link,
                ),
                children: (
                  <>
                    {item.icon}
                    <span className={cn("min-w-0 truncate", rail && "sr-only", classNames?.label)}>
                      {item.label}
                    </span>
                    {item.badge !== undefined && rail ? (
                      <>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-1 right-1 size-2 rounded-full ring-2 ring-surface",
                            item.badgeTone === "danger" ? "bg-danger" : "bg-accent",
                            classNames?.badge,
                          )}
                        />
                        <span className="sr-only">
                          {item.badge}
                          {item.badgeLabel ? ` ${item.badgeLabel}` : null}
                        </span>
                      </>
                    ) : item.badge !== undefined ? (
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
      </div>
    </nav>
  );
}

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
  collapsed = false,
  material,
  className,
  style,
  classNames,
}: SidebarProps) {
  const shell = useAppShell();
  const asideRef = useRef<HTMLElement>(null);
  const parentCompact = useCompactContainer(asideRef, (aside) => aside.parentElement, !shell);
  const isMobile = shell ? shell.compact : parentCompact;
  const closedOnMobile = isMobile && !open;
  const openOnMobile = isMobile && open;
  const rail = collapsed && !isMobile;

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
          "fixed inset-y-0 left-0 z-45 flex h-screen flex-col gap-4.5 overflow-y-auto border-r-divider surface-side pt-3.5 pb-3 transition-transform duration-200",
          rail ? "w-[4.5rem] px-2" : "w-side-width px-3",
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
          materialClass(material, "surface-solid [--surface-solid:var(--surface)]"),
          classNames?.root,
          className,
        )}
        style={style}
      >
        {header}
        {groups.map((group) => (
          <SidebarGroupSection
            key={group.id}
            group={group}
            rail={rail}
            renderLink={renderLink}
            classNames={classNames}
          />
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
