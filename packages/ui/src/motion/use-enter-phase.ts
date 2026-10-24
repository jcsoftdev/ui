"use client";

import { type RefCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "../utils/reduced-motion.js";

const subscribeNever = () => () => {};

/**
 * True when this component's first render came from server HTML (on the server and while
 * hydrating), false when it mounted on the client. Fixed for the component's lifetime, so server
 * markup is never animated after hydration and hydration always matches it.
 */
export function useStartedOnServer(): boolean {
  const hydrating = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  );
  const [started] = useState(hydrating);
  return started;
}

/** `static`: no motion (server HTML or reduced motion). `wait`: hidden until in view. `enter`: animating in. */
export type EnterPhase = "static" | "wait" | "enter";

/** Phase of an enter animation, on mount or (with `inView`) when the element first scrolls into view. */
export function useEnterPhase(inView: boolean): [RefCallback<HTMLElement>, EnterPhase] {
  const startedOnServer = useStartedOnServer();
  const reduced = usePrefersReducedMotion();
  const [seen, setSeen] = useState(!inView);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const animate = !startedOnServer && !reduced;

  useEffect(() => {
    if (!animate || seen || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setSeen(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [animate, seen, node]);

  return [setNode, !animate ? "static" : seen ? "enter" : "wait"];
}
