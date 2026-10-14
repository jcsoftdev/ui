import { type DefineOptions, defineElement } from "../internal/base.js";
import { ChartElement, type DrawContext, type DrawResult } from "../internal/chart-base.js";

/**
 * `<ui-chart-frame>`: the shared chart shell as an element. It measures its slot (width and, with
 * `height="fill"`, height), swaps in the loading or empty state, and hosts the opt-in parts placed
 * inside it (legend, tooltip, data table, export menu, breadcrumb). Give it a `render` function to
 * draw into the SVG it sizes; every chart element is this same frame with its own `draw()`.
 * Attributes: `height` (px, default 240, or `fill`: take the parent's height, which must be
 * definite), `aspect-ratio` (wins over a pixel height), `loading`, `empty`, `skeleton` (`bars`,
 * `line`, `ring`), `label`, `description`, `locale`, `time-zone`, `value-format`, `currency`,
 * `palette`, `animate="off"`, `table="off"`. Properties: `render(context)` returning an optional
 * `DrawResult`, `labels`, `valueFormat`, `palette`. Events: `chart-ready`, `chart-data`,
 * `chart-hover`, `chart-series`.
 */
export class UiChartFrame extends ChartElement {
  #render: ((context: DrawContext) => DrawResult | undefined) | undefined;

  get render(): ((context: DrawContext) => DrawResult | undefined) | undefined {
    return this.#render;
  }
  set render(value: ((context: DrawContext) => DrawResult | undefined) | undefined) {
    this.#render = value;
    this.requestDraw();
  }

  protected override draw(context: DrawContext): DrawResult | undefined {
    return this.#render?.(context);
  }
}

/** Registers `<ui-chart-frame>` (or `<prefix>-chart-frame`) and returns the tag. */
export function defineChartFrame(options?: DefineOptions): string {
  return defineElement("chart-frame", UiChartFrame, options);
}
