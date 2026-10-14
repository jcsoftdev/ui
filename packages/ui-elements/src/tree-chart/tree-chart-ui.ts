import { adoptStyles, rootOf } from "../internal/base.js";
import { svg } from "../internal/chart-dom.js";
import type { TreeLabels } from "../internal/tree-labels.js";
import css from "./tree-chart-ui.css.js";

/** What the zoom toolbar and the search box need from the chart. */
export interface TreeBridge {
  /** The consumer's labels over the chart's core ones; the toolbar and search defaults are below. */
  labels: Partial<TreeLabels> & Pick<TreeLabels, "of">;
  controls: boolean;
  searchable: boolean;
  /** Show the wheel hint under the drawing. */
  hint: boolean;
  zoomBy(factor: number): void;
  fit(): void;
  search(query: string): void;
  step(delta: number): void;
}

export interface TreeUiState {
  zoom: number;
  query: string;
  count: number;
  index: number;
}

export interface TreeUi {
  sync(state: TreeUiState): void;
  destroy(): void;
}

const UI_LABELS = {
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit to view",
  controls: "Zoom controls",
  zoomHint: "Drag to pan · Ctrl + wheel to zoom",
  search: "Search",
  searchPrevious: "Previous match",
  searchNext: "Next match",
  noMatches: "No matches",
};

const ICONS = {
  minus: "M5 12h14",
  plus: "M5 12h14M12 5v14",
  fit: "M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
};

const icon = (path: string, size = 16) =>
  svg(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    },
    svg("path", { d: path }),
  );

const button = (label: string, path: string, onClick: () => void, size?: number) => {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", label);
  el.title = label;
  el.append(icon(path, size));
  el.addEventListener("click", onClick);
  return el;
};

/**
 * The zoom toolbar, the search box and the wheel hint of `<ui-tree-chart>`. A lazy chunk: a chart
 * with `controls="off"` and no `searchable` never loads it. The pieces sit over the drawing, are
 * ignored by its hit test (`data-tree-ui`) and stop their pointer events so a press on them never
 * starts a pan.
 */
export function mountUi(drawing: HTMLElement, bridge: TreeBridge): TreeUi {
  adoptStyles(rootOf(drawing), css);
  const labels = { ...UI_LABELS, ...bridge.labels };
  const parts: HTMLElement[] = [];
  const shield = (el: HTMLElement) => {
    for (const type of ["pointerdown", "pointerup", "dblclick", "wheel"])
      el.addEventListener(type, (event) => event.stopPropagation());
    parts.push(el);
    drawing.append(el);
    return el;
  };
  let zoomText: HTMLElement | undefined;
  let status: HTMLElement | undefined;
  let input: HTMLInputElement | undefined;
  let previous: HTMLButtonElement | undefined;
  let next: HTMLButtonElement | undefined;

  if (bridge.searchable) {
    const box = document.createElement("div");
    box.dataset.treeUi = "search";
    box.setAttribute("role", "search");
    input = document.createElement("input");
    input.type = "search";
    input.placeholder = labels.search;
    input.setAttribute("aria-label", labels.search);
    input.addEventListener("input", () => bridge.search((input as HTMLInputElement).value));
    input.addEventListener("keydown", (event) => {
      // Typing here is not a chart shortcut and not the chart's keyboard.
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        bridge.step(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape" && input?.value) {
        input.value = "";
        bridge.search("");
      }
    });
    status = document.createElement("span");
    status.dataset.part = "count";
    status.setAttribute("aria-live", "polite");
    previous = button(labels.searchPrevious, ICONS.up, () => bridge.step(-1), 12);
    next = button(labels.searchNext, ICONS.down, () => bridge.step(1), 12);
    box.append(
      icon("m20 20-3.5-3.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z", 14),
      input,
      status,
      previous,
      next,
    );
    shield(box);
  }
  if (bridge.controls) {
    const tools = document.createElement("div");
    tools.dataset.treeUi = "tools";
    tools.setAttribute("role", "toolbar");
    tools.setAttribute("aria-label", labels.controls);
    zoomText = document.createElement("span");
    zoomText.dataset.part = "zoom";
    zoomText.setAttribute("aria-hidden", "true");
    tools.append(
      zoomText,
      button(labels.zoomOut, ICONS.minus, () => bridge.zoomBy(1 / 1.25)),
      button(labels.zoomIn, ICONS.plus, () => bridge.zoomBy(1.25)),
      button(labels.fit, ICONS.fit, () => bridge.fit()),
    );
    shield(tools);
  }
  if (bridge.hint) {
    const hint = document.createElement("p");
    hint.dataset.treeHint = "";
    hint.textContent = labels.zoomHint;
    parts.push(hint);
    drawing.append(hint);
  }

  let last = "";
  return {
    sync(state) {
      // The toolbar and the box show again after the drawing was emptied by a state screen.
      for (const part of parts) if (!part.isConnected) drawing.append(part);
      const key = JSON.stringify(state);
      if (key === last) return;
      last = key;
      const { zoom, query, count, index } = state;
      if (zoomText) zoomText.textContent = `${Math.round(zoom * 100)}%`;
      if (input && input.value !== query) input.value = query;
      if (status)
        status.textContent = !query
          ? ""
          : count > 0
            ? `${index + 1} ${labels.of} ${count}`
            : labels.noMatches;
      if (previous && next) previous.disabled = next.disabled = count === 0;
    },
    destroy() {
      for (const part of parts) part.remove();
    },
  };
}
