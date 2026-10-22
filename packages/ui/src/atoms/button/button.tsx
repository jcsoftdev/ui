"use client";

import {
  Children,
  type ComponentPropsWithRef,
  Fragment,
  isValidElement,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";
import { Slot } from "../../utils/slot.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Class map behind each `variant`. Exported so apps can read, extend or reuse it, e.g.
 * `cn(buttonVariantClasses.primary, "bg-brand")` on a link, or `{ ...buttonVariantClasses, brand: "..." }`.
 */
export const buttonVariantClasses: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-on-accent font-bold hover:bg-accent-ink",
  secondary: "bg-surface-control text-ink shadow-control hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger-soft/70",
};

/** Class map behind each `size`; exported like {@link buttonVariantClasses}. */
export const buttonSizeClasses: Readonly<Record<ButtonSize, string>> = {
  sm: "h-control-sm px-3 text-fs-125 [&_svg]:size-3.5",
  md: "h-control px-control-x text-fs-130",
  lg: "h-control-lg px-control-x text-fs-140",
};

const baseClasses =
  "inline-flex min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-button pressable focus-visible:focus-ring font-[650] no-underline disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-progress aria-busy:scale-none! [&_svg]:shrink-0";

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/**
 * The exact classes `<Button>` renders, merged with `cn` so `className` wins. Use it to give any
 * element (a router link, a menu item) the kit's button look without wrapping it in `<Button>`.
 */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  block,
  className,
}: ButtonClassOptions = {}): string {
  return cn(
    baseClasses,
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    block && "flex w-full",
    className,
  );
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Busy state: the button keeps its focus and its full colour, ignores clicks (a submit button no
   * longer submits, including the implicit submit from Enter in a field of its form) and is exposed
   * as `aria-disabled` and `aria-busy`. It is not natively `disabled`, so keyboard focus stays on it
   * while the work runs; pass `disabled` for a button that must leave the tab order. The visible
   * cue is `loadingLabel` or a spinner among the children: without either only the cursor changes.
   */
  loading?: boolean;
  /**
   * Replaces the children while `loading` and is announced to screen readers. Without it the
   * children stay and the UI string `loading` is announced while `loading`.
   */
  loadingLabel?: string;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Render the child element (via Slot) instead of a `<button>`, e.g. a link. */
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
  onClick,
  ...props
}: ButtonProps) {
  const strings = useUiStrings();
  // Natively disabled wins; a busy button stays focusable and swallows its activation instead.
  const busy = Boolean(loading) && !disabled;
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
      aria-disabled={busy ? "true" : undefined}
      disabled={disabled}
      className={buttonClasses({ variant, size, block, className })}
      {...props}
      onClick={busy ? ignoreClick : onClick}
    >
      {content}
    </Comp>
  );
  if (loadingLabel === undefined && !loading) return button;
  return (
    <>
      {button}
      <span role="status" className="sr-only">
        {loading ? (loadingLabel ?? strings.loading) : null}
      </span>
    </>
  );
}

/**
 * Cancels the activation of a busy button: no handler runs, a submit button does not submit (an
 * implicit submit from Enter in a field is a click on this button too) and a slotted link does not
 * navigate.
 */
function ignoreClick(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
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
