import { supportsBackdropRefraction } from "./support.js";

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
 * Applies the lens engine to `element` while it resolves to a liquid material, and follows the
 * page: the element's and its ancestors' classes and glass attributes, and the transparency,
 * contrast and motion preferences. The engine (`./refraction.js`) is its own lazy chunk, imported
 * the first time the surface is liquid. Returns the cleanup.
 */
export function watchGlassLens(element: HTMLElement, ownInteractive: boolean): () => void {
  if (typeof getComputedStyle !== "function") return () => {};
  let stop: (() => void) | undefined;
  let loading = false;
  let gone = false;
  // Where the engine cannot paint (Safari, Firefox) it would never install: it is not even loaded.
  const wants = () =>
    supportsBackdropRefraction() &&
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
        if (!gone && wants()) stop = applyGlassRefraction(element, { auto: true, ownInteractive });
      });
    }
  };
  check();
  const observer = typeof MutationObserver === "function" ? new MutationObserver(check) : undefined;
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
}
