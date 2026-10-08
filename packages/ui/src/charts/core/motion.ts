"use client";

import { type RefObject, useEffect, useState } from "react";

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: replays only when the key changes.
  useEffect(() => {
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

/** Fades an element in. */
export function fadeIn(element: Element, duration = 400, delay = 0): void {
  element.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration,
    delay,
    easing: "ease-out",
    fill: "backwards",
  });
}
