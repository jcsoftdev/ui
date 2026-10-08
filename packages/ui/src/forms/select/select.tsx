import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface SelectProps extends ComponentPropsWithoutRef<"select"> {}

/**
 * Wraps the native `<select>` (keeps the system picker on mobile) and draws
 * the chevron with an icon.
 */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <span className="relative flex w-full items-center">
      <select
        className={cn(
          "h-input w-full min-w-0 appearance-none rounded-input border-control bg-surface-control py-0 pr-7 pl-3 text-control text-ink focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 size-3.5 text-ink-3"
      />
    </span>
  );
}
