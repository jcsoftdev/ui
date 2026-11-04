"use client";

import { type ComponentPropsWithoutRef, useSyncExternalStore } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { type ElapsedTone, formatClock, isoDuration, readElapsed, toneFor } from "./model.js";
import { getTickerSnapshot, subscribeTicker } from "./ticker.js";

export type ElapsedTimePart = "root" | "text";

export interface ElapsedTimeProps extends Omit<ComponentPropsWithoutRef<"time">, "children"> {
  /** Moment the timer counts from. */
  since: Date | string;
  /** Server clock minus the client clock in ms, so a skewed device still shows the server's elapsed time. */
  serverOffsetMs?: number;
  /**
   * `mm:ss` (default) shows a ticking clock; `minutes` shows whole minutes. With reduced motion
   * requested, `mm:ss` is shown as whole minutes so the digits stop ticking.
   */
  format?: "mm:ss" | "minutes";
  /** Minutes from which the text turns warning (counting up), or down to which it does (countdown). */
  warnAt?: number;
  /** Minutes from which the text turns danger (counting up), or down to which it does (countdown). A countdown past its target is always danger. */
  dangerAt?: number;
  /** Turns the timer into a countdown to this moment; `since` is then only the fallback reference. */
  countdownTo?: Date | string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ElapsedTimePart>;
}

const toneClasses: Record<ElapsedTone, string> = {
  neutral: "text-ink-2",
  warning: "font-bold text-warning",
  danger: "font-bold text-danger",
};

function fill(template: string, key: string, value: string): string {
  return template.replace(`{${key}}`, value);
}

/**
 * A live timer in tabular numerals. Every instance shares one ticker (a single timer, aligned to
 * the second, running only while something is mounted). It renders `<time>` with an ISO duration
 * in `dateTime`, exposes plain text such as "12 minutes" to assistive tech and is never an
 * `aria-live` region, so it does not interrupt anyone.
 */
export function ElapsedTime({
  since,
  serverOffsetMs,
  format = "mm:ss",
  warnAt,
  dangerAt,
  countdownTo,
  className,
  classNames,
  ...props
}: ElapsedTimeProps) {
  const strings = useUiStrings();
  const reducedMotion = usePrefersReducedMotion();
  const now = useSyncExternalStore(subscribeTicker, getTickerSnapshot, getTickerSnapshot);
  const countdown = countdownTo !== undefined;
  const reading = readElapsed({ since, now, serverOffsetMs, countdownTo });
  const tone = toneFor(reading, countdown, warnAt, dangerAt);
  const minutes = Math.floor(reading.seconds / 60);
  const asClock = format === "mm:ss" && !reducedMotion;
  const visible = asClock
    ? formatClock(reading.seconds)
    : fill(strings.minutesShort, "count", String(minutes));
  const spoken = fill(
    minutes === 1 ? strings.elapsedMinutesOne : strings.elapsedMinutes,
    "count",
    String(minutes),
  );
  const announced = countdown
    ? fill(reading.over ? strings.countdownOver : strings.countdownLeft, "time", spoken)
    : spoken;

  return (
    <time
      dateTime={isoDuration(reading.seconds)}
      data-tone={tone === "neutral" ? undefined : tone}
      data-countdown={countdown ? "" : undefined}
      className={cn(
        "inline-block text-data tabular-nums transition-colors motion-reduce:transition-none",
        toneClasses[tone],
        classNames?.root,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" suppressHydrationWarning className={classNames?.text}>
        {visible}
      </span>
      <span className="sr-only" suppressHydrationWarning>
        {announced}
      </span>
    </time>
  );
}
