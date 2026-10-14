import { adoptStyles, rootOf } from "../internal/base.js";
import type { GanttZoom, UiGantt } from "./gantt.js";
import css from "./gantt-toolbar.css.js";

/** Zoom levels offered by default (React's toolbar offers these five). */
const DEFAULT_LEVELS: readonly GanttZoom[] = ["day", "week", "month", "quarter", "year"];
const LABELS: Record<GanttZoom, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

export interface GanttToolbar {
  readonly element: HTMLElement;
  /** Re-reads the attributes and texts of the chart. */
  update(): void;
}

/**
 * The chart's toolbar: a zoom-level switch and a Today button. It is a lazy part of `<ui-gantt>`
 * (loaded only while `toolbar` is not `off`), so it adds nothing to the chart's first load.
 * `zoom-levels` (space separated) chooses the levels; `texts.zoomLevels` renames them.
 */
export function mountGanttToolbar(host: UiGantt): GanttToolbar {
  adoptStyles(rootOf(host), css);
  const element = document.createElement("div");
  element.dataset.uiPart = "toolbar";
  const levels = document.createElement("div");
  levels.dataset.uiPart = "levels";
  levels.setAttribute("role", "group");
  const today = document.createElement("button");
  today.type = "button";
  today.dataset.uiPart = "today";
  element.append(levels, today);

  let shown = "";
  const update = () => {
    const texts = host.resolvedTexts;
    const wanted = (host.getAttribute("zoom-levels") ?? "").split(/[\s,]+/).filter(Boolean);
    const list = (wanted.length ? wanted : DEFAULT_LEVELS).filter(
      (level): level is GanttZoom => level in LABELS,
    );
    levels.setAttribute("aria-label", texts.zoomLabel ?? "Zoom");
    const signature = `${list.join()}|${JSON.stringify(texts.zoomLevels ?? "")}`;
    if (signature !== shown) {
      shown = signature;
      levels.replaceChildren(
        ...list.map((level) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.zoom = level;
          button.textContent = texts.zoomLevels?.[level] ?? LABELS[level];
          return button;
        }),
      );
    }
    for (const button of levels.children)
      button.setAttribute(
        "aria-pressed",
        String((button as HTMLElement).dataset.zoom === host.zoom),
      );
    today.textContent = texts.today;
    today.hidden = ["off", "false"].includes(host.getAttribute("today") ?? "");
  };
  levels.addEventListener("click", (event) => {
    const level = (event.target as Element).closest<HTMLElement>("[data-zoom]")?.dataset.zoom;
    if (level) host.zoom = level as GanttZoom;
  });
  today.addEventListener("click", () => host.scrollToToday());
  host.addEventListener("gantt-zoom", update);
  update();
  return { element, update };
}
