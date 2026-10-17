"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { cn } from "../../utils/cn.js";

export type AsideProps = ComponentPropsWithoutRef<"aside">;

/**
 * Complementary column content (`<aside>`), named "Related information" unless given an
 * `aria-label`. The column's width, surface and gutter belong to the page layout; the aside and
 * its parts render flush to it.
 */
export function Aside({ className, "aria-label": ariaLabel, ...props }: AsideProps) {
  const strings = useUiStrings();
  return (
    <aside
      aria-label={ariaLabel ?? strings.aside}
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    />
  );
}

export interface AsideHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  title: ReactNode;
  /** End slot, usually a link. */
  action?: ReactNode;
}

export function AsideHeader({ title, action, className, ...props }: AsideHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2 pt-4 pb-2", className)} {...props}>
      <h2 className="m-0 min-w-0 font-semibold text-fs-120 text-ink-3 tracking-wide">{title}</h2>
      {action !== undefined ? (
        <div className="shrink-0 text-fs-120 text-ink-3 [&_a]:hover:text-ink">{action}</div>
      ) : null}
    </div>
  );
}
