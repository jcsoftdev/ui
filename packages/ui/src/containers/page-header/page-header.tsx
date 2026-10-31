import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface PageHeaderProps extends ComponentPropsWithoutRef<"header"> {
  /** Trail shown on its own row above the title, usually a `Breadcrumbs`. */
  breadcrumbs?: ReactNode;
  /** Tighter, centred header with a smaller title and a body-size lede. */
  compact?: boolean;
  /** Link to the parent screen on its own row above the title: a `PageHeaderBack`. Shown before `breadcrumbs`. */
  back?: ReactNode;
  /** Row under the title block for status chips and short facts. Wraps; never needs a container query. */
  meta?: ReactNode;
  /**
   * Sub-navigation under the title, full width: a `TabsNav` (route tabs) or a `Tabs` list. The
   * strip carries its own bottom divider, so it closes the header.
   */
  tabs?: ReactNode;
  /**
   * Keeps the whole header, tabs included, at the top of its scroll container with an opaque page
   * background. The navigation inside stays reachable while the page scrolls.
   */
  sticky?: boolean;
  /** Distance a sticky header keeps from the top of its scroll container (number = pixels). Default `0`. */
  stickyOffset?: number | string;
}

/**
 * Page header. No required parts: compose an eyebrow / title / lede block in
 * a plain `<div>` and, when the view has buttons, `PageHeaderActions` as the
 * second child. Actions wrap under the title when the container is too narrow. `back`,
 * `breadcrumbs`, `meta` and `tabs` each take a full-width row around the children.
 */
export function PageHeader({
  breadcrumbs,
  back,
  meta,
  tabs,
  sticky,
  stickyOffset,
  className,
  compact,
  style,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-compact={compact ? "" : undefined}
      data-sticky={sticky ? "" : undefined}
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5",
        compact && "flex-col items-center justify-center gap-y-2 text-center",
        sticky && "sticky top-(--page-header-top,0px) z-10 bg-surface",
        className,
      )}
      style={
        stickyOffset === undefined
          ? style
          : ({
              ...style,
              "--page-header-top":
                typeof stickyOffset === "number" ? `${stickyOffset}px` : stickyOffset,
            } as CSSProperties)
      }
      {...props}
    >
      {back ? <div className="basis-full">{back}</div> : null}
      {breadcrumbs ? <div className="basis-full">{breadcrumbs}</div> : null}
      {children}
      {meta ? (
        <div
          className={cn(
            "flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5 text-ink-2 text-meta",
            compact && "justify-center",
          )}
        >
          {meta}
        </div>
      ) : null}
      {tabs ? <div className="basis-full">{tabs}</div> : null}
    </header>
  );
}

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<"div">;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return (
    <div
      className={cn("mb-1 font-semibold text-fs-120 text-ink-3 in-data-compact:mb-0.5", className)}
      {...props}
    />
  );
}

export type PageHeaderTitleProps = ComponentPropsWithoutRef<"h1">;

/** Page title. Wrap a word in `<span className="text-accent-word">` to accent it. */
export function PageHeaderTitle({ className, ...props }: PageHeaderTitleProps) {
  return (
    <h1
      className={cn(
        "m-0 break-words text-page-title [text-wrap:balance] in-data-compact:text-fs-200",
        className,
      )}
      {...props}
    />
  );
}

export type PageHeaderLedeProps = ComponentPropsWithoutRef<"p">;

export function PageHeaderLede({ className, ...props }: PageHeaderLedeProps) {
  return (
    <p
      className={cn(
        "mt-1.25 max-w-[68ch] break-words text-lede text-ink-2 in-data-compact:mt-0.5 in-data-compact:text-body",
        className,
      )}
      {...props}
    />
  );
}

export type PageHeaderActionsProps = ComponentPropsWithoutRef<"div">;

export function PageHeaderActions({ className, ...props }: PageHeaderActionsProps) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}
