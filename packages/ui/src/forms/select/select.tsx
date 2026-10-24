import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";

export type SelectSize = "sm" | "md";

export interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "size"> {
  /** `sm` is 30px and `md` (default) 38px, the heights of `Button` and `Input` of the same size. */
  size?: SelectSize;
}

const selectSizeClasses: Readonly<Record<SelectSize, string>> = {
  sm: "h-control-sm pl-2.5",
  md: "h-control-md pl-3",
};

/**
 * Wraps the native `<select>` (keeps the system picker on mobile) and draws
 * the chevron with an icon.
 */
export function Select({ size = "md", className, children, ...props }: SelectProps) {
  return (
    <span className="relative flex w-full items-center">
      <select
        className={cn(
          "w-full min-w-0 appearance-none rounded-input border-control bg-surface-control py-0 pr-7 text-control text-ink focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
          selectSizeClasses[size],
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
