"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Layout effect in the browser, plain effect on the server (no SSR warning). */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Width used for the server render and the first client paint before measuring. */
export const FALLBACK_WIDTH = 640;

/**
 * Tracks the content width of an element with a ResizeObserver. Renders with
 * `fallbackWidth` on the server and until the first measurement.
 */
export function useChartWidth<T extends HTMLElement>(
  fallbackWidth = FALLBACK_WIDTH,
): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallbackWidth);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const apply = (next: number) => {
      if (next > 0) setWidth((current) => (Math.abs(current - next) < 0.5 ? current : next));
    };
    apply(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, Math.floor(width)];
}
