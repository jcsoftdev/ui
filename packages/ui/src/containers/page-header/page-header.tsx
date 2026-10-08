import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type PageHeaderProps = ComponentPropsWithoutRef<"header">;

/**
 * Page header. No required parts: compose an eyebrow / title / lede block in
 * a plain `<div>` and, when the view has buttons, `PageHeaderActions` as the
 * second child.
 */
export function PageHeader({ className, ...props }: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5", className)}
      {...props}
    />
  );
}

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<"div">;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return <div className={cn("mb-1 font-semibold text-[12px] text-ink-3", className)} {...props} />;
}

export type PageHeaderTitleProps = ComponentPropsWithoutRef<"h1">;

/** Page title. Wrap a word in `<span className="text-accent-word">` to accent it. */
export function PageHeaderTitle({ className, ...props }: PageHeaderTitleProps) {
  return <h1 className={cn("m-0 text-page-title [text-wrap:balance]", className)} {...props} />;
}

export type PageHeaderLedeProps = ComponentPropsWithoutRef<"p">;

export function PageHeaderLede({ className, ...props }: PageHeaderLedeProps) {
  return <p className={cn("mt-[5px] max-w-[68ch] text-lede text-ink-2", className)} {...props} />;
}

export type PageHeaderActionsProps = ComponentPropsWithoutRef<"div">;

export function PageHeaderActions({ className, ...props }: PageHeaderActionsProps) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}
