// The pointer and keyboard handlers of the drawing, and the focus that follows a node. Lazy: bound
// with the input chunk, right after the first draw.
import { emit } from "../internal/base.js";
import type { TreeChartNode } from "../internal/tree-model.js";

/** The chart as the handlers see it. */
type TreeHost = HTMLElement & {
  toggle(id: string): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
};

/** What the handlers ask of the chart beyond its public methods. */
export interface TreeEvents {
  selectable(): boolean;
  nodeOf(id: string): TreeChartNode | undefined;
  /** Pans a node reached with the keyboard into view. */
  reveal(id: string): void;
}

const toggleOf = (event: Event) =>
  (event.target as Element | null)?.closest?.("[data-toggle]") ?? null;

export function bindEvents(
  host: TreeHost,
  drawing: HTMLElement,
  signal: AbortSignal,
  chart: TreeEvents,
): void {
  let press: { x: number; y: number; dragged: boolean } | undefined;
  let dragged = false;
  const capture = { capture: true, signal };
  // A drag pans: it is claimed (`preventDefault`) so it never becomes a selection. A press on a
  // toggle button is claimed too, and its click expands or collapses the node.
  drawing.addEventListener(
    "pointerdown",
    (event) => {
      if ((event.target as Element).closest?.("[data-tree-ui]")) return;
      press = { x: event.clientX, y: event.clientY, dragged: false };
      dragged = false;
      if (toggleOf(event)) event.preventDefault();
    },
    capture,
  );
  drawing.addEventListener(
    "pointermove",
    (event) => {
      if (!press || press.dragged) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) return;
      press.dragged = true;
      host.toggleAttribute("data-panning", true);
    },
    capture,
  );
  const release = (event: Event) => {
    if (press?.dragged) {
      dragged = true;
      event.preventDefault();
      // The click that ends a drag arrives right after this event.
      setTimeout(() => {
        dragged = false;
      });
    }
    press = undefined;
    host.removeAttribute("data-panning");
  };
  drawing.addEventListener("pointerup", release, capture);
  drawing.addEventListener("pointercancel", release, capture);
  // A click on a node is `node-click`, then it expands or collapses the node (cancel the event to
  // do something else) or, with `selectable`, pins it (the base pins on the mouse click itself).
  // A double click is two clicks: the base's double-click drill is switched off.
  drawing.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      if (target.closest?.("[data-tree-ui]")) return;
      const toggle = toggleOf(event);
      const selectable = chart.selectable();
      if (toggle || !selectable) event.preventDefault();
      if (dragged) return;
      if (toggle) return host.toggle(toggle.getAttribute("data-id") ?? "");
      const id = target.closest?.("[data-card]")?.getAttribute("data-id") ?? "";
      const node = chart.nodeOf(id);
      if (node && emit(host, "node-click", { id, node }, true) && !selectable) host.toggle(id);
    },
    capture,
  );
  drawing.addEventListener("dblclick", (event) => event.preventDefault(), capture);
  drawing.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element).closest?.("[data-tree-ui]")) return;
      if (event.key === "+" || event.key === "=") host.zoomIn();
      else if (event.key === "-" || event.key === "_") host.zoomOut();
      else if (event.key === "0") host.fit();
      else return;
      event.preventDefault();
    },
    { signal },
  );
  drawing.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as Element;
      if (target.matches?.("[data-card]") && target.matches(":focus-visible"))
        chart.reveal(target.getAttribute("data-id") ?? "");
    },
    { signal },
  );
}

/**
 * Keeps keyboard focus on the same node across a change of the visible set: on `wanted`, or on its
 * nearest visible ancestor when it folded away. `index` holds the visible ids.
 */
export function keepFocus(
  drawing: HTMLElement,
  cards: ReadonlyMap<string, Element>,
  index: ReadonlyMap<string, number>,
  parentOf: (id: string) => string | undefined,
  wanted: string | undefined,
  focusedId: string | undefined,
  before: readonly string[],
): void {
  let id = wanted;
  while (id && !index.has(id)) id = parentOf(id);
  if (!id) return;
  const target = id;
  const oldIndex = focusedId ? before.indexOf(focusedId) : -1;
  queueMicrotask(() => {
    const el = cards.get(target) as SVGElement | undefined;
    if (!el?.isConnected) return;
    const current = document.activeElement;
    if (current === el && oldIndex === index.get(target)) return;
    for (const card of cards.values()) card.setAttribute("tabindex", card === el ? "0" : "-1");
    if (current !== el && (drawing.contains(current) || current === document.body))
      el.focus({ preventScroll: true });
    else if (current === el && oldIndex !== index.get(target)) {
      // The index of the focused node changed: refocus so the details follow the node.
      el.blur();
      el.focus({ preventScroll: true });
    }
  });
}
