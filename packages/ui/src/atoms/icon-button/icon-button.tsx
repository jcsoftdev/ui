"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "../../utils/cn.js";
import { Button, type ButtonSize, type ButtonVariant } from "../button/button.js";
import { Spinner } from "../spinner/spinner.js";

export type IconButtonSize = ButtonSize;

/** Width behind each `size`; the height comes from the matching `Button` size, so the button is square. */
export const iconButtonSizeClasses: Readonly<Record<IconButtonSize, string>> = {
  sm: "w-control-sm",
  md: "w-control [&_svg]:size-4",
  lg: "w-control-lg [&_svg]:size-4",
};

export interface IconButtonProps
  extends Omit<ComponentPropsWithRef<"button">, "aria-label" | "aria-labelledby" | "children"> {
  /** Accessible name, announced in place of the icon. Required: an icon alone names nothing. */
  label: string;
  variant?: ButtonVariant;
  size?: IconButtonSize;
  /** Swaps the icon for a spinner and makes the button busy like `Button` `loading`: it keeps focus, ignores clicks and announces the localized `loading` string. */
  loading?: boolean;
  /** Render the child element (via Slot) instead of a `<button>`, e.g. a link wrapping the icon. */
  asChild?: boolean;
  /** The icon (an `svg`, an `Icon`, or any element). It is decorative: `label` names the button. */
  children: ComponentPropsWithRef<"button">["children"];
}

/**
 * Square, icon-only button with the same variants, sizes, focus ring and touch density as
 * `Button`. The control grows with `data-density="touch"` because its box is the Button height.
 */
export function IconButton({
  label,
  variant = "secondary",
  size = "md",
  loading,
  asChild,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={label}
      variant={variant}
      size={size}
      loading={loading}
      asChild={asChild}
      className={cn("shrink-0 px-0", iconButtonSizeClasses[size], className)}
    >
      {loading && !asChild ? <Spinner size="sm" label={false} /> : children}
    </Button>
  );
}
