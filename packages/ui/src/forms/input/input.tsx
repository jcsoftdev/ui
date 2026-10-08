import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface InputProps extends ComponentPropsWithoutRef<"input"> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-input-height w-full min-w-0 rounded-control border border-line-control bg-surface px-3 text-control text-ink placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
