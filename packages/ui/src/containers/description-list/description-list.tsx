import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type DescriptionListLayout = "auto" | "inline" | "stacked";

export interface DescriptionListProps extends ComponentPropsWithoutRef<"dl"> {
  /**
   * `auto` (default) puts the term beside the value and stacks them when the list's own container
   * is narrower than 24rem; `inline` never stacks; `stacked` always puts the term over the value.
   */
  layout?: DescriptionListLayout;
  /** Side the values align to. Defaults to `end` (right in LTR); `start` reads like a form summary. */
  valueAlign?: "end" | "start";
  /** Pairs per row once the container is at least 28rem wide; one column below. Defaults to 1. */
  columns?: 1 | 2 | 3;
}

const layoutClasses: Record<DescriptionListLayout, string> = {
  auto: "grid-cols-[auto_minmax(0,1fr)] @max-sm/dl:grid-cols-1 @max-sm/dl:gap-y-0.5 @max-sm/dl:[&_dd]:mb-2 @max-sm/dl:[&_dd]:text-start",
  inline: "grid-cols-[auto_minmax(0,1fr)]",
  stacked: "grid-cols-1 gap-y-0.5 [&_dd]:mb-2 [&_dd]:text-start",
};

const columnClasses: Record<DescriptionListLayout, Record<2 | 3, string>> = {
  auto: {
    2: "@md/dl:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
    3: "@md/dl:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
  },
  inline: {
    2: "grid-cols-[auto_minmax(0,1fr)] @md/dl:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
    3: "grid-cols-[auto_minmax(0,1fr)] @md/dl:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]",
  },
  stacked: { 2: "@md/dl:grid-cols-2", 3: "@md/dl:grid-cols-3" },
};

/**
 * Key-value list: terms and values in a grid, no page padding. Compose flat `<dt>`/`<dd>` pairs
 * or `DescriptionListItem`s (which fill an empty value with a placeholder) as children. Layout
 * (`auto`/`inline`/`stacked`), value alignment and multi-column rows are container-query driven.
 */
export function DescriptionList({
  className,
  layout = "auto",
  valueAlign = "end",
  columns = 1,
  ...props
}: DescriptionListProps) {
  return (
    <div className="@container/dl min-w-0">
      <dl
        className={cn(
          "grid gap-x-4 gap-y-2.25 text-fs-130",
          "[&_dt]:text-ink-3 [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:font-semibold",
          valueAlign === "end" ? "[&_dd]:text-end" : "[&_dd]:text-start",
          layoutClasses[layout],
          columns !== 1 && columnClasses[layout][columns],
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface DescriptionListItemProps {
  term: ReactNode;
  /** The value. `null`, `undefined`, `false` and `""` render the placeholder instead. */
  children?: ReactNode;
  /** Shown for an empty value. Defaults to an em dash. */
  placeholder?: ReactNode;
  /** Screen-reader text for an empty value (the placeholder itself is decorative). */
  emptyLabel?: string;
  className?: string;
}

/** A `dt`/`dd` pair placed straight in the grid, with a placeholder for a missing value. */
export function DescriptionListItem({
  term,
  children,
  placeholder = "—",
  emptyLabel,
  className,
}: DescriptionListItemProps) {
  const empty =
    children === null || children === undefined || children === false || children === "";
  return (
    <>
      <dt>{term}</dt>
      <dd data-empty={empty ? "" : undefined} className={className}>
        {empty ? (
          <>
            <span aria-hidden="true">{placeholder}</span>
            {emptyLabel ? <span className="sr-only">{emptyLabel}</span> : null}
          </>
        ) : (
          children
        )}
      </dd>
    </>
  );
}
