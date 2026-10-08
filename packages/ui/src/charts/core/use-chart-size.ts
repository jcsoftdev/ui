"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Layout effect in the browser, plain effect on the server (no SSR warning). */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Width used for the server render and the first client paint before measuring. */
export const FALLBACK_WIDTH = 640;

/** Height used before the first measurement when a chart fills its parent. */
export const FALLBACK_HEIGHT = 300;

export interface ChartSize {
  width: number;
  height: number;
}

/**
 * Tracks the content box of an element with a ResizeObserver. Renders with
 * the fallback size on the server and until the first measurement.
 */
export function useChartSize<T extends HTMLElement>(
  fallback: ChartSize = { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT },
): [RefObject<T | null>, ChartSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ChartSize>(fallback);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const apply = (width: number, height: number) => {
      setSize((current) => {
        const nextWidth = width > 0 ? width : current.width;
        const nextHeight = height > 0 ? height : current.height;
        return Math.abs(current.width - nextWidth) < 0.5 &&
          Math.abs(current.height - nextHeight) < 0.5
          ? current
          : { width: nextWidth, height: nextHeight };
      });
    };
    const rect = element.getBoundingClientRect();
    apply(rect.width, rect.height);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, { width: Math.floor(size.width), height: Math.floor(size.height) }];
}

/** Width only (kept for charts that do not need the height). */
export function useChartWidth<T extends HTMLElement>(
  fallbackWidth = FALLBACK_WIDTH,
): [RefObject<T | null>, number] {
  const [ref, size] = useChartSize<T>({ width: fallbackWidth, height: FALLBACK_HEIGHT });
  return [ref, size.width];
}

export { type ResolveHeightInput, resolveDrawingHeight } from "./drawing-height.js";
