"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronLeft } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { Slot } from "../../utils/slot.js";

export interface PageHeaderBackProps extends ComponentPropsWithoutRef<"a"> {
  /** Renders the single child element (a router `Link`) with the link's look. The child supplies the label. */
  asChild?: boolean | undefined;
}

/**
 * The way back to the parent screen, for `PageHeader`'s `back` slot. A real link: pass `href`, or
 * `asChild` with your router's `Link`. The label defaults to the localized "Back".
 */
export function PageHeaderBack({
  asChild = false,
  className,
  children,
  ...props
}: PageHeaderBackProps) {
  const strings = useUiStrings();
  const classes = cn(
    "inline-flex min-h-8 items-center gap-1 text-control text-ink-2 no-underline hover:text-ink focus-visible:focus-ring",
    className,
  );
  if (asChild) {
    return (
      <Slot {...props} className={classes}>
        {children}
      </Slot>
    );
  }
  return (
    <a {...props} className={classes}>
      <ChevronLeft aria-hidden="true" className="size-4" />
      {children ?? strings.back}
    </a>
  );
}
