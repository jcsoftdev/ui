"use client";

import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  useContext,
  useId,
} from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

const SectionDepth = createContext(0);

type SectionHeadingTag = "h2" | "h3" | "h4" | "h5" | "h6";
const headingForDepth: SectionHeadingTag[] = ["h2", "h3", "h4", "h5", "h6"];

export type SectionPart =
  | "root"
  | "header"
  | "heading"
  | "title"
  | "count"
  | "description"
  | "actions"
  | "body";

export interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  as?: "section" | "div" | "article";
  title?: ReactNode;
  /** Outlined count next to the title (a record total, say). */
  count?: ReactNode;
  description?: ReactNode;
  /** Slot at the end of the header row; takes the full row under 560px of the section's own width. */
  actions?: ReactNode;
  /** Heading element of the title. Defaults to `h2`, one level deeper per nested section. */
  titleAs?: SectionHeadingTag;
  /** Hairline above the section. */
  divider?: boolean;
  /** Vertical padding around the body. Defaults to `true`; `false` leaves the body edge to edge. */
  padded?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SectionPart>;
}

/**
 * A titled block of a page: a header row (title, count, description, actions) and a body.
 * It never pads the inline edges (the page layout owns the gutter), and sections nest without
 * stacking: each level steps its heading down and its vertical spacing tighter. Named by its
 * title when it has one.
 */
export function Section({
  as = "section",
  title,
  count,
  description,
  actions,
  titleAs,
  divider = false,
  padded = true,
  className,
  classNames,
  children,
  ...props
}: SectionProps) {
  const depth = useContext(SectionDepth);
  const titleId = useId();
  const Tag = as;
  const Heading = titleAs ?? headingForDepth[Math.min(depth, headingForDepth.length - 1)] ?? "h2";
  const hasHeader =
    title !== undefined ||
    count !== undefined ||
    description !== undefined ||
    actions !== undefined;
  const nested = depth > 0;
  const named = title !== undefined && as !== "div";

  return (
    <SectionDepth.Provider value={depth + 1}>
      <Tag
        {...props}
        data-depth={depth}
        aria-labelledby={named && props["aria-label"] === undefined ? titleId : undefined}
        className={cn(
          "@container/section min-w-0",
          divider && "border-t-divider",
          classNames?.root,
          className,
        )}
      >
        {hasHeader ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2.5 gap-y-1.5",
              nested ? "pt-2 pb-1.5" : "pt-3.5 pb-2.5",
              classNames?.header,
            )}
          >
            {title !== undefined ? (
              <Heading
                id={titleId}
                className={cn(
                  "m-0 min-w-0 font-semibold text-ink",
                  nested ? "text-control" : "text-body",
                  classNames?.title,
                  classNames?.heading,
                )}
              >
                {title}
              </Heading>
            ) : null}
            {count !== undefined ? (
              <span
                className={cn(
                  "rounded-pill border-divider px-1.75 text-count text-ink-3 tabular-nums",
                  classNames?.count,
                )}
              >
                {count}
              </span>
            ) : null}
            {description !== undefined ? (
              <p className={cn("m-0 min-w-0 text-meta text-ink-3", classNames?.description)}>
                {description}
              </p>
            ) : null}
            {actions !== undefined ? (
              <div
                className={cn(
                  "ml-auto flex flex-wrap items-center gap-2 @max-[560px]/section:ml-0 @max-[560px]/section:w-full",
                  classNames?.actions,
                )}
              >
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={cn("min-w-0", padded && (nested ? "py-2" : "py-4"), classNames?.body)}>
          {children}
        </div>
      </Tag>
    </SectionDepth.Provider>
  );
}
