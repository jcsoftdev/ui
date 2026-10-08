import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-21 w-full min-w-0 resize-y rounded-input border-control bg-surface-control px-3 py-2 text-control text-ink leading-normal placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
