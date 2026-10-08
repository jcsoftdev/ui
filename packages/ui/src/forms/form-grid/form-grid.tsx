import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type FormGridProps = ComponentPropsWithoutRef<"div">;

/** Two-column grid for pairs of fields; collapses to one column on small viewports. */
export function FormGrid({ className, ...props }: FormGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3.5 max-[620px]:grid-cols-[minmax(0,1fr)]",
        className,
      )}
      {...props}
    />
  );
}
