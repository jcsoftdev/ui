import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type DescriptionListProps = ComponentPropsWithoutRef<"dl">;

/**
 * Two-column definition list (auto term / flexible value aligned right); stacks term over
 * value when its own container is narrower than 24rem.
 * Compose flat `<dt>`/`<dd>` pairs as children.
 */
export function DescriptionList({ className, ...props }: DescriptionListProps) {
  return (
    <div className="@container/dl min-w-0">
      <dl
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.25 text-fs-130",
          "[&_dt]:text-ink-3 [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:text-right [&_dd]:font-semibold",
          "@max-sm/dl:grid-cols-1 @max-sm/dl:gap-y-0.5 @max-sm/dl:[&_dd]:mb-2 @max-sm/dl:[&_dd]:text-left",
          className,
        )}
        {...props}
      />
    </div>
  );
}
