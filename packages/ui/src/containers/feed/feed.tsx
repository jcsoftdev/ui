"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type FeedTimeOptions, formatFeedTime, toDateTimeAttribute } from "./model.js";

export type FeedProps = ComponentPropsWithoutRef<"ol">;

/** Compact activity list: an outlined mark per event, a rail between them, a timestamp under each. Flush. */
export function Feed({ className, ...props }: FeedProps) {
  return <ol className={cn("m-0 flex list-none flex-col p-0", className)} {...props} />;
}

export type FeedEventPart = "mark" | "rail" | "body" | "text" | "meta" | "time";

export interface FeedEventProps extends ComponentPropsWithoutRef<"li">, FeedTimeOptions {
  /** Decorative glyph inside the mark (`aria-hidden`). Without it the mark is a dot. */
  icon?: ReactNode;
  /**
   * When it happened: an ISO instant (`2026-03-04T15:30:00Z`), a calendar date (`2026-03-04`) or
   * a `Date`. Rendered as `<time datetime>` and formatted with the locale of the UI strings.
   */
  time?: string | Date;
  /** Replaces the formatted `time` text (the machine value stays on `datetime`). */
  timeLabel?: ReactNode;
  /** Extra line under the text, after the time (an actor, a place). */
  meta?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the item. */
  classNames?: ClassNames<FeedEventPart>;
}

export function FeedEvent({
  icon,
  time,
  timeLabel,
  meta,
  locale,
  timeZone,
  relative,
  now,
  className,
  classNames,
  children,
  ...props
}: FeedEventProps) {
  const strings = useUiStrings();
  const text =
    timeLabel ??
    (time === undefined
      ? null
      : formatFeedTime(time, { locale: locale ?? strings.locale, timeZone, relative, now }));
  return (
    <li
      className={cn(
        "group/ev relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5 py-2",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-6.5 -bottom-2 left-2.25 w-px bg-divider group-last/ev:hidden",
          classNames?.rail,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative grid size-5 place-items-center rounded-pill border-divider bg-surface text-ink-3 [&_svg]:size-3",
          classNames?.mark,
        )}
      >
        {icon ?? <span className="size-1.5 rounded-pill bg-current" />}
      </span>
      <div className={cn("min-w-0", classNames?.body)}>
        <p className={cn("m-0 text-fs-130 leading-snug [&_b]:font-medium", classNames?.text)}>
          {children}
        </p>
        {text !== null || meta !== undefined ? (
          <p className={cn("m-0 text-meta text-ink-3 tabular-nums", classNames?.meta)}>
            {text !== null ? (
              <time
                dateTime={time === undefined ? undefined : toDateTimeAttribute(time)}
                className={classNames?.time}
              >
                {text}
              </time>
            ) : null}
            {text !== null && meta !== undefined ? " · " : null}
            {meta}
          </p>
        ) : null}
      </div>
    </li>
  );
}
