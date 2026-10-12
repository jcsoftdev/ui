"use client";

import { useEffect, useRef } from "react";
import { applyGlassRefraction, type GlassRefractionOptions } from "./refraction.js";

/**
 * Ref to put on a glass surface to opt it into lensing (see {@link applyGlassRefraction}).
 * `enabled={false}` keeps the plain blur.
 */
export function useGlassRefraction<T extends HTMLElement = HTMLElement>(
  options: GlassRefractionOptions & { enabled?: boolean } = {},
) {
  const ref = useRef<T>(null);
  const { enabled = true, scale, bezel, refraction } = options;
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    return applyGlassRefraction(element, { scale, bezel, refraction });
  }, [enabled, scale, bezel, refraction]);
  return ref;
}
