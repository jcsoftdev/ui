"use client";

import { type Ref, type RefCallback, useEffect, useState } from "react";
import { useComposedRefs } from "../utils/compose.js";

/** Preferences that flip the `--glass-lens` flag in CSS; the engine is brought back when cleared. */
const PREFERENCES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
  "(prefers-reduced-motion: reduce)",
];
/** What can change whether a surface resolves to a liquid material. */
const WATCHED = ["class", "data-glass", "data-glass-lens", "data-style", "data-theme"];

/**
 * Gives a glass component its lens. Put the returned ref on the surface element (it composes the
 * ref you pass in, so a changed ref or a React 19 ref cleanup keeps working). While the surface
 * resolves to a liquid material, the engine (`./refraction.js`, a separate lazy chunk) is imported
 * and applied; a frosted or solid surface never loads it, so the cost is this file only. The
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
    if (!element || typeof getComputedStyle !== "function") return;
    let stop: (() => void) | undefined;
    let loading = false;
    let gone = false;
    const wants = () =>
      !element.closest('[data-glass-lens="off"]') &&
      getComputedStyle(element).getPropertyValue("--glass-lens").trim() === "1";
    const check = () => {
      if (gone) return;
      const want = wants();
      if (!want) {
        stop?.();
        stop = undefined;
      } else if (!stop && !loading) {
        loading = true;
        import("./refraction.js").then(({ applyGlassRefraction }) => {
          loading = false;
          // It may have stopped being wanted while the chunk loaded; the next change re-checks.
          if (!gone && wants())
            stop = applyGlassRefraction(element, { auto: true, ownInteractive });
        });
      }
    };
    check();
    const observer =
      typeof MutationObserver === "function" ? new MutationObserver(check) : undefined;
    for (let node: Element | null = element; node; node = node.parentElement)
      observer?.observe(node, { attributes: true, attributeFilter: WATCHED });
    const lists =
      typeof matchMedia === "function" ? PREFERENCES.map((query) => matchMedia(query)) : [];
    for (const list of lists) list.addEventListener("change", check);
    return () => {
      gone = true;
      observer?.disconnect();
      for (const list of lists) list.removeEventListener("change", check);
      stop?.();
    };
  }, [element, ownInteractive]);
  return ref;
}
