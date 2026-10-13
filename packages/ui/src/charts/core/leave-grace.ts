"use client";

import { useCallback, useEffect, useRef } from "react";

/** How long a pointer may be over nothing before the hover clears (crossing a 1-6px gutter). */
export const LEAVE_GRACE_MS = 60;

/**
 * Defers clearing a hover so crossing the gutter between two adjacent marks goes A to B without an
 * empty frame. `leave` schedules the clear; `hold` cancels it and must run whenever a mark is
 * entered or moved over, before the new hover is stored.
 */
export function useLeaveGrace(clear: () => void, delay: number = LEAVE_GRACE_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(clear);
  latest.current = clear;

  const hold = useCallback(() => {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const leave = useCallback(() => {
    hold();
    timer.current = setTimeout(() => {
      timer.current = undefined;
      latest.current();
    }, delay);
  }, [hold, delay]);

  useEffect(() => hold, [hold]);

  return { leave, hold };
}
