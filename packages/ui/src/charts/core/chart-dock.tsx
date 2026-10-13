"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/** How a chart's details are shown: `auto` docks on narrow containers and coarse pointers. */
export type ChartDockMode = "auto" | "always" | "never";

/** Containers up to this width (px) dock their details in `auto` mode. */
export const DOCK_MAX_WIDTH = 480;

/** Minimum height (px) of a touch target, and the snap radius of a tap. */
export const TOUCH_TARGET = 44;

const COARSE = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(COARSE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True when the primary pointer is a finger; false during SSR. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

/** Whether details dock for `mode` at this container width and pointer. */
export function resolveDocked(mode: ChartDockMode, width: number, coarse: boolean): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return width <= DOCK_MAX_WIDTH || coarse;
}

export interface ChartDockValue {
  /** Element under the plot that receives docked details; null when the frame does not dock. */
  slot: HTMLElement | null;
  docked: boolean;
}

const ChartDockContext = createContext<ChartDockValue>({ slot: null, docked: false });

export const ChartDockProvider = ChartDockContext.Provider;

/** Dock state of the enclosing `ChartFrame`. */
export function useChartDock(): ChartDockValue {
  return useContext(ChartDockContext);
}
