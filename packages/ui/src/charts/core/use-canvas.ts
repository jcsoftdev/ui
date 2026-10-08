"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Bumps whenever the theme or accent changes (`data-theme` / `data-accent` on
 * `<html>`), so canvas layers that bake token colors into pixels repaint.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setVersion((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class"],
    });
    return () => observer.disconnect();
  }, []);
  return version;
}

/**
 * Resolves CSS colors (`var(--token)`, `color-mix(...)`) to a string a canvas
 * understands, using the cascade of `host`. Unresolvable values are returned
 * unchanged.
 */
export function resolveCssColors(host: Element, colors: readonly string[]): string[] {
  if (typeof document === "undefined") return [...colors];
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  host.appendChild(probe);
  try {
    return colors.map((color) => {
      probe.style.color = "";
      probe.style.color = color;
      return probe.style.color ? getComputedStyle(probe).color : color;
    });
  } finally {
    host.removeChild(probe);
  }
}

export interface CanvasPaint {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Resolve a CSS color once per paint (cached by the caller if needed). */
  resolve: (colors: readonly string[]) => string[];
}

/**
 * Sizes a canvas for the device pixel ratio and repaints it whenever `deps`
 * or the theme change. `paint` draws in CSS pixels.
 */
export function useCanvasPaint(
  ref: RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
  paint: (frame: CanvasPaint) => void,
  deps: readonly unknown[],
): void {
  const theme = useThemeVersion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `deps` is the caller's dependency list.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ratio = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paint({ ctx, width, height, resolve: (colors) => resolveCssColors(canvas, colors) });
  }, [ref, width, height, theme, ...deps]);
}
