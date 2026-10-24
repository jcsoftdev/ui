"use client";

import { type AnimationEvent, type Key, useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../utils/reduced-motion.js";

type Pulse = "a" | "b";

/** Props for a highlighted row: spread them on the row element (`tr`, `li`, `div`). */
export interface HighlightRowProps {
  "data-motion-pulse"?: Pulse;
  onAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
}

export interface HighlightRow<K extends Key> {
  /** Pulses the row with this key, e.g. after it was updated. Calling it again restarts the pulse. */
  highlight: (key: K) => void;
  /** Props for the row with this key. Render `<MotionStyles />` or any motion component once on the page. */
  rowProps: (key: K) => HighlightRowProps;
}

/**
 * A brief background pulse (accent tint fading out over 1.6 `--motion-duration`s) on rows that
 * were inserted or updated. Pass the current row keys to pulse every key that appears after the
 * first render automatically; call `highlight(key)` for updates. The rows on the first render
 * (and in server HTML) never pulse, and under reduced motion nothing pulses.
 * In a `tr` the cells carry the pulse, so it shows through cell backgrounds.
 */
export function useHighlightRow<K extends Key>(keys?: readonly K[]): HighlightRow<K> {
  const reduced = usePrefersReducedMotion();
  const [pulses, setPulses] = useState<ReadonlyMap<K, Pulse>>(() => new Map());
  const known = useRef<ReadonlySet<K> | null>(null);

  const highlight = useCallback(
    (key: K) => {
      if (reduced) return;
      setPulses((map) => new Map(map).set(key, map.get(key) === "a" ? "b" : "a"));
    },
    [reduced],
  );

  useEffect(() => {
    if (!keys) return;
    const previous = known.current;
    known.current = new Set(keys);
    if (!previous) return;
    for (const key of keys) if (!previous.has(key)) highlight(key);
  }, [keys, highlight]);

  const rowProps = (key: K): HighlightRowProps => ({
    "data-motion-pulse": pulses.get(key),
    onAnimationEnd: (event) => {
      if (!event.animationName.startsWith("ui-motion-pulse")) return;
      setPulses((map) => {
        if (!map.has(key)) return map;
        const next = new Map(map);
        next.delete(key);
        return next;
      });
    },
  });

  return { highlight, rowProps };
}
