import { adoptStyles, rootOf } from "./base.js";
import css from "./chart-state.css.js";

/**
 * The loading and empty screens of a chart. A separate chunk: a chart that never shows either
 * state never downloads this code or its stylesheet.
 */
export function stateNode(
  host: HTMLElement,
  kind: "loading" | "empty",
  text: string,
  skeleton: string,
): HTMLElement {
  adoptStyles(rootOf(host), css);
  const node = document.createElement("div");
  node.dataset.uiPart = "state";
  node.dataset.state = kind;
  node.setAttribute("role", "status");
  if (kind === "loading") {
    node.setAttribute("aria-label", text);
    node.dataset.skeleton = skeleton;
    for (const h of skeleton === "bars" ? [40, 70, 55, 85, 60, 95, 75] : [100]) {
      const bar = document.createElement("i");
      if (skeleton === "bars") bar.style.height = `${h}%`;
      node.append(bar);
    }
  } else node.textContent = text;
  return node;
}
