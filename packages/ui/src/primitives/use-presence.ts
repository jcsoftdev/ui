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

/** Properties whose transition can be an exit effect; colour transitions (hover styles) are not. */
const EXIT_PROPERTIES = new Set([
  "all",
  "opacity",
  "transform",
  "translate",
  "scale",
  "rotate",
  "filter",
  "backdrop-filter",
  "clip-path",
  "visibility",
  "width",
  "height",
  "max-width",
  "max-height",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
]);

const cycle = (list: number[], index: number) => list[index % list.length] ?? 0;

/**
 * Longest exit effect on the node, in ms: its own animation (when `animation-name`
 * is set) or a transition of an exit-relevant property. Unrelated transitions such
 * as `transition-colors` are ignored so unmounting never waits for the safety timeout.
 */
export function exitDuration(node: Element): number {
  const style = getComputedStyle(node);
  const total = (durations: string, delays: string, index = 0): number =>
    cycle(toMs(durations), index) + cycle(toMs(delays), index);
  const animated =
    style.animationName === "none"
      ? 0
      : Math.max(
          0,
          ...toMs(style.animationDuration).map((_, i) =>
            total(style.animationDuration, style.animationDelay, i),
          ),
        );
  const properties = style.transitionProperty.split(",").map((part) => part.trim());
  const transitioned = Math.max(
    0,
    ...properties.map((property, i) =>
      EXIT_PROPERTIES.has(property) ? total(style.transitionDuration, style.transitionDelay, i) : 0,
    ),
  );
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
      if (event.target !== node) return;
      const property = (event as TransitionEvent).propertyName;
      if (event.type === "transitionend" && !EXIT_PROPERTIES.has(property)) return;
      finish();
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
