import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type DescriptionListProps = ComponentPropsWithoutRef<"dl">;

/**
 * Two-column definition list (auto term / flexible value aligned right).
 * Compose flat `<dt>`/`<dd>` pairs as children.
 */
export function DescriptionList({ className, ...props }: DescriptionListProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[9px] text-[13px]",
        "[&_dt]:text-ink-3 [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:text-right [&_dd]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
