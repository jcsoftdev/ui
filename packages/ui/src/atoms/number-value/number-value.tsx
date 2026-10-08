"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { formatNumber, type NumberFormatConfig, tweenValue } from "./format.js";

export interface NumberValueProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  value: number;
  /** Intl options plus `locale`, e.g. `{ style: "currency", currency: "PEN" }`. */
  format?: NumberFormatConfig;
  /** Animation length in ms. No animation under `prefers-reduced-motion`. */
  duration?: number;
  /** Count up from this value on first render. */
  from?: number;
  /** When false, only later changes of `value` animate. */
  animateOnMount?: boolean;
}

/**
 * Number that counts up to `value`, formatted with Intl. Assistive tech reads the final
 * value at once; the animated text is hidden from it so it is not announced digit by digit.
 */
export function NumberValue({
  value,
  format,
  duration = 900,
  from = 0,
  animateOnMount = true,
  className,
  ...props
}: NumberValueProps) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(!animateOnMount ? value : from);
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    if (reduced || duration <= 0) {
      setShown(value);
      return;
    }
    const start = latest.current;
    if (start === value) return;
    const t0 = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = (now - t0) / duration;
      setShown(tweenValue(start, value, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return (
    <span className={cn("tabular-nums", className)} {...props}>
      <span aria-hidden="true">{formatNumber(shown, format)}</span>
      <span className="sr-only">{formatNumber(value, format)}</span>
    </span>
  );
}
