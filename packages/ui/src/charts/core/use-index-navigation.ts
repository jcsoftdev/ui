"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

export interface IndexNavigationOptions {
  /** Arrow keys wrap around the ends (circular charts). */
  wrap?: boolean;
}

/**
 * Active-item state for charts made of discrete items (slices, axes, stages).
 * One source of truth for pointer hover and keyboard focus, so the tooltip,
 * the highlight and `aria-valuetext` always agree. `ref` goes on the
 * positioned container: `hover` stores the pointer relative to it.
 */
export function useIndexNavigation<T extends HTMLElement = HTMLDivElement>(
  count: number,
  { wrap = false }: IndexNavigationOptions = {},
) {
  const ref = useRef<T>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setActive((current) => (current != null && current >= count ? null : current));
  }, [count]);

  const hover = useCallback((index: number, event: { clientX: number; clientY: number }) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setActive(index);
    setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
  }, []);

  const leave = useCallback(() => {
    setActive(null);
    setPointer(null);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (count === 0) return;
    const last = count - 1;
    let move: (current: number | null) => number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      move = (current) =>
        current == null ? 0 : wrap ? (current + 1) % count : Math.min(last, current + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      move = (current) =>
        current == null ? last : wrap ? (current - 1 + count) % count : Math.max(0, current - 1);
    } else if (event.key === "Home") move = () => 0;
    else if (event.key === "End") move = () => last;
    else if (event.key === "Escape") {
      leave();
      return;
    } else return;
    event.preventDefault();
    setPointer(null);
    setActive(move);
  };

  const sliderProps = {
    onKeyDown,
    onFocus: () => setActive((current) => current ?? 0),
    onBlur: leave,
  };

  return { ref, active, pointer, setActive, hover, leave, sliderProps };
}
