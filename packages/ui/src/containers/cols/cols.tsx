import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type ColsVariant = "rail" | "half" | "calc" | "thirds";

/**
 * Responsive column layouts. Breakpoints react to the nearest ancestor
 * container named `page` (`@container/page`), not to the viewport; without
 * such an ancestor the wide layouts always apply.
 *
 * `base`, `rail`, `half` and `calc` cut at 940 / 1080 / 1500 px. `thirds` uses the page
 * breakpoints of the layout containers, 720 / 1280 (`--container-page-m` and `-w` in
 * `theme.css`): three equal columns from 1280 px, two from 720 px (an odd last item spans
 * both) and one below.
 */
const variantClasses: Record<"base" | ColsVariant, string> = {
  base: cn(
    "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
    "@min-[1500px]/page:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
    "@max-[940px]/page:grid-cols-[minmax(0,1fr)]",
  ),
  rail: cn(
    "grid-cols-[minmax(0,1fr)_372px]",
    "@min-[1500px]/page:grid-cols-[minmax(0,1fr)_420px]",
    "@max-[1080px]/page:grid-cols-[minmax(0,1fr)]",
  ),
  half: cn("grid-cols-[repeat(2,minmax(0,1fr))]", "@max-[940px]/page:grid-cols-[minmax(0,1fr)]"),
  calc: cn(
    "grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]",
    "@min-[1500px]/page:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
    "@max-[940px]/page:grid-cols-[minmax(0,1fr)]",
  ),
  thirds: cn(
    "grid-cols-[repeat(3,minmax(0,1fr))]",
    "@max-[1279px]/page:grid-cols-[repeat(2,minmax(0,1fr))]",
    "@max-[1279px]/page:[&>:last-child:nth-child(odd)]:col-span-2",
    "@max-[719px]/page:grid-cols-[minmax(0,1fr)]",
    "@max-[719px]/page:[&>:last-child:nth-child(odd)]:col-span-1",
  ),
};

export interface ColsProps extends ComponentPropsWithoutRef<"div"> {
  /** Column proportions. Omit for the base main + side split. */
  variant?: ColsVariant;
}

export function Cols({ variant, className, ...props }: ColsProps) {
  return (
    <div
      className={cn("grid items-start gap-4", variantClasses[variant ?? "base"], className)}
      {...props}
    />
  );
}

export interface ColsStackProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * From 1500px of page width the stack becomes 2 columns and its first
   * child spans both rows.
   */
  wideSplit?: boolean;
}

export function ColsStack({ wideSplit, className, ...props }: ColsStackProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        wideSplit &&
          "@min-[1500px]/page:grid @min-[1500px]/page:grid-cols-[repeat(2,minmax(0,1fr))] @min-[1500px]/page:items-start @min-[1500px]/page:[&>*:first-child]:[grid-row:span_2]",
        className,
      )}
      {...props}
    />
  );
}
