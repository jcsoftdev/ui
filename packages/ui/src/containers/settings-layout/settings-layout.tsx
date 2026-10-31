import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type SettingsLayoutProps = ComponentPropsWithoutRef<"div">;

/**
 * Two-column settings grid (side nav + content). Collapses to one column at
 * 940px or less of the ancestor `@container/page`.
 */
export function SettingsLayout({ className, ...props }: SettingsLayoutProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 @max-[940px]/page:grid-cols-1",
        className,
      )}
      {...props}
    />
  );
}

export type SettingsLayoutNavProps = ComponentPropsWithoutRef<"nav">;

/** Sticky side nav that becomes a scrollable horizontal row on narrow pages. */
export function SettingsLayoutNav({
  "aria-label": ariaLabel = "Sections",
  className,
  ...props
}: SettingsLayoutNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-20 flex flex-col gap-px @max-[940px]/page:static @max-[940px]/page:flex-row @max-[940px]/page:overflow-x-auto",
        className,
      )}
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
