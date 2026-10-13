"use client";

import { type Ref, type RefCallback, useEffect, useState } from "react";
import { useComposedRefs } from "../utils/compose.js";

/**
 * Gives a glass component its lens. Put the returned ref on the surface element (it composes the
 * ref you pass in, so a changed ref or a React 19 ref cleanup keeps working). This hook only holds
 * the element: once it is mounted, the watcher (`./lens-watch.js`, a small lazy chunk) is imported
 * and decides. While the surface resolves to a liquid material, the engine (`./refraction.js`,
 * another lazy chunk) is imported and applied; a frosted or solid surface never loads it. The
 * decision follows the page: it is re-evaluated when the element's classes or `data-glass`
 * change, when an ancestor's `data-glass`, `data-glass-lens`, `data-style` or class change (the
 * theme-level switch, an opt-out, a nested glass), and when a transparency, contrast or motion
 * preference changes. Pass `data-glass-lens="off"` on the element or an ancestor, or set
 * `--glass-lens: 0` in CSS, to keep the plain liquid look.
 *
 * `ownInteractive` (the overlays: dialog, popover, sidebar, drawer): the lens's pointer mode
 * (`--liquid-interactive`) is read only from the surface itself, so a scope or theme above it
 * cannot make it pressable or draggable.
 */
export function useGlassLens<T extends HTMLElement>(
  forwarded?: Ref<T>,
  { ownInteractive = false }: { ownInteractive?: boolean } = {},
): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const ref = useComposedRefs<T>(forwarded, setElement);
  useEffect(() => {
    if (!element) return;
    let stop: (() => void) | undefined;
    let gone = false;
    import("./lens-watch.js").then(({ watchGlassLens }) => {
      if (!gone) stop = watchGlassLens(element, ownInteractive);
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [element, ownInteractive]);
  return ref;
}
