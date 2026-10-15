import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type InputSize = "md" | "lg";

export const inputSizeClasses: Readonly<Record<InputSize, string>> = {
  md: "h-input px-3",
  lg: "h-control-lg px-4 text-fs-140",
};

export interface InputProps extends Omit<ComponentPropsWithoutRef<"input">, "size"> {
  /** `lg` is the thumb-friendly height of the large `Button`. */
  size?: InputSize;
}

export function Input({ size = "md", className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full min-w-0 rounded-input border-control bg-surface-control text-control text-ink placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
        inputSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
