import { adoptStyles, rootOf } from "../internal/base.js";
import { svg } from "../internal/chart-dom.js";
import type { ChartHost, HoverInfo } from "../internal/chart-protocol.js";
import css from "./sparkline-value.css.js";

const parts = new WeakMap<HTMLElement, { pill: HTMLElement; dot?: SVGCircleElement }>();

/**
 * The value pill and the point marker of a sparkline, in a chunk of their own: nothing here is
 * downloaded until the first hover, focus or tap.
 */
export function showValue(host: ChartHost, info: HoverInfo | null): void {
  let state = parts.get(host);
  if (!state && !info) return;
  if (!state) {
    adoptStyles(rootOf(host), css);
    const pill = document.createElement("div");
    pill.dataset.uiPart = "value";
    pill.setAttribute("aria-hidden", "true");
    host.append(pill);
    state = { pill };
    parts.set(host, state);
  }
  const { pill } = state;
  const root = host.exportSvgs()[0];
  if (state.dot && state.dot.parentNode !== root) state.dot = undefined;
  if (state.dot) state.dot.style.display = info ? "" : "none";
  pill.hidden = !info;
  if (!info || !root) return;
  const row = info.rows[0];
  if (!state.dot) {
    state.dot = svg("circle", { r: 3.5, "stroke-width": 2, "pointer-events": "none" });
    root.append(state.dot);
  }
  state.dot.style.cssText = `fill:${row?.color};stroke:var(--surface)`;
  state.dot.setAttribute("cx", `${info.x}`);
  state.dot.setAttribute("cy", `${info.y}`);
  pill.textContent = `${info.title ? `${info.title} ` : ""}${row?.value ?? ""}`;
  const half = pill.offsetWidth / 2 + 4;
  const width = host.drawing.clientWidth;
  const x = Math.min(Math.max(info.x, half), Math.max(half, width - half));
  pill.style.left = `${host.drawing.offsetLeft + x}px`;
}
