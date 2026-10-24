"use client";

import { type HTMLAttributes, type Ref, useEffect, useMemo, useRef, useState } from "react";
import { useUiStrings } from "../i18n/index.js";
import { cn } from "../utils/cn.js";
import { usePrefersReducedMotion } from "../utils/reduced-motion.js";
import { composeRefs } from "../utils/slot.js";
import { COUNT_UP_SCALE, countAt, parseDuration, parseEasing } from "./model.js";
import { MotionStyles } from "./motion-styles.js";
import { useStartedOnServer } from "./use-enter-phase.js";

/** Anything with an `Intl.NumberFormat`-style `format`, such as `new Intl.NumberFormat(...)`. */
export interface NumberFormatter {
  format(value: number): string;
}

export interface CountUpProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  /** Formats every shown value. Defaults to `Intl.NumberFormat` in the UI strings locale. */
  formatter?: NumberFormatter;
  /** Where a client-side mount starts counting from. Default 0. */
  from?: number;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * A number that counts to `value` over 1.5 `--motion-duration`s with `--motion-ease`, on a client
 * mount and on every change. Server HTML, hydration and reduced motion show the final value at
 * once. While it counts, assistive tech reads only the final value and the final text reserves
 * its width, so the line does not grow digit by digit. Works as the `value` of a `Kpi`.
 */
export function CountUp({ value, formatter, from = 0, className, ref, ...props }: CountUpProps) {
  const { locale } = useUiStrings();
  const format = useMemo(() => formatter ?? new Intl.NumberFormat(locale), [formatter, locale]);
  const startedOnServer = useStartedOnServer();
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(() => (startedOnServer || reduced ? value : from));
  const node = useRef<HTMLSpanElement>(null);
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    const start = latest.current;
    const el = node.current;
    if (reduced || start === value || !el || typeof requestAnimationFrame === "undefined") {
      setShown(value);
      return;
    }
    const styles = getComputedStyle(el);
    const duration = parseDuration(styles.getPropertyValue("--motion-duration")) * COUNT_UP_SCALE;
    const ease = parseEasing(styles.getPropertyValue("--motion-ease"));
    const t0 = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const next = countAt(start, value, now - t0, duration, ease);
      setShown(next);
      if (next !== value) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  const final = format.format(value);
  return (
    <>
      <MotionStyles />
      <span ref={composeRefs(ref, node)} className={cn("ui-count", className)} {...props}>
        {shown === value ? (
          final
        ) : (
          <>
            <span className="ui-count-run" aria-hidden="true">
              <span>{final}</span>
              <span>{format.format(shown)}</span>
            </span>
            <span className="ui-motion-sr">{final}</span>
          </>
        )}
      </span>
    </>
  );
}
