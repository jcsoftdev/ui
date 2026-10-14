// The shared legend of `ui-chart-grid`, built the first time a legend is set.
import { swatch } from "../internal/chart-dom.js";
import type { MarkShape } from "../internal/chart-protocol.js";

export interface LegendItem {
  id: string;
  name: string;
  color: string;
  shape?: MarkShape;
}

/** A plain CSS color or `var()`; anything else (a `url()`, a smuggled declaration) is dropped. */
const safe = (color: string) =>
  typeof CSS !== "undefined" && CSS.supports("color", color) ? color : "var(--ink-3)";

/**
 * One toggle button per item. Hovering or focusing an item highlights it; pressing it keeps the
 * highlight (`aria-pressed`) until it is pressed again. `set(id)` reports the item to highlight,
 * `null` for none.
 */
export function buildLegend(items: readonly LegendItem[], set: (id: string | null) => void) {
  const legend = document.createElement("div");
  legend.dataset.uiPart = "legend";
  let pinned: string | null = null;
  let over: string | null = null;
  const buttons = new Map<string, HTMLButtonElement>();
  const apply = () => {
    for (const [id, button] of buttons) button.setAttribute("aria-pressed", `${id === pinned}`);
    set(over ?? pinned);
  };
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = item.id;
    const name = document.createElement("span");
    name.textContent = item.name;
    button.append(swatch(safe(item.color), item.shape), name);
    buttons.set(item.id, button);
    legend.append(button);
  }
  const idOf = (event: Event) =>
    (event.target as Element).closest<HTMLElement>("button")?.dataset.id ?? null;
  legend.addEventListener("pointerover", (event) => {
    over = idOf(event);
    apply();
  });
  legend.addEventListener("pointerleave", () => {
    over = null;
    apply();
  });
  legend.addEventListener("focusin", (event) => {
    over = idOf(event);
    apply();
  });
  legend.addEventListener("focusout", () => {
    over = null;
    apply();
  });
  legend.addEventListener("click", (event) => {
    const id = idOf(event);
    pinned = id === null || id === pinned ? null : id;
    apply();
  });
  apply();
  return legend;
}
