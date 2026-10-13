import { computePlacement } from "@jcsoftdev/ui-core/popper";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { swatch } from "../internal/chart-dom.js";
import {
  bindChart,
  CHART_EVENT,
  type ChartHost,
  type HoverInfo,
} from "../internal/chart-protocol.js";
import css from "./chart-tooltip.css.js";

const OFFSET = 14;
const EDGE = 4;

/**
 * `<ui-chart-tooltip>`: the floating card that lists every series at the hovered category, for the
 * chart it sits in (or the one `for` names; it moves itself inside that chart). Purely visual
 * (`aria-hidden`): screen readers get the same numbers from the focusable marks and the data table.
 * It follows `chart-hover` events, which fire once per category, never per pixel, and it never takes
 * the pointer (`pointer-events: none`), so showing it cannot change what is under the cursor. It
 * is placed with ui-core's `computePlacement`: beside the mark, flipped when that side has no room
 * and kept inside the drawing area. Keyboard focus on a mark positions it the same way.
 * Attributes: `for` (chart id), `side` (`right` default, or `left`; used when the chart gives no side).
 */
export class UiChartTooltip extends ElementBase {
  static observedAttributes = ["for"];
  #unbind: (() => void) | undefined;
  #title = document.createElement("div");
  #body = document.createElement("div");
  #rows = document.createElement("div");
  #frame = 0;

  constructor() {
    super();
    this.#title.dataset.uiPart = "title";
    this.#body.dataset.uiPart = "body";
    this.#rows.dataset.uiPart = "rows";
  }

  connectedCallback(): void {
    this.dataset.ui = "chart-tooltip";
    this.setAttribute("aria-hidden", "true");
    adoptStyles(rootOf(this), css);
    this.append(this.#title, this.#body, this.#rows);
    this.#unbind = bindChart(this, (chart) => {
      // Coordinates are relative to the chart's positioned host, so the card must live in it.
      if (!chart.contains(this)) {
        queueMicrotask(() => chart.append(this));
        return () => {};
      }
      const onHover = (event: Event) =>
        this.#show(chart, (event as CustomEvent<HoverInfo | null>).detail);
      chart.addEventListener(CHART_EVENT.hover, onHover);
      return () => {
        chart.removeEventListener(CHART_EVENT.hover, onHover);
        this.#hide();
      };
    });
  }

  disconnectedCallback(): void {
    this.#unbind?.();
    cancelAnimationFrame(this.#frame);
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unbind?.();
    this.connectedCallback();
  }

  #hide(): void {
    this.removeAttribute("data-open");
    this.removeAttribute("data-ready");
    cancelAnimationFrame(this.#frame);
  }

  #show(chart: ChartHost, info: HoverInfo | null): void {
    if (!info) {
      this.#hide();
      return;
    }
    this.#title.textContent = info.title ?? "";
    this.#title.hidden = !info.title;
    this.#body.textContent = info.body ?? "";
    this.#body.hidden = !info.body;
    this.#rows.replaceChildren(
      ...info.rows.map((row) => {
        const line = document.createElement("div");
        line.dataset.uiPart = "row";
        line.toggleAttribute("data-emphasis", !!row.emphasis);
        const name = document.createElement("span");
        name.textContent = row.name;
        const value = document.createElement("b");
        value.textContent = row.value;
        line.append(
          row.emphasis ? document.createElement("i") : swatch(row.color, row.shape),
          name,
          value,
        );
        if (row.note) {
          const note = document.createElement("small");
          note.textContent = row.note;
          line.append(note);
        }
        return line;
      }),
    );
    this.#place(chart, info);
    if (!this.hasAttribute("data-open")) {
      this.setAttribute("data-open", "");
      // Slide between categories only once the card is already on screen, never from the corner.
      this.#frame = requestAnimationFrame(() => this.setAttribute("data-ready", ""));
    }
  }

  #place(chart: ChartHost, info: HoverInfo): void {
    const { drawing } = chart;
    const left = drawing.offsetLeft;
    const top = drawing.offsetTop;
    const side = this.getAttribute("side") === "left" ? "left" : "right";
    const placement = computePlacement({
      anchor: { x: left + info.x, y: top + info.y, width: 0, height: 0 },
      content: { width: this.offsetWidth, height: this.offsetHeight },
      boundary: { x: left, y: top, width: drawing.clientWidth, height: drawing.clientHeight },
      side: info.side ?? side,
      align: "center",
      sideOffset: OFFSET,
      collisionPadding: EDGE,
    });
    this.style.transform = `translate3d(${Math.round(placement.x)}px, ${Math.round(placement.y)}px, 0)`;
    this.dataset.side = placement.side;
  }
}

/** Registers `<ui-chart-tooltip>` (or `<prefix>-chart-tooltip`) and returns the tag. */
export function defineChartTooltip(options?: DefineOptions): string {
  return defineElement("chart-tooltip", UiChartTooltip, options);
}
