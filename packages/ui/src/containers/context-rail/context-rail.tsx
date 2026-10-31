"use client";

import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useContainerWidth } from "../../utils/use-container-width.js";

export type ContextRailPart = "root" | "grid" | "main" | "rail" | "summary" | "sheet";

/**
 * Container widths (px) under which the rail collapses; the set is closed so every query is a
 * literal class. `"never"` keeps the rail beside the work area at any width and `"always"`
 * collapses it at any width.
 */
export type ContextRailBreakpoint = 720 | 960 | 1280 | "never" | "always";

export interface ContextRailWidths {
  /** Rail width (px) from the collapse breakpoint up. */
  m?: number;
  /** From 1280 px of container width. */
  w?: number;
  /** From 1600 px of container width. */
  xw?: number;
}

export interface ContextRailProps {
  /** The work area. */
  children: ReactNode;
  /** Content of the rail. */
  rail: ReactNode;
  /** Rail width in px, or one width per breakpoint. Defaults to 360 / 400 / 440. */
  width?: number | ContextRailWidths;
  /** Distance (px) the sticky rail keeps from the top of the scroll container. Defaults to 0. */
  stickyTop?: number;
  /** Container width under which the rail collapses (`"never"` / `"always"` pin it). Defaults to 720. */
  breakpoint?: ContextRailBreakpoint;
  /**
   * Collapsed behaviour: `"stack"` puts the rail below the work area; `"sheet"` hides it behind a
   * `summary` bar that opens it as a bottom sheet.
   */
  collapse?: "stack" | "sheet";
  /** Compact bar shown while collapsed to a sheet (total plus the main action). It owns the button that opens the sheet. Inside an `AppShell` with a `bottomBar` it sits above that bar. */
  summary?: ReactNode;
  /** Label of the button that opens the sheet, and name of the sheet. */
  sheetLabel?: string;
  /** Accessible name of the rail region. */
  railLabel?: string;
  /** Controlled open state of the sheet. */
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ContextRailPart>;
}

const DEFAULT_WIDTHS: Required<ContextRailWidths> = { m: 360, w: 400, xw: 440 };

const collapseClasses: Record<
  ContextRailBreakpoint,
  { grid: string; rail: string; bar: string; hide: string }
> = {
  720: {
    grid: "@max-[719px]/rail:grid-cols-[minmax(0,1fr)]",
    rail: "@max-[719px]/rail:static @max-[719px]/rail:max-h-none",
    bar: "hidden @max-[719px]/rail:block",
    hide: "@max-[719px]/rail:hidden",
  },
  960: {
    grid: "@max-[959px]/rail:grid-cols-[minmax(0,1fr)]",
    rail: "@max-[959px]/rail:static @max-[959px]/rail:max-h-none",
    bar: "hidden @max-[959px]/rail:block",
    hide: "@max-[959px]/rail:hidden",
  },
  1280: {
    grid: "@max-[1279px]/rail:grid-cols-[minmax(0,1fr)]",
    rail: "@max-[1279px]/rail:static @max-[1279px]/rail:max-h-none",
    bar: "hidden @max-[1279px]/rail:block",
    hide: "@max-[1279px]/rail:hidden",
  },
  never: { grid: "", rail: "", bar: "hidden", hide: "" },
  always: {
    grid: "grid-cols-[minmax(0,1fr)]",
    rail: "static max-h-none",
    bar: "block",
    hide: "hidden",
  },
};

/** Whether the rail is collapsed for a measured container width (`null` before the first measurement). */
export function isRailCollapsed(breakpoint: ContextRailBreakpoint, width: number | null): boolean {
  if (breakpoint === "always") return true;
  if (breakpoint === "never") return false;
  return width !== null && width < breakpoint;
}

export function resolveRailWidths(width: number | ContextRailWidths | undefined) {
  if (typeof width === "number") return { m: width, w: width, xw: width };
  return { ...DEFAULT_WIDTHS, ...width };
}

/**
 * Work area with a persistent side rail (cart, payment, selected table). The rail sticks to the
 * top of the scroll container with its own scroll, and its width grows with the container.
 * Under `breakpoint` it stacks below the work area, or with `collapse="sheet"` it leaves the page
 * for a bottom sheet opened from the `summary` bar. `breakpoint="never"` keeps it beside the work
 * area at any width, `"always"` collapses it at any width. Widths and cuts follow the container
 * (`@container/rail`), not the viewport.
 */
export function ContextRail({
  children,
  rail,
  width,
  stickyTop = 0,
  breakpoint = 720,
  collapse = "stack",
  summary,
  sheetLabel,
  railLabel,
  sheetOpen: sheetOpenProp,
  onSheetOpenChange,
  className,
  classNames,
}: ContextRailProps) {
  const strings = useUiStrings();
  const rootRef = useRef<HTMLDivElement>(null);
  const measured = useContainerWidth(rootRef);
  const collapsed = isRailCollapsed(breakpoint, measured);
  const [openState, setOpenState] = useState(false);
  const controlled = sheetOpenProp !== undefined;
  const open = (controlled ? sheetOpenProp : openState) && collapsed;
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next);
    onSheetOpenChange?.(next);
  };

  const widths = resolveRailWidths(width);
  const classes = collapseClasses[breakpoint];
  const sheet = collapse === "sheet";
  const label = sheetLabel ?? railLabel;

  const style = {
    "--rail-m": `${widths.m}px`,
    "--rail-w": `${widths.w}px`,
    "--rail-xw": `${widths.xw}px`,
    "--rail-top": `${stickyTop}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      data-collapsed={collapsed ? "" : undefined}
      style={style}
      className={cn("@container/rail min-w-0", classNames?.root, className)}
    >
      <div
        className={cn(
          "grid items-start gap-4 [--rail:var(--rail-m)] @min-[1280px]/rail:[--rail:var(--rail-w)] @min-[1600px]/rail:[--rail:var(--rail-xw)]",
          breakpoint === "always" ? undefined : "grid-cols-[minmax(0,1fr)_var(--rail)]",
          classes.grid,
          classNames?.grid,
        )}
      >
        <div className={cn("min-w-0", classNames?.main)}>{children}</div>
        <aside
          aria-label={railLabel}
          className={cn(
            "sticky top-(--rail-top) min-w-0 max-h-[calc(100dvh-var(--rail-top))] overflow-y-auto overscroll-contain",
            classes.rail,
            sheet && classes.hide,
            classNames?.rail,
          )}
        >
          {sheet && collapsed ? null : rail}
        </aside>
      </div>
      {sheet && summary != null ? (
        <div
          className={cn(
            "sticky bottom-(--app-bottom-bar,0px) z-10 border-t-divider surface-card p-density",
            classes.bar,
            classNames?.summary,
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">{summary}</div>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-button px-3 py-2 font-semibold text-accent-ink text-body focus-visible:focus-ring"
            >
              {label ?? strings.actions}
            </button>
          </div>
        </div>
      ) : null}
      {sheet ? (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-70 bg-scrim" />
            <DialogPrimitive.Content
              className={cn(
                "fixed inset-x-0 bottom-0 z-70 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-card p-card outline-none surface-overlay shadow-overlay",
                classNames?.sheet,
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <DialogPrimitive.Title className="m-0 font-semibold text-card-title text-ink">
                  {label ?? strings.actions}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label={strings.close}
                  className="rounded-event p-1 text-ink-3 hover:text-ink focus-visible:focus-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </DialogPrimitive.Close>
              </div>
              {rail}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      ) : null}
    </div>
  );
}
