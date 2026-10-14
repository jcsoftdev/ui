import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import type { IndexRange } from "@jcsoftdev/ui-core/chart/brush";
import {
  buildCategoryAxis,
  fullCategoryLabel,
  type XValue,
} from "@jcsoftdev/ui-core/chart/category-axis-time";
import { formatPercent, resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  join,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import {
  axisBottom,
  axisFormatOf,
  axisLeft,
  cssColor,
  EASE,
  gridLines,
} from "../internal/e19-axes.js";
import { type Bar, merge } from "../internal/e19-candles.js";
import css from "./candlestick.css.js";
import type { CandleBrush } from "./candlestick-brush.js";

export interface Candle {
  date: XValue;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Strings the candlestick adds to the base labels. */
export interface CandlestickLabels {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  change: string;
  up: string;
  down: string;
  category: string;
  resetZoom: string;
  brush: string;
}
const DEFAULT_TEXT: CandlestickLabels = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  change: "Change",
  up: "Up",
  down: "Down",
  category: "Date",
  resetZoom: "Reset zoom",
  brush: "Visible range",
};

const MARGIN = { top: 12, bottom: 30 };
const VOLUME_GAP = 16;
/** Above this many candles in view they are painted on the canvas layer instead of as SVG nodes. */
const CANVAS_AT = 400;

/**
 * `<ui-candlestick>`: open-high-low-close candles with up and down colors, optional volume bars on
 * the same x axis, a last-price line and an overview brush to zoom (the React `CandlestickChart`).
 * Up to 400 candles are SVG nodes updated with `join()`; beyond that they are painted on the canvas
 * layer, and a view with more candles than pixels merges them into buckets first. One tab stop:
 * the arrows walk the candles; the tooltip reads open, high, low, close, change and volume.
 * Attributes: `candle-style` (`filled`, `hollow`), `volume` (`off` hides the bars; shown when any
 * candle has a volume), `brush` (the zoom overview), `last-price="off"`, `up-color`, `down-color`,
 * `grid="off"`, `volume-format` (default `compact`), plus the chart attributes. Properties: `data`,
 * `xFormat`, `volumeFormat`, `range` (the zoomed window, inclusive indices), `labels`. The legend
 * lists Up and Down and toggles each direction. Events: `chart-range` (`detail`: `[from, to]`).
 */
export class UiCandlestick extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "candle-style",
    "volume",
    "brush",
    "last-price",
    "up-color",
    "down-color",
    "grid",
    "volume-format",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels & CandlestickLabels>;
  xFormat: ((value: XValue) => string) | undefined;
  volumeFormat: ValueFormat | undefined;
  #data: readonly Candle[] = [];
  #range: IndexRange | undefined;
  #brush: CandleBrush | undefined;
  #brushLoad: Promise<unknown> | undefined;
  #bands = new Map<number, SVGRectElement>();
  #layers:
    | {
        axes: SVGGElement;
        volume: SVGGElement;
        bands: SVGGElement;
        candles: SVGGElement;
        last: SVGGElement;
      }
    | undefined;

  get data(): readonly Candle[] {
    return this.#data;
  }
  set data(value: readonly Candle[]) {
    // The zoom survives new data of the same length (a live update) and resets when the series changes size.
    if (value.length !== this.#data.length) this.#range = undefined;
    this.#data = value;
    this.requestDraw();
  }
  /** The zoomed window as inclusive indices of `data`; the whole data when unset. */
  get range(): IndexRange {
    const last = Math.max(0, this.#data.length - 1);
    const [from, to] = this.#range ?? [0, last];
    return [Math.max(0, Math.min(from, last)), Math.max(0, Math.min(to, last))];
  }
  set range(value: IndexRange) {
    this.#range = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "candlestick";
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", "360");
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#brush?.destroy();
    this.#brush = undefined;
    this.#brushLoad = undefined;
  }

  protected override isEmpty(): boolean {
    return this.#data.length === 0;
  }

  #setRange(range: IndexRange): void {
    this.#range = range;
    this.dispatchEvent(new CustomEvent("chart-range", { detail: range, bubbles: true }));
    this.requestDraw();
  }

  #layer(root: SVGSVGElement) {
    if (this.#layers?.axes.parentNode !== root) {
      this.#layers = {
        axes: svg("g"),
        volume: svg("g"),
        bands: svg("g"),
        candles: svg("g"),
        last: svg("g", { "aria-hidden": "true", "pointer-events": "none" }),
      };
      root.replaceChildren(...Object.values(this.#layers));
    }
    return this.#layers;
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, animate, locale, timeZone } = context;
    const text: CandlestickLabels = { ...DEFAULT_TEXT, ...this.labels };
    const format = context.format;
    const volumeFormat = resolveFormat(
      this.volumeFormat ?? (this.getAttribute("volume-format") as ValueFormat | null) ?? "compact",
      { locale },
    );
    const data = this.#data;
    const [from, to] = this.range;
    const upColor = this.getAttribute("up-color") ?? "var(--chart-up)";
    const downColor = this.getAttribute("down-color") ?? "var(--chart-down)";
    const hollow = this.getAttribute("candle-style") === "hollow";
    const lastPrice = this.getAttribute("last-price") !== "off";
    const grid = this.getAttribute("grid") !== "off";
    const showVolume =
      this.getAttribute("volume") === "off" ? false : data.some((c) => c.volume != null);
    const colorOf = (c: Candle) => (c.close >= c.open ? upColor : downColor);
    const dirOf = (c: Candle) => (c.close >= c.open ? "up" : "down");
    const layers = this.#layer(root);

    const narrow = width < 440;
    const tagRoom = lastPrice && !narrow ? 56 : 12;
    const innerHeight = Math.max(10, height - MARGIN.top - MARGIN.bottom);
    const priceHeight = showVolume ? Math.round((innerHeight - VOLUME_GAP) * 0.76) : innerHeight;
    const volumeTop = priceHeight + VOLUME_GAP;
    const volumeHeight = innerHeight - volumeTop;

    const slice = data.slice(from, to + 1);
    // The y axis fits every candle in view, before any merging, so a bucket never clips and
    // hiding a direction does not rescale the chart.
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const c of slice) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
    }
    if (!slice.length) {
      lo = 0;
      hi = 1;
    }
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    const y = linearScale({
      domain: [lo - pad, hi + pad],
      range: [priceHeight, 0],
      tickCount: Math.max(3, Math.round(priceHeight / 54)),
    });
    const axisFormat = axisFormatOf(this, locale);
    const yTicks = y
      .ticks()
      .map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }));
    const left = Math.max(...yTicks.map((tick) => estimateTextWidth(tick.label)), 16) + 18;
    const innerWidth = Math.max(60, width - left - tagRoom);
    // A bucket takes its direction from its merged open and close, then the hidden ones leave.
    const view = merge(slice, Math.max(1, Math.floor(innerWidth / 1.5))).filter(
      (c) => !this.isHidden(dirOf(c)),
    );
    const axis = buildCategoryAxis(
      view.map((c) => c.date),
      innerWidth,
      { mode: "band", format: this.xFormat, paddingInner: 0.3, locale, timeZone },
    );
    const maxVolume = Math.max(0, ...view.map((c) => c.volume ?? 0));
    const vy = linearScale({ domain: [0, maxVolume || 1], range: [volumeHeight, 0], nice: false });
    const candleWidth = Math.max(2, Math.min(22, axis.bandwidth));
    const dateLabel = (c: Bar) =>
      c.until === undefined
        ? this.#label(c.date, locale, timeZone)
        : `${this.#label(c.date, locale, timeZone)} – ${this.#label(c.until, locale, timeZone)}`;
    const change = (c: Candle) => (c.open ? (c.close - c.open) / Math.abs(c.open) : 0);
    const signed = (c: Candle) =>
      `${c.close > c.open ? "+" : ""}${formatPercent(change(c), { locale })}`;

    // Axes and grid.
    const axes = layers.axes;
    axes.setAttribute("transform", `translate(${left},${MARGIN.top})`);
    axes.replaceChildren();
    if (grid) axes.append(gridLines(yTicks, "horizontal", innerWidth));
    axes.append(axisLeft(yTicks, 0), axisBottom(axis.ticks, innerHeight));
    for (const group of [layers.volume, layers.bands, layers.candles, layers.last])
      group.setAttribute("transform", `translate(${left},${MARGIN.top})`);

    // Volume.
    const volumeLayer = layers.volume;
    const canvasMode = view.length > CANVAS_AT;
    if (showVolume) {
      const base = svg("g", { transform: `translate(0,${volumeTop})`, "aria-hidden": "true" });
      base.append(
        svg("line", {
          x1: 0,
          x2: innerWidth,
          y1: volumeHeight,
          y2: volumeHeight,
          "shape-rendering": "crispEdges",
          style: "stroke:var(--line-strong)",
        }),
        svg(
          "text",
          {
            x: -10,
            y: 4,
            dy: "0.34em",
            "text-anchor": "end",
            style:
              "fill:var(--ink-3);font-size:10.5px;font-weight:500;font-variant-numeric:tabular-nums",
          },
          volumeFormat(maxVolume),
        ),
      );
      if (!canvasMode)
        view.forEach((c, i) => {
          if (c.volume == null) return;
          const h = Math.max(1, volumeHeight - vy.map(c.volume));
          base.append(
            svg("rect", {
              "data-bar": "",
              x: (axis.positions[i] as number) - candleWidth / 2,
              y: volumeHeight - h,
              width: candleWidth,
              height: h,
              rx: Math.min(2.5, candleWidth / 3),
              style: `fill:${colorOf(c)};fill-opacity:.42;transform-box:fill-box;transform-origin:center bottom`,
            }),
          );
        });
      volumeLayer.replaceChildren(base);
    } else volumeLayer.replaceChildren();

    // Candles.
    this.#bands.clear();
    layers.bands.replaceChildren();
    let nodes: SVGElement[] = [];
    if (canvasMode) {
      layers.candles.replaceChildren();
      const g = context.canvas();
      // TODO(theme): repaint on a theme change once the base chart exposes its theme hook; these
      // colours are resolved now.
      const surface = cssColor(this, "var(--surface)");
      const up = cssColor(this, upColor);
      const down = cssColor(this, downColor);
      g.save();
      g.translate(left, MARGIN.top);
      g.lineCap = "round";
      view.forEach((c, i) => {
        const px = axis.positions[i] as number;
        const tone = c.close >= c.open ? up : down;
        g.strokeStyle = tone;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(px, y.map(c.high));
        g.lineTo(px, y.map(c.low));
        g.stroke();
        const top = y.map(Math.max(c.open, c.close));
        const h = Math.max(1.5, y.map(Math.min(c.open, c.close)) - top);
        g.fillStyle = hollow && c.close >= c.open ? surface : tone;
        g.fillRect(px - candleWidth / 2, top, candleWidth, h);
        if (hollow && c.close >= c.open) g.strokeRect(px - candleWidth / 2, top, candleWidth, h);
        if (showVolume && c.volume != null) {
          const vh = Math.max(1, volumeHeight - vy.map(c.volume));
          g.globalAlpha = 0.42;
          g.fillStyle = tone;
          g.fillRect(px - candleWidth / 2, volumeTop + volumeHeight - vh, candleWidth, vh);
          g.globalAlpha = 1;
        }
      });
      g.restore();
    } else {
      nodes = join(
        layers.candles,
        view,
        (_, i) => i,
        () =>
          svg(
            "g",
            { "data-candle": "", "aria-hidden": "true" },
            svg("line", { "stroke-width": 1.5, "stroke-linecap": "round" }),
            svg("rect"),
          ),
        (el, c, i) => {
          const px = axis.positions[i] as number;
          const tone = colorOf(c);
          const top = y.map(Math.max(c.open, c.close));
          const h = Math.max(1.5, y.map(Math.min(c.open, c.close)) - top);
          const open = hollow && c.close >= c.open;
          const [wick, body] = [
            el.firstElementChild as SVGLineElement,
            el.lastElementChild as SVGRectElement,
          ];
          wick.setAttribute("x1", `${px}`);
          wick.setAttribute("x2", `${px}`);
          wick.setAttribute("y1", `${y.map(c.high)}`);
          wick.setAttribute("y2", `${y.map(c.low)}`);
          wick.style.stroke = tone;
          body.setAttribute("x", `${px - candleWidth / 2}`);
          body.setAttribute("y", `${top}`);
          body.setAttribute("width", `${candleWidth}`);
          body.setAttribute("height", `${h}`);
          body.setAttribute("rx", `${Math.min(2.5, candleWidth / 3)}`);
          body.setAttribute("stroke-width", open ? "1.5" : "0");
          body.style.fill = open ? "var(--surface)" : tone;
          body.style.stroke = tone;
        },
      );
    }

    // Last price: a dashed line and a tag.
    const lastLayer = layers.last;
    lastLayer.replaceChildren();
    const last = view[view.length - 1];
    if (lastPrice && last) {
      const tone = colorOf(last);
      const ly = y.map(last.close);
      lastLayer.append(
        svg("line", {
          x1: 0,
          x2: innerWidth,
          y1: ly,
          y2: ly,
          "stroke-dasharray": "4 4",
          "shape-rendering": "crispEdges",
          style: `stroke:${tone};stroke-opacity:.7`,
        }),
      );
      if (!narrow)
        lastLayer.append(
          svg(
            "g",
            { transform: `translate(${innerWidth + 4},${ly})` },
            svg("rect", {
              x: 0,
              y: -9,
              width: tagRoom - 6,
              height: 18,
              rx: 6,
              style: `fill:${tone}`,
            }),
            svg(
              "text",
              {
                x: (tagRoom - 6) / 2,
                y: 0,
                dy: "0.34em",
                "text-anchor": "middle",
                style:
                  "fill:var(--surface);font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums",
              },
              format(last.close),
            ),
          ),
        );
    }

    if (animate) {
      const per = Math.min(14, 600 / Math.max(1, nodes.length));
      nodes.forEach((node, i) => {
        node.animate(
          [
            { transform: "scaleY(0.2)", opacity: 0 },
            { transform: "scaleY(1)", opacity: 1 },
          ],
          { duration: 480, delay: i * per, easing: EASE, fill: "backwards" },
        );
      });
      lastLayer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 360,
        delay: 500,
        easing: "linear",
        fill: "backwards",
      });
    }

    this.#syncBrush(width, left, tagRoom, text, locale, timeZone);

    const bandOf = (index: number): SVGRectElement | null => {
      if (index < 0 || index >= view.length) return null;
      let band = this.#bands.get(index);
      if (!band) {
        if (this.#bands.size > 6) {
          const [oldest] = this.#bands.keys();
          if (oldest !== undefined) {
            this.#bands.get(oldest)?.remove();
            this.#bands.delete(oldest);
          }
        }
        band = svg("rect", {
          "data-hl": "",
          x: (axis.positions[index] as number) - axis.step / 2,
          y: 0,
          width: axis.step,
          height: innerHeight,
          "aria-hidden": "true",
        });
        layers.bands.append(band);
        this.#bands.set(index, band);
      }
      return band;
    };
    const rowsOf = (c: Bar): TooltipRow[] => [
      { id: "open", name: text.open, value: format(c.open), color: "var(--ink-3)", shape: "dot" },
      { id: "high", name: text.high, value: format(c.high), color: "var(--ink-3)", shape: "dot" },
      { id: "low", name: text.low, value: format(c.low), color: "var(--ink-3)", shape: "dot" },
      { id: "close", name: text.close, value: format(c.close), color: colorOf(c), shape: "square" },
      { id: "change", name: text.change, value: signed(c), color: "transparent", emphasis: true },
      ...(c.volume != null
        ? [
            {
              id: "volume",
              name: text.volume,
              value: volumeFormat(c.volume),
              color: "var(--ink-3)",
              shape: "dot" as const,
            },
          ]
        : []),
    ];
    const first = view[0];
    return {
      summary: first
        ? `${slice.length} candles, ${dateLabel(first)} to ${dateLabel(view[view.length - 1] as Bar)}, close ${format((view[view.length - 1] as Bar).close)}.`
        : undefined,
      maxHoverRows: showVolume ? 6 : 5,
      marks: {
        count: view.length,
        label: (i) => {
          const c = view[i] as Bar;
          return `${dateLabel(c)}. ${text.open} ${format(c.open)}, ${text.high} ${format(c.high)}, ${text.low} ${format(c.low)}, ${text.close} ${format(c.close)}, ${text.change} ${signed(c)}${
            c.volume != null ? `, ${text.volume} ${volumeFormat(c.volume)}` : ""
          }`;
        },
        element: bandOf,
      },
      hit: (x, yy, _target, radius) => {
        const px = x - left;
        if (!view.length || px < -radius || px > innerWidth + radius) return -1;
        if (yy < -radius || yy > height + radius) return -1;
        return axis.indexAt(Math.min(innerWidth, Math.max(0, px)));
      },
      hover: (i): HoverContent | null => {
        const c = view[i];
        if (!c) return null;
        return {
          title: dateLabel(c),
          rows: rowsOf(c),
          x: left + (axis.positions[i] as number),
          y: MARGIN.top + y.map(c.high),
        };
      },
      snapshot: () => {
        const column = (
          id: string,
          name: string,
          pick: (c: Candle) => number | undefined,
          fmt: (n: number) => string,
        ) => ({
          id,
          name,
          color: "var(--ink-3)",
          values: data.map((c) => pick(c) ?? null),
          text: data.map((c) => {
            const v = pick(c);
            return v == null ? "" : fmt(v);
          }),
        });
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: text.category,
          categories: data.map((c) => this.#label(c.date, locale, timeZone)),
          categoryValues: data.map((c) =>
            c.date instanceof Date || typeof c.date === "number" ? c.date : String(c.date),
          ),
          series: [
            column("open", text.open, (c) => c.open, format),
            column("high", text.high, (c) => c.high, format),
            column("low", text.low, (c) => c.low, format),
            column("close", text.close, (c) => c.close, format),
            ...(showVolume ? [column("volume", text.volume, (c) => c.volume, volumeFormat)] : []),
          ],
          legend: [
            { id: "up", name: text.up, color: upColor, shape: "square" as const },
            { id: "down", name: text.down, color: downColor, shape: "square" as const },
          ],
        };
      },
    };
  }

  #label(value: XValue, locale: string, timeZone: string | undefined): string {
    return this.xFormat ? this.xFormat(value) : fullCategoryLabel(value, { locale, timeZone });
  }

  /** Mounts, updates or removes the overview brush; its code is a chunk of its own. */
  #syncBrush(
    width: number,
    left: number,
    right: number,
    text: CandlestickLabels,
    locale: string,
    timeZone: string | undefined,
  ): void {
    const want = this.hasAttribute("brush") && this.#data.length > 3;
    if (!want) {
      this.#brush?.destroy();
      this.#brush = undefined;
      this.#brushLoad = undefined;
      return;
    }
    const data = this.#data;
    const state = () => ({
      count: data.length,
      range: this.range,
      closes: data.map((c) => c.close),
      left,
      right,
      width,
      label: text.brush,
      resetLabel: text.resetZoom,
      valueText: ([a, b]: IndexRange) =>
        `${this.#label((data[a] as Candle).date, locale, timeZone)} – ${this.#label((data[b] as Candle).date, locale, timeZone)}`,
      onChange: (range: IndexRange) => this.#setRange(range),
    });
    if (this.#brush) {
      this.#brush.update(state());
      return;
    }
    this.#brushLoad ??= import("./candlestick-brush.js").then(({ mountBrush }) => {
      if (!this.isConnected || !this.hasAttribute("brush")) return;
      this.#brush = mountBrush(this, state());
    });
  }
}

/** Registers `<ui-candlestick>` (or `<prefix>-candlestick`) and returns the tag. */
export function defineCandlestick(options?: DefineOptions): string {
  return defineElement("candlestick", UiCandlestick, options);
}
