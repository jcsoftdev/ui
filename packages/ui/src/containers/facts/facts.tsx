import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type FactsProps = ComponentPropsWithoutRef<"dl">;

/**
 * Three-column grid of key facts with a dashed top separator. Wrap each
 * `<dt>`/`<dd>` pair in its own `<div>` (one grid cell). Collapses to one
 * column when its own container is 560px wide or less.
 */
export function Facts({ className, ...props }: FactsProps) {
  return (
    <div className="@container/facts min-w-0">
      <dl
        className={cn(
          "mt-3.5 grid grid-cols-3 gap-3.5 border-t-divider border-dashed pt-3.5",
          "[&_dt]:font-semibold [&_dt]:text-fs-115 [&_dt]:text-ink-3",
          "[&_dd]:mt-0.5 [&_dd]:font-[620] [&_dd]:text-fs-130",
          "[&_dt]:break-words [&_dd]:break-words @max-[560px]/facts:grid-cols-1",
          className,
        )}
        {...props}
      />
    </div>
  );
}
