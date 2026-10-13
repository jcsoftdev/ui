import { computePlacement } from "@jcsoftdev/ui-core/popper";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  hasPopover,
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
/** A chart narrower than this (px) docks the details panel under the drawing. */
const DOCK_WIDTH = 480;

/**
 * `<ui-chart-tooltip>`: the details of the hovered, focused or pinned mark of the chart it sits in
 * (or the one `for` names): every series at that category. Purely visual (`aria-hidden`); screen
 * readers get the same numbers from the marks, the polite live region of a pinned selection and
 * the data table. It follows `chart-hover` events, which fire once per mark and never per pixel,
 * and never takes the pointer (`pointer-events: none`), so showing it cannot change what is under
 * the cursor.
 *
 * Two layouts. On a wide chart with a fine pointer it floats beside the mark: a manual popover in
 * the top layer, placed in viewport coordinates with ui-core's `computePlacement`, flipped when a
 * side has no room and kept inside the drawing area, so it works from anywhere in the DOM and is
 * never clipped by an `overflow` ancestor. When the chart is at most 480px wide or the primary
 * pointer is coarse it docks instead: a full-width panel under the drawing, in the flow (so a finger
 * never covers it and nothing is clipped), larger text, its space reserved so the page does not jump.
 * While it floats it follows the chart on page scroll, scroll containers and visual viewport
 * changes (re-placed at most once per frame) and hides while the chart is out of view. Docked, it
 * reserves room for `DrawResult.maxHoverRows` rows, so the content below it never moves.
 * Attributes: `for` (chart id), `side` (`right` default, `left`, `top` or `bottom`; used when the
 * chart gives no side), `dock` (`auto` default, `always`, `never`).
 */
export class UiChartTooltip extends ElementBase {
  static observedAttributes = ["for", "dock"];
  #unbind: (() => void) | undefined;
  #title = document.createElement("div");
  #body = document.createElement("div");
  #rows = document.createElement("div");
  #frame = 0;
  #chart: ChartHost | undefined;
  #observer: ResizeObserver | undefined;
  #pointer: MediaQueryList | undefined;
  #info: HoverInfo | null = null;
  #docked: boolean | undefined;
  #follow: (() => void) | undefined;
  #following = false;

  constructor() {
    super();
    this.#title.dataset.uiPart = "title";
    this.#body.dataset.uiPart = "body";
    this.#rows.dataset.uiPart = "rows";
  }

  /** True while the details are docked in the flow instead of floating. */
  get docked(): boolean {
    return this.hasAttribute("data-docked");
  }

  connectedCallback(): void {
    this.dataset.ui = "chart-tooltip";
    this.setAttribute("aria-hidden", "true");
    adoptStyles(rootOf(this), css);
    this.append(this.#title, this.#body, this.#rows);
    this.#pointer = matchMedia("(pointer: coarse)");
    this.#pointer.addEventListener("change", this.#sync);
    this.#unbind = bindChart(this, (chart) => {
      this.#chart = chart;
      const onHover = (event: Event) => this.#show((event as CustomEvent<HoverInfo | null>).detail);
      chart.addEventListener(CHART_EVENT.hover, onHover);
      chart.addEventListener(CHART_EVENT.data, this.#reserve);
      this.#observer = new ResizeObserver(this.#sync);
      this.#observer.observe(chart.drawing);
      this.#sync();
      if (chart.hover) this.#show(chart.hover);
      return () => {
        chart.removeEventListener(CHART_EVENT.hover, onHover);
        chart.removeEventListener(CHART_EVENT.data, this.#reserve);
        this.#observer?.disconnect();
        this.#chart = undefined;
        this.#hide();
      };
    });
  }

  disconnectedCallback(): void {
    this.#unbind?.();
    this.#pointer?.removeEventListener("change", this.#sync);
    cancelAnimationFrame(this.#frame);
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unbind?.();
    this.#pointer?.removeEventListener("change", this.#sync);
    this.connectedCallback();
  }

  /** Docked or floating, decided from the chart's width and the pointer, not at show time. */
  /** Reserves the docked panel's height for the most rows the chart ever shows, so it never resizes. */
  readonly #reserve = () => {
    const rows = this.#chart?.maxHoverRows ?? 0;
    this.toggleAttribute("data-reserved", rows > 0);
    if (rows > 0) this.style.setProperty("--ui-rows", `${rows}`);
    else this.style.removeProperty("--ui-rows");
  };

  readonly #sync = () => {
    this.#reserve();
    const chart = this.#chart;
    const mode = this.getAttribute("dock");
    const docked =
      mode === "always" ||
      (mode !== "never" &&
        (!!this.#pointer?.matches || (!!chart && chart.drawing.clientWidth <= DOCK_WIDTH)));
    if (docked === this.#docked) return;
    this.#docked = docked;
    const info = this.#info;
    this.#hide();
    this.toggleAttribute("data-docked", docked);
    this.style.removeProperty("transform");
    if (docked || !hasPopover()) this.removeAttribute("popover");
    else this.setAttribute("popover", "manual");
    if (info) this.#show(info);
  };

  #stopFollow(): void {
    this.#follow?.();
    this.#follow = undefined;
    this.removeAttribute("data-offscreen");
  }

  /** While floating, follows page scroll and the visual viewport; the code is its own chunk. */
  #startFollow(): void {
    if (this.#follow || this.#following) return;
    this.#following = true;
    import("../internal/chart-follow.js").then(({ follow }) => {
      this.#following = false;
      const chart = this.#chart;
      if (!chart || !this.#info || this.docked || this.#follow) return;
      this.#follow = follow(
        chart.drawing,
        () => {
          if (!this.#info || !this.#chart) return;
          // Glued to the chart, not sliding after it: no transition for this move.
          this.removeAttribute("data-ready");
          this.#place(this.#chart, this.#info);
          cancelAnimationFrame(this.#frame);
          this.#frame = requestAnimationFrame(() => this.setAttribute("data-ready", ""));
        },
        (hidden) => this.toggleAttribute("data-offscreen", hidden),
      );
    });
  }

  #hide(): void {
    this.#stopFollow();
    this.removeAttribute("data-open");
    this.removeAttribute("data-ready");
    cancelAnimationFrame(this.#frame);
    if (this.hasAttribute("popover") && this.matches(":popover-open")) this.hidePopover();
    this.#info = null;
  }

  #show(info: HoverInfo | null): void {
    if (!info || !this.#chart) {
      this.#hide();
      return;
    }
    this.#info = info;
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
    this.toggleAttribute("data-pinned", info.pinned);
    const open = this.hasAttribute("data-open");
    if (this.hasAttribute("popover") && !this.matches(":popover-open")) this.showPopover();
    if (!this.docked) {
      this.#place(this.#chart, info);
      this.#startFollow();
    }
    if (!open) {
      this.setAttribute("data-open", "");
      // Slide between marks only once the card is already on screen, never from the corner.
      this.#frame = requestAnimationFrame(() => this.setAttribute("data-ready", ""));
    }
  }

  #place(chart: ChartHost, info: HoverInfo): void {
    // The card is in the top layer, so it is placed in viewport coordinates from the drawing's box.
    const box = chart.drawing.getBoundingClientRect();
    const attr = this.getAttribute("side");
    const side = attr === "left" || attr === "top" || attr === "bottom" ? attr : "right";
    const placement = computePlacement({
      anchor: { x: box.left + info.x, y: box.top + info.y, width: 0, height: 0 },
      content: { width: this.offsetWidth, height: this.offsetHeight },
      boundary: { x: box.left, y: box.top, width: box.width, height: box.height },
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
