"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/** How a chart's details are shown: `auto` docks on narrow containers and coarse pointers. */
export type ChartDockMode = "auto" | "always" | "never";

/** Viewports up to this width (px) dock their details in `auto` mode. */
export const DOCK_MAX_WIDTH = 480;

/** Minimum height (px) of a touch target, and the snap radius of a tap. */
export const TOUCH_TARGET = 44;

/** A finger as the primary pointer, or a phone-sized viewport: the device, not the chart's width. */
const DOCK_QUERY = `(pointer: coarse), (max-width: ${DOCK_MAX_WIDTH}px)`;

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DOCK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True on a coarse pointer or a viewport of 480px or less; false during SSR. */
export function useDockDevice(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DOCK_QUERY).matches,
    () => false,
  );
}

/** Whether details dock for `mode` on this device (`device` is `useDockDevice()`). */
export function resolveDocked(mode: ChartDockMode, device: boolean): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return device;
}

/**
 * Classes that show the reserved panel for `mode` without JavaScript, so server markup already
 * holds the space on a phone: always visible for `always`, on a coarse pointer or a viewport of
 * 480px or less for `auto`.
 */
export const DOCK_SLOT_VISIBILITY: Record<Exclude<ChartDockMode, "never">, string> = {
  always: "block",
  auto: "hidden [@media(pointer:coarse)]:block [@media(max-width:480px)]:block",
};

export interface ChartDockValue {
  /** Element under the plot that receives docked details; null when the frame never docks. */
  slot: HTMLElement | null;
  docked: boolean;
  /** Announces docked details to screen readers; ignored for mouse hover, debounced. */
  announce: (text: string) => void;
}

const ChartDockContext = createContext<ChartDockValue>({
  slot: null,
  docked: false,
  announce: () => {},
});

export const ChartDockProvider = ChartDockContext.Provider;

/** Dock state of the enclosing `ChartFrame`. */
export function useChartDock(): ChartDockValue {
  return useContext(ChartDockContext);
}
