"use client";

import { useCallback, useEffect, useRef } from "react";
import { overlayLayers } from "./layer-stack.js";

/** Registers an overlay in the global layer stack while `active`; `isTop()` is stable. */
export function useLayer(active: boolean): () => boolean {
  const layer = useRef({});
  useEffect(() => {
    if (!active) return;
    return overlayLayers.push(layer.current);
  }, [active]);
  return useCallback(() => overlayLayers.isTop(layer.current), []);
}
