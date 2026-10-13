import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "../../utils/cn.js";
import { type StackGap, stackGapClasses } from "../stack/stack.js";

export interface GridProps extends ComponentPropsWithoutRef<"div"> {
  /** Fixed number of equal columns. Without it the grid fits as many columns as `minColumnWidth` allows. */
  columns?: number;
  /** Narrowest a column may get before the grid drops one (any CSS length). Defaults to `16rem`. */
  minColumnWidth?: string;
  /** Space between cells. Defaults to `md`. */
  gap?: StackGap;
}

/**
 * Equal-width grid. With `columns` the count is fixed; otherwise it is intrinsic (`auto-fill`
 * from `minColumnWidth`), so it reflows by the space it gets without breakpoints.
 */
export function Grid({
  columns,
  minColumnWidth = "16rem",
  gap = "md",
  className,
  style,
  ...props
}: GridProps) {
  const template =
    columns === undefined
      ? `repeat(auto-fill, minmax(min(100%, ${minColumnWidth}), 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;
  return (
    <div
      className={cn("grid min-w-0", stackGapClasses[gap], className)}
      style={{ gridTemplateColumns: template, ...style } as CSSProperties}
      {...props}
    />
  );
}
