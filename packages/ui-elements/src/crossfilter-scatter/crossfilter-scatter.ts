import { type BrushRect, rangesToRect, rectToRanges } from "@jcsoftdev/ui-core/chart/brush";
import { resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { XYElement, type XYPoint } from "../internal/e17-xy.js";
import css from "../internal/e23-crossfilter.css.js";
import {
  type CrossfilterTexts,
  createHeader,
  DEFAULT_TEXTS,
  linkProvider,
  type ProviderLink,
} from "../internal/e23-crossfilter.js";

/**
 * `<ui-crossfilter-scatter>`: one dot per record of the `<ui-crossfilter>` it sits in: accent for
 * the records every filter leaves in, faint for the rest. Drag a rectangle to filter both
 * dimensions at once (a click clears it); from the keyboard focus the brush after the plot (arrows
 * move the rectangle, Shift and arrows resize it, Enter applies, Escape clears). On touch the page
 * keeps scrolling: rest a finger on the plot for about 350 ms (`touch-delay`) and then drag. The
 * brush filters and never pins a point.
 *
 * Attributes: `x` and `y` (numeric dimensions), `heading`, `no-brush`, `touch-delay`, `radius`
 * (default 3.5), `renderer="canvas"` for tens of thousands of points, plus the chart attributes.
 * Properties: `pointLabel(record)`, `xLabel`, `yLabel`, `xFormat`, `yFormat`, `texts`.
 */
export class UiCrossfilterScatter extends XYElement {
  static override observedAttributes = [
    ...XYElement.observedAttributes,
    "x",
    "y",
    "heading",
    "no-brush",
  ];
  protected readonly sized = false;

  pointLabel: ((record: never) => string) | undefined;
  xLabel: string | undefined;
  yLabel: string | undefined;
  texts: Partial<CrossfilterTexts> = {};

  #link: ProviderLink | undefined;
  #header = createHeader();

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "crossfilter-scatter";
    if (!this.hasAttribute("radius")) this.setAttribute("radius", "3.5");
    this.#syncBrush();
    super.connectedCallback();
    this.prepend(this.#header.el);
    this.addEventListener("brush", this.#onBrush);
    this.#link = linkProvider(this, () => this.sync());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("brush", this.#onBrush);
    this.#link?.stop();
    this.#link = undefined;
    this.#header.el.remove();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "no-brush") this.#syncBrush();
    super.attributeChangedCallback(name);
    if (["x", "y", "heading", "no-brush"].includes(name)) this.sync();
  }

  #syncBrush(): void {
    if (this.hasAttribute("no-brush")) this.removeAttribute("brush");
    else if (!this.hasAttribute("brush")) this.setAttribute("brush", "");
  }

  readonly #onBrush = (event: Event) => {
    if (event.target !== this) return;
    const api = this.#link?.api;
    if (!api) return;
    const rect = (event as CustomEvent<BrushRect | null>).detail;
    const ranges = rect ? rectToRanges(rect) : { x: null, y: null };
    api.setRange(this.getAttribute("x") ?? "", ranges.x);
    api.setRange(this.getAttribute("y") ?? "", ranges.y);
  };

  /** Reads the provider again and redraws. Call after changing `pointLabel`, the axis labels or `texts`. */
  sync(): void {
    const api = this.#link?.api;
    const x = this.getAttribute("x") ?? "";
    const y = this.getAttribute("y") ?? "";
    const heading = this.getAttribute("heading") ?? "";
    const texts = { ...DEFAULT_TEXTS, ...this.texts };
    if (heading && !this.hasAttribute("label")) this.setAttribute("label", heading);
    const accessX = api?.accessors[x];
    const accessY = api?.accessors[y];
    if (!api || !accessX || !accessY) {
      this.series = [];
      this.#header.update({
        heading,
        count: "",
        own: false,
        clearLabel: texts.clear,
        onClear() {},
      });
      return;
    }
    const kept = new Set<unknown>(api.filtered);
    const label = this.pointLabel as ((record: unknown) => string) | undefined;
    const point = (record: unknown): XYPoint => ({
      x: Number(accessX(record)),
      y: Number(accessY(record)),
      label: label?.(record),
    });
    this.series = [
      {
        id: "out",
        name: texts.excluded,
        color: "var(--line-strong)",
        points: api.records.filter((record) => !kept.has(record)).map(point),
      },
      { id: "in", name: texts.filtered, color: "var(--accent)", points: api.filtered.map(point) },
    ];
    const range = (id: string) => {
      const filter = api.filters[id];
      return filter?.kind === "range" ? ([filter.min, filter.max] as const) : null;
    };
    // Keep the drawn rectangle in step with the filters (they can change from another chart or code).
    this.brushValue = rangesToRect(range(x), range(y));
    const fx = resolveFormat(this.xFormat as ValueFormat | undefined, { locale: this.locale });
    const fy = resolveFormat(this.yFormat as ValueFormat | undefined, { locale: this.locale });
    this.copy = { ...this.copy, brush: texts.brush };
    this.describeBrush = (rect) =>
      texts.selection(
        `${this.xLabel ?? x} ${fx(rect.x0)} – ${fx(rect.x1)}`,
        `${this.yLabel ?? y} ${fy(rect.y0)} – ${fy(rect.y1)}`,
      );
    this.#header.update({
      heading,
      count: texts.count(api.filtered.length, api.total),
      own: api.filters[x] != null || api.filters[y] != null,
      clearLabel: texts.clear,
      onClear: () => {
        api.clear(x);
        api.clear(y);
      },
    });
  }
}

/** Registers `<ui-crossfilter-scatter>` (or `<prefix>-crossfilter-scatter`) and returns the tag. */
export function defineCrossfilterScatter(options?: DefineOptions): string {
  return defineElement("crossfilter-scatter", UiCrossfilterScatter, options);
}
