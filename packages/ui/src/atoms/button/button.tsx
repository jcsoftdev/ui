"use client";

import { Slot } from "@radix-ui/react-slot";
import {
  Children,
  type ComponentPropsWithoutRef,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react";
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
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Text runs get their own truncating span so a long label ends in "…" inside a narrow
  // container instead of overflowing; icons keep their size. Slot needs its single child as is.
  const content = asChild ? children : Children.map(children, labelRun);
  return (
    <Comp
      {...(asChild ? {} : { type: "button" })}
      aria-busy={loading ? "true" : undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-pill font-[650] no-underline disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {content}
    </Comp>
  );
}

function labelRun(child: ReactNode): ReactNode {
  if (typeof child === "string" || typeof child === "number") {
    return <span className="min-w-0 truncate">{child}</span>;
  }
  if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
    return Children.map(child.props.children, labelRun);
  }
  return child;
}
