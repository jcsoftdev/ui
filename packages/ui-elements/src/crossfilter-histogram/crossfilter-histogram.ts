import { resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { CHART_EVENT, type ChartHost } from "../internal/chart-protocol.js";
import { CartesianElement } from "../internal/e17-cartesian.js";
import css from "../internal/e23-crossfilter.css.js";
import {
  binsInRange,
  type CrossfilterTexts,
  createHeader,
  DEFAULT_TEXTS,
  DIMMED,
  evenEdges,
  linkProvider,
  type ProviderLink,
  rangeOfBins,
} from "../internal/e23-crossfilter.js";

interface Drag {
  from: number;
  to: number;
  moved: boolean;
  pointer: number;
}

/**
 * `<ui-crossfilter-histogram>`: the distribution of a numeric dimension of the `<ui-crossfilter>`
 * it sits in. Drag across the bars to filter by that interval, or click a bin (click it again to
 * undo); from the keyboard, arrows pick a bin and Enter toggles it. The bins outside the interval
 * are dimmed. The gesture filters and never pins a bar.
 *
 * Attributes: `dimension`, `heading`, `bins` (default 10), `domain` (`min,max`, default `0,100`),
 * `edge-format` (`number`, `integer`, `currency`, `percent`, `compact`), plus the chart
 * attributes. Properties: `edges` (explicit bin edges), `edgeFormat` (a function or preset), `texts`.
 */
export class UiCrossfilterHistogram extends CartesianElement {
  static override observedAttributes = [
    ...CartesianElement.observedAttributes,
    "dimension",
    "heading",
    "bins",
    "domain",
    "edge-format",
  ];
  protected readonly kind = "column" as const;

  edges: readonly number[] | undefined;
  edgeFormat: ValueFormat | undefined;
  texts: Partial<CrossfilterTexts> = {};

  #link: ProviderLink | undefined;
  #header = createHeader();
  #bins: readonly number[] = [];
  #drag: Drag | null = null;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.select, (event) => {
      // Filtering replaces pinning: the selection never reaches the page.
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<{ index: number } | null>).detail;
      if (!detail) return;
      this.#toggleBin(detail.index);
      (this as unknown as ChartHost).select(null);
    });
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "crossfilter-histogram";
    super.connectedCallback();
    this.prepend(this.#header.el);
    this.#link = linkProvider(this, () => this.sync());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#link?.stop();
    this.#link = undefined;
    this.#header.el.remove();
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (["dimension", "heading", "bins", "domain", "edge-format"].includes(name)) this.sync();
  }

  get #dimension(): string {
    return this.getAttribute("dimension") ?? "";
  }

  #edges(): readonly number[] {
    if (this.edges) return this.edges;
    const [min, max] = (this.getAttribute("domain") ?? "0,100").split(",").map(Number);
    return evenEdges(min ?? 0, max ?? 100, Number(this.getAttribute("bins")) || 10);
  }

  #band(): readonly [number, number] | null {
    const own = this.#link?.api?.filters[this.#dimension];
    return own?.kind === "range" ? binsInRange(this.#edges(), own.min, own.max) : null;
  }

  #apply(from: number, to: number): void {
    this.#link?.api?.setRange(this.#dimension, rangeOfBins(this.#edges(), from, to));
  }

  #toggleBin(index: number): void {
    const band = this.#band();
    if (band && band[0] === index && band[1] === index) this.#link?.api?.clear(this.#dimension);
    else this.#apply(index, index);
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    super.setup(root, signal);
    const opts = { signal };
    // The bins' hit areas are the marks the chart draws: their boxes tell which bin a pixel is in.
    const binAt = (event: PointerEvent, strict: boolean): number | null => {
      const hits = [...this.querySelectorAll<SVGElement>('[data-e17="hit"]')];
      const first = hits[0]?.getBoundingClientRect();
      if (!first) return null;
      if (strict && (event.clientY < first.top || event.clientY > first.bottom)) return null;
      let best = 0;
      let distance = Number.POSITIVE_INFINITY;
      hits.forEach((hit, index) => {
        const box = hit.getBoundingClientRect();
        const d =
          event.clientX < box.left
            ? box.left - event.clientX
            : event.clientX > box.right
              ? event.clientX - box.right
              : 0;
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      return strict && distance > 0 ? null : best;
    };
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || !this.#link?.api) return;
        const bin = binAt(event, true);
        if (bin === null) return;
        this.#drag = { from: bin, to: bin, moved: false, pointer: event.pointerId };
        root.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      opts,
    );
    root.addEventListener(
      "pointermove",
      (event) => {
        const drag = this.#drag;
        if (!drag || event.pointerId !== drag.pointer) return;
        const bin = binAt(event, false);
        if (bin === null || (bin === drag.to && !drag.moved && bin === drag.from)) return;
        if (bin === drag.to && drag.moved) return;
        drag.to = bin;
        if (bin !== drag.from) drag.moved = true;
        if (drag.moved) this.#apply(drag.from, drag.to);
      },
      opts,
    );
    const finish = (event: PointerEvent) => {
      const drag = this.#drag;
      if (!drag || event.pointerId !== drag.pointer) return;
      this.#drag = null;
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      // The drag or click is the chart's gesture: claim it so no bar is pinned.
      event.preventDefault();
      if (event.type === "pointerup" && !drag.moved) this.#toggleBin(drag.from);
    };
    root.addEventListener("pointerup", finish, opts);
    root.addEventListener("pointercancel", finish, opts);
  }

  /** Reads the provider again and redraws. Call after changing `edges`, `edgeFormat` or `texts`. */
  sync(): void {
    const api = this.#link?.api;
    const dimension = this.#dimension;
    const heading = this.getAttribute("heading") ?? "";
    const texts = { ...DEFAULT_TEXTS, ...this.texts };
    if (heading && !this.hasAttribute("label")) this.setAttribute("label", heading);
    if (!api || !api.accessors[dimension]) {
      this.categories = [];
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
    const edges = this.#edges();
    const preset =
      this.edgeFormat ?? (this.getAttribute("edge-format") as ValueFormat | null) ?? undefined;
    const format = resolveFormat(preset, { locale: this.locale });
    const all = api.binsAll(dimension, edges);
    const inContext = api.bins(dimension, edges);
    const own = api.filters[dimension];
    const band = own?.kind === "range" ? binsInRange(edges, own.min, own.max) : null;
    const inRange = (band ? inContext.slice(band[0], band[1] + 1) : inContext).reduce(
      (sum, value) => sum + value,
      0,
    );
    this.#bins = inContext;
    this.#header.update({
      heading,
      count: texts.count(own ? api.filtered.length : inRange, api.total),
      own: own != null,
      clearLabel: texts.clear,
      onClear: () => api.clear(dimension),
    });
    this.categories = inContext.map((_, index) => format(edges[index] as number));
    this.series = [
      { id: "total", name: texts.total, color: "var(--line-strong)", data: all },
      {
        id: "filtered",
        name: texts.filtered,
        color: "var(--accent)",
        data: inContext,
        colors: band
          ? inContext.map((_, index) => (index >= band[0] && index <= band[1] ? undefined : DIMMED))
          : undefined,
      },
    ];
  }
}

/** Registers `<ui-crossfilter-histogram>` (or `<prefix>-crossfilter-histogram`) and returns the tag. */
export function defineCrossfilterHistogram(options?: DefineOptions): string {
  return defineElement("crossfilter-histogram", UiCrossfilterHistogram, options);
}
