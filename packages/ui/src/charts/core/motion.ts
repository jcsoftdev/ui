"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-chart-size.js";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user asked the OS for less motion. False on the server. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(QUERY);
    setReduced(media.matches);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export const EASE_OUT = "cubic-bezier(.22,1,.36,1)";

/** Cubic ease-out for `requestAnimationFrame` transitions, `t` in 0..1. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
}

export interface EntryAnimationOptions {
  /** Skip the animation entirely. */
  disabled?: boolean;
  /** Changing the key replays the animation (e.g. when the data set changes). */
  replayKey?: unknown;
}

/**
 * Plays an entry animation once per `replayKey` with the Web Animations API.
 * `play` receives the root element and starts whatever animations it needs.
 * Nothing runs under `prefers-reduced-motion`, on the server, or in browsers
 * without `Element.animate`, so the static final state is always the default.
 */
export function useEntryAnimation<T extends Element>(
  ref: RefObject<T | null>,
  play: (root: T) => void,
  { disabled = false, replayKey }: EntryAnimationOptions = {},
): void {
  // A layout effect starts the animations before the first paint. With a plain
  // effect the final state paints for one frame, then `fill: "backwards"` hides
  // it again, which reads as a flicker. Replays only when the key changes.
  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    if (disabled || !root || typeof root.animate !== "function" || prefersReducedMotion()) return;
    play(root);
  }, [disabled, replayKey]);
}

/** Reveals children left to right by scaling a clip rectangle. */
export function revealClip(element: Element, duration = 900, delay = 0): void {
  element.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
    duration,
    delay,
    easing: EASE_OUT,
    fill: "backwards",
  });
}

/**
 * Fade-in keyframes that end at the element's own opacity. Ending at 1 would
 * show a translucent element at full strength, then snap it back when the
 * animation finishes.
 */
export function fadeKeyframes(element: Element): Keyframe[] {
  const resting = typeof getComputedStyle === "function" ? getComputedStyle(element).opacity : "1";
  return [{ opacity: 0 }, { opacity: resting || "1" }];
}

/** Fades an element in. */
export function fadeIn(element: Element, duration = 400, delay = 0): void {
  element.animate(fadeKeyframes(element), {
    duration,
    delay,
    easing: "ease-out",
    fill: "backwards",
  });
}

/**
 * Eases a displayed number towards `target` (cubic ease-out). Starts from
 * `from` on mount, then from wherever it currently is when `target` changes.
 * Returns `target` at once under `prefers-reduced-motion` or `disabled`.
 */
export function useAnimatedNumber(
  target: number,
  {
    from = 0,
    duration = 900,
    disabled = false,
  }: { from?: number; duration?: number; disabled?: boolean } = {},
): number {
  const [value, setValue] = useState(disabled ? target : from);
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    if (disabled || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setValue(target);
      return;
    }
    const start = current.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // rAF timestamps are the frame start and can precede `startedAt`.
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const eased = 1 - (1 - progress) ** 3;
      setValue(start + (target - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, disabled]);
  return value;
}
