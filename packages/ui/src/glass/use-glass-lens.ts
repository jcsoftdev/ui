"use client";

import { type Ref, type RefCallback, useCallback, useEffect, useRef, useState } from "react";

function assign<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * Gives a glass component its lens. Put the returned ref on the surface element (it forwards the
 * ref you pass in). When the surface resolves to a liquid material, the engine
 * (`./refraction.js`, a separate lazy chunk) is imported and applied; a frosted or solid surface
 * never loads it, so the cost is this file only. Pass `data-glass-lens="off"` on the element, or
 * set `--glass-lens: 0` in CSS, to keep the plain liquid look.
 */
export function useGlassLens<T extends HTMLElement>(forwarded?: Ref<T>): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const forward = useRef(forwarded);
  forward.current = forwarded;
  useEffect(() => {
    if (!element || typeof getComputedStyle !== "function" || element.dataset.glassLens === "off")
      return;
    if (getComputedStyle(element).getPropertyValue("--glass-lens").trim() !== "1") return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("./refraction.js").then(({ applyGlassRefraction }) => {
      if (!cancelled) stop = applyGlassRefraction(element, { auto: true });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [element]);
  return useCallback((value: T | null) => {
    setElement(value);
    assign(forward.current, value);
  }, []);
}
