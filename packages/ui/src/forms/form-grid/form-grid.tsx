import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type FormGridProps = ComponentPropsWithoutRef<"div">;

/**
 * Grid for pairs of fields. One column in a narrow container, two columns from 620px of
 * container width (the wrapper is the size container; the grid keeps `className` and props).
 */
export function FormGrid({ className, ...props }: FormGridProps) {
  return (
    <div className="@container/form-grid min-w-0">
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-3.5 @min-[620px]/form-grid:grid-cols-[repeat(2,minmax(0,1fr))]",
          className,
        )}
        {...props}
      />
    </div>
  );
}
