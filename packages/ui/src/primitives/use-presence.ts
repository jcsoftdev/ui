"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

const SAFETY_MS = 50;

function toMs(value: string): number[] {
  return value.split(",").map((part) => {
    const text = part.trim();
    const number = Number.parseFloat(text);
    if (Number.isNaN(number)) return 0;
    return text.endsWith("ms") ? number : number * 1000;
  });
}

/** Longest animation or transition (duration + delay) on the node, in ms. */
export function exitDuration(node: Element): number {
  const style = getComputedStyle(node);
  const total = (durations: string, delays: string): number => {
    const d = toMs(durations);
    const delay = toMs(delays);
    return Math.max(0, ...d.map((value, i) => value + (delay[i % delay.length] ?? 0)));
  };
  const animated =
    style.animationName === "none" ? 0 : total(style.animationDuration, style.animationDelay);
  const transitioned = total(style.transitionDuration, style.transitionDelay);
  return Math.max(animated, transitioned);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/**
 * Keeps a node mounted while its exit animation or transition runs. Returns
 * whether to render. The node must already carry its closed `data-state` when
 * `present` turns false; it unmounts on `animationend`/`transitionend`, after a
 * safety timeout, or immediately without motion or under reduced motion.
 */
export function usePresence(present: boolean, ref: RefObject<HTMLElement | null>): boolean {
  const [mounted, setMounted] = useState(present);
  if (present && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (present || !mounted) return;
    const node = ref.current;
    const duration = node && !prefersReducedMotion() ? exitDuration(node) : 0;
    if (!node || duration <= 0) {
      setMounted(false);
      return;
    }
    const finish = () => setMounted(false);
    const onEnd = (event: Event) => {
      if (event.target === node) finish();
    };
    node.addEventListener("animationend", onEnd);
    node.addEventListener("transitionend", onEnd);
    const timer = setTimeout(finish, duration + SAFETY_MS);
    return () => {
      node.removeEventListener("animationend", onEnd);
      node.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
    };
  }, [present, mounted, ref]);

  return present || mounted;
}
