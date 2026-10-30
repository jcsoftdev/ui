"use client";

import { type ComponentPropsWithoutRef, createContext, use } from "react";
import { cn } from "../../utils/cn.js";

/** Container widths (px) under which the layout stacks. The set is closed so every query is a literal class. */
export type SettingsLayoutBreakpoint = 720 | 940 | 1080 | 1280;

export type SettingsLayoutContainer = "page" | "self";

interface SettingsLayoutConfig {
  breakpoint: SettingsLayoutBreakpoint | "never";
  container: SettingsLayoutContainer;
}

const SettingsLayoutContext = createContext<SettingsLayoutConfig>({
  breakpoint: 940,
  container: "page",
});

const stackClasses: Record<
  SettingsLayoutContainer,
  Record<SettingsLayoutBreakpoint, { grid: string; nav: string }>
> = {
  page: {
    720: {
      grid: "@max-[720px]/page:grid-cols-1",
      nav: "@max-[720px]/page:static @max-[720px]/page:flex-row @max-[720px]/page:overflow-x-auto",
    },
    940: {
      grid: "@max-[940px]/page:grid-cols-1",
      nav: "@max-[940px]/page:static @max-[940px]/page:flex-row @max-[940px]/page:overflow-x-auto",
    },
    1080: {
      grid: "@max-[1080px]/page:grid-cols-1",
      nav: "@max-[1080px]/page:static @max-[1080px]/page:flex-row @max-[1080px]/page:overflow-x-auto",
    },
    1280: {
      grid: "@max-[1280px]/page:grid-cols-1",
      nav: "@max-[1280px]/page:static @max-[1280px]/page:flex-row @max-[1280px]/page:overflow-x-auto",
    },
  },
  self: {
    720: {
      grid: "@max-[720px]/settings:grid-cols-1",
      nav: "@max-[720px]/settings:static @max-[720px]/settings:flex-row @max-[720px]/settings:overflow-x-auto",
    },
    940: {
      grid: "@max-[940px]/settings:grid-cols-1",
      nav: "@max-[940px]/settings:static @max-[940px]/settings:flex-row @max-[940px]/settings:overflow-x-auto",
    },
    1080: {
      grid: "@max-[1080px]/settings:grid-cols-1",
      nav: "@max-[1080px]/settings:static @max-[1080px]/settings:flex-row @max-[1080px]/settings:overflow-x-auto",
    },
    1280: {
      grid: "@max-[1280px]/settings:grid-cols-1",
      nav: "@max-[1280px]/settings:static @max-[1280px]/settings:flex-row @max-[1280px]/settings:overflow-x-auto",
    },
  },
};

function stackFor(config: SettingsLayoutConfig, part: "grid" | "nav") {
  return config.breakpoint === "never"
    ? undefined
    : stackClasses[config.container][config.breakpoint][part];
}

export interface SettingsLayoutProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Container width (px) under which the nav and the content stack. `"never"` keeps two columns.
   * Defaults to 940. `SettingsLayoutNav` follows it without being told.
   */
  breakpoint?: SettingsLayoutBreakpoint | "never";
  /**
   * Which container is measured. `"page"` (default) is the ancestor `@container/page`;
   * `"self"` wraps the layout in its own container, for use outside a page shell.
   */
  container?: SettingsLayoutContainer;
}

/**
 * Two-column settings grid (side nav + content). Stacks to one column under `breakpoint`
 * (940 px by default) of the measured container, never of the viewport.
 */
export function SettingsLayout({
  breakpoint = 940,
  container = "page",
  className,
  ...props
}: SettingsLayoutProps) {
  const config = { breakpoint, container };
  const grid = (
    <div
      className={cn(
        "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6",
        stackFor(config, "grid"),
        className,
      )}
      {...props}
    />
  );
  return (
    <SettingsLayoutContext value={config}>
      {container === "self" ? <div className="@container/settings min-w-0">{grid}</div> : grid}
    </SettingsLayoutContext>
  );
}

export interface SettingsLayoutNavProps extends ComponentPropsWithoutRef<"nav"> {
  /** Overrides the breakpoint the surrounding `SettingsLayout` set. */
  breakpoint?: SettingsLayoutBreakpoint | "never";
}

/** Sticky side nav that becomes a scrollable horizontal row on narrow pages. */
export function SettingsLayoutNav({
  "aria-label": ariaLabel = "Sections",
  breakpoint,
  className,
  ...props
}: SettingsLayoutNavProps) {
  const inherited = use(SettingsLayoutContext);
  const config = { ...inherited, breakpoint: breakpoint ?? inherited.breakpoint };
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("sticky top-20 flex flex-col gap-px", stackFor(config, "nav"), className)}
      {...props}
    />
  );
}

export interface SettingsLayoutNavItemProps extends ComponentPropsWithoutRef<"button"> {
  /** Currently visible section. */
  active?: boolean;
}

export function SettingsLayoutNavItem({
  active,
  className,
  type = "button",
  ...props
}: SettingsLayoutNavItemProps) {
  return (
    <button
      type={type}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex min-h-(--touch-target) shrink-0 items-center gap-2.5 rounded-control px-2.5 py-1.75 font-medium text-fs-130 text-ink-2 hover:bg-surface-2 hover:text-ink",
        active && "bg-accent-soft font-semibold text-accent-ink",
        className,
      )}
      {...props}
    />
  );
}

export type SettingsLayoutMainProps = ComponentPropsWithoutRef<"div">;

/**
 * Content column: a single stack that becomes a 2-column masonry at 1180px of
 * page width, where each direct child (a card) is not split across columns.
 */
export function SettingsLayoutMain({ className, ...props }: SettingsLayoutMainProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        "@min-[1180px]/page:block @min-[1180px]/page:[columns:2_460px] @min-[1180px]/page:[column-gap:16px]",
        "@min-[1180px]/page:[&>*]:mb-4 @min-[1180px]/page:[&>*]:[break-inside:avoid]",
        className,
      )}
      {...props}
    />
  );
}
