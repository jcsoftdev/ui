"use client";

import { type ReactNode, useState } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { Menu } from "../../icons/index.js";
import { Drawer, DrawerContent, DrawerTitle } from "../../overlays/drawer/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import type { SidebarItem, SidebarLinkProps } from "../sidebar/index.js";
import { BOTTOM_NAV_MAX_SLOTS, splitBottomNavItems } from "./split.js";

export interface BottomNavLinkProps extends SidebarLinkProps {
  /** Closes the "More" drawer after a navigation; pass it through to the rendered element. */
  onClick?: () => void;
}

/** Renders a bottom-nav link; inject your router's link component here. */
export type BottomNavRenderLink = (props: BottomNavLinkProps) => ReactNode;

export type BottomNavPart =
  | "root"
  | "list"
  | "item"
  | "badge"
  | "moreButton"
  | "moreContent"
  | "moreLink"
  | "moreFooter";

export interface BottomNavProps {
  /** Same items as `Sidebar` (`groups.flatMap((group) => group.items)`). Order decides what overflows. */
  items: readonly SidebarItem[];
  /** Accessible name of the bar landmark. */
  ariaLabel: string;
  /** Slots in the bar including "More". Defaults to 5; with fewer items than slots there is no "More". */
  maxSlots?: number;
  /** Text of the "More" button and the drawer title. Defaults to the localized "More". */
  moreLabel?: string;
  /** Pinned at the bottom of the "More" drawer, e.g. the account or a sign-out button. */
  moreFooter?: ReactNode;
  /** Link renderer; defaults to a plain anchor. */
  renderLink?: BottomNavRenderLink;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<BottomNavPart>;
}

const defaultRenderLink: BottomNavRenderLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const slotClasses =
  "relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-ink-2 text-meta focus-visible:focus-ring aria-[current=page]:font-bold aria-[current=page]:text-accent-ink data-[active=true]:font-bold data-[active=true]:text-accent-ink [&_svg]:size-5 [&_svg]:shrink-0";

/**
 * Phone navigation bar for `Sidebar`'s items. The first items fill the bar and the rest move
 * behind a "More" button that opens a drawer. Place it as the last child of the page column
 * inside `AppShell`: it sticks to the bottom of the viewport and hides itself once the shell is
 * 900 px or wider, where the sidebar takes over. Without an `AppShell` it is always visible.
 */
export function BottomNav({
  items,
  ariaLabel,
  maxSlots = BOTTOM_NAV_MAX_SLOTS,
  moreLabel,
  moreFooter,
  renderLink = defaultRenderLink,
  className,
  classNames,
}: BottomNavProps) {
  const strings = useUiStrings();
  const [moreOpen, setMoreOpen] = useState(false);
  const { visible, overflow } = splitBottomNavItems(items, maxSlots);
  const more = moreLabel ?? strings.more;
  const moreActive = overflow.some((item) => item.active);

  return (
    <>
      <nav
        aria-label={ariaLabel}
        className={cn(
          "sticky bottom-0 z-40 border-t-divider bg-surface pb-[env(safe-area-inset-bottom)] @min-[900px]/app:hidden",
          classNames?.root,
          className,
        )}
      >
        <ul
          className={cn(
            "m-0 grid list-none auto-cols-[minmax(min-content,1fr)] grid-flow-col p-0",
            classNames?.list,
          )}
        >
          {visible.map((item) => (
            <li key={item.id} className={classNames?.item}>
              {renderLink({
                href: item.href,
                "aria-current": item.active ? "page" : undefined,
                className: slotClasses,
                children: (
                  <>
                    <span className="relative">
                      {item.icon}
                      {item.badge !== undefined ? (
                        <>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute -top-0.5 -right-1 size-2 rounded-pill",
                              item.badgeTone === "danger" ? "bg-danger" : "bg-warning",
                              classNames?.badge,
                            )}
                          />
                          <span className="sr-only">{item.badgeLabel ?? item.badge}</span>
                        </>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </>
                ),
              })}
            </li>
          ))}
          {overflow.length > 0 ? (
            <li className={classNames?.item}>
              <button
                type="button"
                data-active={moreActive}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                className={cn(slotClasses, classNames?.moreButton)}
              >
                <Menu aria-hidden="true" />
                <span>{more}</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {overflow.length > 0 ? (
        <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
          <DrawerContent
            aria-describedby={undefined}
            className={cn("gap-4 p-4", classNames?.moreContent)}
          >
            <DrawerTitle className="font-semibold text-lede">{more}</DrawerTitle>
            <nav aria-label={more} className="flex flex-col gap-px">
              {overflow.map((item) => (
                <div key={item.id}>
                  {renderLink({
                    href: item.href,
                    "aria-current": item.active ? "page" : undefined,
                    onClick: () => setMoreOpen(false),
                    className: cn(
                      "flex min-h-11 items-center gap-2.5 rounded-control px-2.5 py-2 text-control text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:focus-ring aria-[current=page]:bg-accent-soft aria-[current=page]:font-bold aria-[current=page]:text-accent-ink [&_svg]:size-4.25 [&_svg]:shrink-0",
                      classNames?.moreLink,
                    ),
                    children: (
                      <>
                        {item.icon}
                        <span className="min-w-0 truncate">{item.label}</span>
                        {item.badge !== undefined ? (
                          <span className="ml-auto shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.75 text-count text-ink-2">
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
              ))}
            </nav>
            {moreFooter ? (
              <div className={cn("mt-auto border-t-divider pt-3", classNames?.moreFooter)}>
                {moreFooter}
              </div>
            ) : null}
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  );
}
