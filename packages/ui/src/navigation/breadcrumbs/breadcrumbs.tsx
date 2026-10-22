"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronRight } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export interface BreadcrumbItem {
  label: ReactNode;
  /** Destination. Omit it on the last item, or on a crumb that is not navigable. */
  href?: string;
}

export interface BreadcrumbLinkProps {
  href: string;
  className: string;
  children: ReactNode;
}

/** Renders a breadcrumb link; inject your router's link component here. */
export type BreadcrumbRenderLink = (props: BreadcrumbLinkProps) => ReactNode;

export type BreadcrumbsPart = "root" | "list" | "item" | "link" | "current" | "separator";

export interface BreadcrumbsProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /** Trail in order; the last entry is the current page. */
  items: readonly BreadcrumbItem[];
  /** Link renderer; defaults to a plain anchor. */
  renderLink?: BreadcrumbRenderLink;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<BreadcrumbsPart>;
}

const defaultRenderLink: BreadcrumbRenderLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

/**
 * Navigation trail. A `nav` landmark (named "Breadcrumbs" in the active locale unless `aria-label`
 * is set) around an ordered list; the last item is the current page and carries
 * `aria-current="page"` instead of a link.
 */
export function Breadcrumbs({
  items,
  renderLink = defaultRenderLink,
  className,
  classNames,
  "aria-label": ariaLabel,
  ...props
}: BreadcrumbsProps) {
  const strings = useUiStrings();
  const lastIndex = items.length - 1;
  return (
    <nav
      aria-label={ariaLabel ?? strings.breadcrumbs}
      className={cn("text-ink-3 text-meta", classNames?.root, className)}
      {...props}
    >
      <ol
        className={cn(
          "m-0 flex min-w-0 list-none flex-wrap items-center gap-x-1.5 gap-y-0.5 p-0",
          classNames?.list,
        )}
      >
        {items.map((item, index) => {
          const current = index === lastIndex;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: crumbs are positional and may share a label
            <li key={index} className={cn("inline-flex items-center gap-1.5", classNames?.item)}>
              {current || item.href === undefined ? (
                <span
                  aria-current={current ? "page" : undefined}
                  className={cn(current && "font-semibold text-ink", classNames?.current)}
                >
                  {item.label}
                </span>
              ) : (
                renderLink({
                  href: item.href,
                  className: cn(
                    "rounded-xs underline-offset-2 hover:text-ink hover:underline focus-visible:focus-ring",
                    classNames?.link,
                  ),
                  children: item.label,
                })
              )}
              {current ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-line-control rtl:rotate-180",
                    classNames?.separator,
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
