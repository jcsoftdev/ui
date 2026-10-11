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
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent font-bold hover:bg-accent-ink",
  secondary: "bg-surface-control text-ink shadow-control hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger-soft/70",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-control-sm px-3 text-[12.5px] [&_svg]:size-3.5",
  md: "h-control px-control-x text-[13px]",
  lg: "h-control-lg px-control-x text-[14px]",
};

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Replaces the children while `loading` and is announced to screen readers. */
  loadingLabel?: string;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Render the child element (via Radix Slot) instead of a `<button>`, e.g. a link. */
  asChild?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  loadingLabel,
  block,
  disabled,
  asChild,
  className,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Text runs get their own truncating span so a long label ends in "…" inside a narrow
  // container instead of overflowing; icons keep their size. Slot needs its single child as is.
  const showLoadingLabel = loading && loadingLabel !== undefined && !asChild;
  const content = showLoadingLabel
    ? labelRun(loadingLabel)
    : asChild
      ? children
      : Children.map(children, labelRun);
  const button = (
    <Comp
      {...(asChild ? {} : { type: "button" })}
      aria-busy={loading ? "true" : undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-button pressable focus-visible:focus-ring font-[650] no-underline disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0",
        variantClasses[variant],
        sizeClasses[size],
        block && "flex w-full",
        className,
      )}
      {...props}
    >
      {content}
    </Comp>
  );
  if (loadingLabel === undefined) return button;
  return (
    <>
      {button}
      <span role="status" className="sr-only">
        {loading ? loadingLabel : null}
      </span>
    </>
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
