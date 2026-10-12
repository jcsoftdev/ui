import { toCss } from "./css.ts";
import type { Theme } from "./types.ts";

let counter = 0;

/**
 * Applies a theme to `el` and its subtree by injecting a scoped `<style>` element and tagging the
 * element with `data-ui-theme`. This is the only module in the package that touches the DOM.
 * Returns a function that removes the theme again.
 */
export function applyTheme(theme: Theme, el: Element): () => void {
  const doc = el.ownerDocument;
  const id = el.getAttribute("data-ui-theme") ?? `t${++counter}`;
  const existing = doc.head.querySelector(`style[data-ui-theme-style="${id}"]`);
  const style = existing ?? doc.createElement("style");
  style.setAttribute("data-ui-theme-style", id);
  style.textContent = toCss(theme, { selector: `[data-ui-theme="${id}"]` });
  if (!existing) doc.head.append(style);
  el.setAttribute("data-ui-theme", id);
  return () => {
    style.remove();
    if (el.getAttribute("data-ui-theme") === id) el.removeAttribute("data-ui-theme");
  };
}
