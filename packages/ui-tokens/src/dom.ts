import { toCss } from "./css.ts";
import type { Theme } from "./types.ts";

const ATTR = "data-ui-theme";
const STYLE_ATTR = "data-ui-theme-style";

// Random rather than a module-level counter: two copies of this module (a duplicated dependency,
// a microfrontend) would otherwise both hand out `t1` and overwrite each other's style element.
const uniqueId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `t${uuid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;
};

/**
 * Applies a theme to `el` and its subtree by injecting a scoped `<style>` element and tagging the
 * element with `data-ui-theme`. This is the only module in the package that touches the DOM.
 * Each call owns its own style element. Applying again to the same element replaces the previous
 * theme; the returned function removes only what its own call added.
 */
export function applyTheme(theme: Theme, el: Element): () => void {
  const doc = el.ownerDocument;
  const previous = el.getAttribute(ATTR);
  if (previous) doc.head.querySelector(`style[${STYLE_ATTR}="${previous}"]`)?.remove();
  const id = uniqueId();
  const style = doc.createElement("style");
  style.setAttribute(STYLE_ATTR, id);
  style.textContent = toCss(theme, { selector: `[${ATTR}="${id}"]` });
  doc.head.append(style);
  el.setAttribute(ATTR, id);
  return () => {
    style.remove();
    if (el.getAttribute(ATTR) === id) el.removeAttribute(ATTR);
  };
}
