"use client";

import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLeaveGrace } from "./leave-grace.js";

export interface IndexNavigationOptions {
  /** Arrow keys wrap around the ends (circular charts). */
  wrap?: boolean;
}

/** Attribute of the pointer targets whose press keeps a touch-pinned item instead of dismissing it. */
const CHART_HIT = "data-chart-hit";

interface HoverEvent {
  clientX: number;
  clientY: number;
  /** `mouse`, `touch` or `pen`; absent for synthetic calls, which behave like a mouse. */
  pointerType?: string;
}

/**
 * Active-item state for charts made of discrete items (slices, axes, stages).
 * One source of truth for pointer hover and keyboard focus, so the tooltip,
 * the highlight and `aria-valuetext` always agree. `ref` goes on the
 * positioned container: `hover` stores the pointer relative to it.
 *
 * A touch or pen press pins the item: lifting the finger fires `pointerleave`,
 * which `pointerLeave` ignores for those pointers, so the details stay up
 * until the next press outside a `CHART_HIT` target.
 */
export function useIndexNavigation<T extends HTMLElement = HTMLDivElement>(
  count: number,
  { wrap = false }: IndexNavigationOptions = {},
) {
  const ref = useRef<T>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setActive((current) => (current != null && current >= count ? null : current));
  }, [count]);

  const clear = useCallback(() => {
    setActive(null);
    setPointer(null);
    setPinned(false);
  }, []);
  const { leave: leaveSoon, hold } = useLeaveGrace(clear);

  const hover = useCallback(
    (index: number, event: HoverEvent) => {
      hold();
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      setActive(index);
      setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
      setPinned(event.pointerType != null && event.pointerType !== "mouse");
    },
    [hold],
  );

  const leave = useCallback(() => {
    hold();
    clear();
  }, [hold, clear]);

  /**
   * `pointerleave` handler: a mouse leaving drops the item after a short grace (so crossing the
   * gutter between two marks never shows an empty frame); a lifted finger or pen keeps it pinned.
   */
  const pointerLeave = useCallback(
    (event?: { pointerType?: string }) => {
      if (event?.pointerType == null || event.pointerType === "mouse") leaveSoon();
    },
    [leaveSoon],
  );

  useEffect(() => {
    if (!pinned) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(`[${CHART_HIT}]`) || !ref.current?.contains(target)) leave();
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [pinned, leave]);

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
    onFocus: (event?: FocusEvent<HTMLElement>) => {
      if (event && !event.currentTarget.matches(":focus-visible")) return;
      setActive((current) => current ?? 0);
    },
    onBlur: leave,
  };

  return { ref, active, pointer, setActive, hover, leave, pointerLeave, sliderProps };
}
