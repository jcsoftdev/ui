import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type DetailHeaderLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface DetailHeaderProps extends Omit<ComponentPropsWithoutRef<"header">, "title"> {
  /** The record's name: the heading of the header. */
  name: ReactNode;
  /** Picture slot before the name, usually an `Avatar` (pass `className="size-14"` for a larger one). */
  avatar?: ReactNode;
  /** Line under the name: a role, a code, a relationship. */
  subtitle?: ReactNode;
  /** Status next to the name: a `Chip` or `StatusPill`. Wraps under the name when narrow. */
  status?: ReactNode;
  /** Key facts row under the header, usually a `Facts` list. */
  facts?: ReactNode;
  /** Buttons for the record. They wrap under the name when the header's own width is 480px or less. */
  actions?: ReactNode;
  /** Level of the name heading. Defaults to `2`, the level under the page's `h1`. */
  headingLevel?: DetailHeaderLevel;
}

/**
 * Header of a record screen (an applicant, a person, a student): picture, name, status, facts and
 * actions in one block. It is the record's heading, not the page's: keep the page title in
 * `PageHeader` and put this under it, or let it be the first thing of a detail pane.
 */
export function DetailHeader({
  name,
  avatar,
  subtitle,
  status,
  facts,
  actions,
  headingLevel = 2,
  className,
  ...props
}: DetailHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <header className={cn("@container/detail-header flex min-w-0 flex-col", className)} {...props}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {avatar !== undefined ? <div className="shrink-0">{avatar}</div> : null}
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Heading className="m-0 min-w-0 break-words font-semibold text-fs-200 text-ink [text-wrap:balance]">
              {name}
            </Heading>
            {status}
          </div>
          {subtitle !== undefined ? (
            <p className="m-0 mt-0.5 break-words text-ink-3 text-meta">{subtitle}</p>
          ) : null}
        </div>
        {actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 @max-[480px]/detail-header:basis-full">
            {actions}
          </div>
        ) : null}
      </div>
      {facts}
    </header>
  );
}
