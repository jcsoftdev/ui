import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type StackDirection = "column" | "row";
export type StackGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";

export const stackGapClasses: Record<StackGap, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const alignClasses: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

export interface StackProps extends ComponentPropsWithoutRef<"div"> {
  /** `column` stacks children vertically, `row` lays them out inline and wraps. Defaults to `column`. */
  direction?: StackDirection;
  /** Space between children. Defaults to `md`. */
  gap?: StackGap;
  /** Cross-axis alignment. Defaults to `stretch` for a column and `center` for a row. */
  align?: StackAlign;
}

/** One-axis flex layout with token gaps. A row wraps instead of overflowing. */
export function Stack({
  direction = "column",
  gap = "md",
  align,
  className,
  ...props
}: StackProps) {
  const row = direction === "row";
  return (
    <div
      className={cn(
        "flex min-w-0",
        row ? "flex-row flex-wrap" : "flex-col",
        alignClasses[align ?? (row ? "center" : "stretch")],
        stackGapClasses[gap],
        className,
      )}
      {...props}
    />
  );
}
