import { observeResize } from "@jcsoftdev/ui-core/observe/resize";

/** Container width (px) below which the app shell is compact: the sidebar becomes a drawer. */
export const SHELL_BREAKPOINT = 900;

/** The `<ui-app-shell>` an element lives in, if any. */
export const shellOf = (element: Element): (HTMLElement & { compact: boolean }) | null =>
  element.closest<HTMLElement & { compact: boolean }>('[data-ui="app-shell"]');

/**
 * Reports whether the container of `host` is compact, now and on every resize. Inside an app shell
 * it follows the shell; elsewhere it measures the parent element, like the React kit's
 * `useCompactContainer`. Returns the cleanup.
 */
export function watchCompact(host: HTMLElement, onChange: (compact: boolean) => void): () => void {
  const shell = shellOf(host);
  if (shell) {
    const read = () => onChange(shell.compact);
    shell.addEventListener("compact-change", read);
    read();
    return () => shell.removeEventListener("compact-change", read);
  }
  const parent = host.parentElement;
  if (!parent) return () => {};
  const measure = () => onChange(parent.getBoundingClientRect().width < SHELL_BREAKPOINT);
  measure();
  return observeResize(parent, measure);
}

const SVG = "http://www.w3.org/2000/svg";

/** A 24-unit stroke icon from one or more path `d` strings, `aria-hidden`. */
export function icon(...paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
