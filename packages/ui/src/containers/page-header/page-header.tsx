import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface PageHeaderProps extends ComponentPropsWithoutRef<"header"> {
  /** Tighter, centred header with a smaller title and a body-size lede. */
  compact?: boolean;
}

/**
 * Page header. No required parts: compose an eyebrow / title / lede block in
 * a plain `<div>` and, when the view has buttons, `PageHeaderActions` as the
 * second child. Actions wrap under the title when the container is too narrow.
 */
export function PageHeader({ className, compact, ...props }: PageHeaderProps) {
  return (
    <header
      data-compact={compact ? "" : undefined}
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5",
        compact && "flex-col items-center justify-center gap-y-2 text-center",
        className,
      )}
      {...props}
    />
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
        "m-0 break-words text-page-title [text-wrap:balance] in-data-compact:text-fs-220",
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
