"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent font-bold hover:bg-accent-ink",
  secondary: "bg-surface text-ink shadow-flat hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger-soft/70",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-control-height-sm px-3 text-[12.5px] [&_svg]:size-3.5",
  md: "h-control-height px-4 text-[13px]",
};

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Render the child element (via Radix Slot) instead of a `<button>`, e.g. a link. */
  asChild?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  asChild,
  className,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...(asChild ? {} : { type: "button" })}
      aria-busy={loading ? "true" : undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-pill font-[650] no-underline disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
