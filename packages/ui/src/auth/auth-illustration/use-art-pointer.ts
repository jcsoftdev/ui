"use client";

import { type RefObject, useEffect } from "react";
import { pointerOffset } from "./model.js";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Writes where the pointer is, relative to the art, as `--px` and `--py` (-1 to 1) on the art
 * element. It listens on the surrounding `AuthLayout` so the art also reacts while the pointer is
 * over the form. One write per animation frame at most; nothing runs for touch, coarse pointers or
 * reduced motion, and it follows those settings when they change while the page is open (the art
 * recentres when the parallax switches off). The listeners go away with the component.
 */
export function useArtPointer(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const art = ref.current;
    if (!art || typeof window.matchMedia !== "function") return;
    const fine = window.matchMedia(FINE_POINTER);
    const reduced = window.matchMedia(REDUCED_MOTION);
    const area: HTMLElement = art.closest<HTMLElement>("[data-layout]") ?? art;
    let frame = 0;
    let point: { x: number; y: number } | null = null;
    let listening = false;

    const write = () => {
      frame = 0;
      if (!point) {
        art.style.setProperty("--px", "0");
        art.style.setProperty("--py", "0");
        return;
      }
      const offset = pointerOffset(point, art.getBoundingClientRect());
      art.style.setProperty("--px", String(offset.x));
      art.style.setProperty("--py", String(offset.y));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      point = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => {
      point = null;
      schedule();
    };
    const stop = () => {
      if (!listening) return;
      listening = false;
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      point = null;
      art.style.removeProperty("--px");
      art.style.removeProperty("--py");
    };
    const sync = () => {
      if (!fine.matches || reduced.matches) return stop();
      if (listening) return;
      listening = true;
      area.addEventListener("pointermove", move, { passive: true });
      area.addEventListener("pointerleave", leave, { passive: true });
    };

    sync();
    fine.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      stop();
    };
  }, [ref]);
}
