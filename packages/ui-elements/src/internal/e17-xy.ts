// The engine behind <ui-scatter-chart> and <ui-bubble-chart>: two continuous axes, several series,
// optional bubbles (area-proportional), least-squares trend lines, quadrants, jitter, a canvas
// renderer for tens of thousands of points and a rectangular brush. The two elements are presets
// of it, the way `ScatterChart` and `BubbleChart` are presets of the React kit's `XYPointChart`.
import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { tint } from "@jcsoftdev/ui-core/chart/color-scale";
import {
  formatNumber,
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "@jcsoftdev/ui-core/chart/format";
import { type ChartTone, TONE_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { formatDate } from "@jcsoftdev/ui-core/chart/scale-time";
import { adoptStyles, emit, rootOf, uid } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  join,
  svg,
  type TooltipRow,
} from "./chart-base.js";
import { axisBottom, axisLeft, baseline, gridLines } from "./e17-axes.js";
import css from "./e17-chart.css.js";
import { createPointIndex, linearRegression, mean, seededRandom } from "./e17-stats.js";
import { cssColor, maxOf, minOf, numberAttr, numberList } from "./e17-util.js";
import {
  type DistributionAxisOptions,
  truncateLabel,
  type XYLayout,
  xyLayout,
} from "./e17-xy-layout.js";

export type { DistributionAxisOptions };

export interface XYPoint {
  x: number;
  y: number;
  /** Bubble size: drives the area of the circle. */
  size?: number;
  /** Name in the tooltip, the data table and bubble labels. */
  label?: string;
  /** Image drawn inside the marker instead of a plain dot (URL or data URI). */
  image?: string;
}

export interface XYSeries {
  id: string;
  name: string;
  points: readonly XYPoint[];
  color?: string;
}

export type QuadrantCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export interface QuadrantOptions {
  /** Vertical divider; the mean of the visible x values by default. */
  x?: number;
  /** Horizontal divider; the mean of the visible y values by default. */
  y?: number;
  labels?: Partial<Record<QuadrantCorner, string>>;
  tones?: Partial<Record<QuadrantCorner, ChartTone>>;
}

/** Rectangle in data units (an infinite edge covers the whole axis). */
export interface BrushRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Visible strings beyond the base ones. English defaults. */
export interface XYLabels {
  point: string;
  series: string;
  size: string;
  brush: string;
}

const DEFAULT_COPY: XYLabels = {
  point: "Point",
  series: "Series",
  size: "Size",
  brush: "Select a rectangle",
};
const CORNERS: QuadrantCorner[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
const EASE = "cubic-bezier(.34,1.56,.64,1)";
const TOUCH_DELAY = 350;

/** Bubbles shrink in narrow frames (down to 55%) so they keep some separation. */
export const bubbleRadiusScale = (width: number) => Math.min(1, Math.max(0.55, width / 640));

interface Colored {
  source: XYSeries;
  index: number;
  id: string;
  color: string;
}

export interface PlacedPoint {
  key: string;
  series: Colored;
  point: XYPoint;
  x: number;
  y: number;
  r: number;
}

const finite = (point: XYPoint) => Number.isFinite(point.x) && Number.isFinite(point.y);
const extentOf = (values: number[]): [number, number] | null =>
  values.length ? [minOf(values), maxOf(values)] : null;

/** Shared by the scatter and bubble elements. */
export abstract class XYElement extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "trend-line",
    "radius",
    "size-range",
    "x-type",
    "jitter",
    "seed",
    "renderer",
    "brush",
    "touch-delay",
    "shading",
    "show-labels",
    "size-legend",
    "grid",
  ];
  static override retain = true;

  /** Bubble mode: the radius comes from `size`. */
  protected abstract readonly sized: boolean;
  protected readonly defaultShowLabels: boolean = false;

  xAxis: DistributionAxisOptions = {};
  yAxis: DistributionAxisOptions = {};
  xFormat: ValueFormat | undefined;
  yFormat: ValueFormat | undefined;
  sizeFormat: ValueFormat | undefined;
  quadrants: QuadrantOptions | undefined;
  copy: Partial<XYLabels> = {};
  /** Describes a rectangle for screen readers while it is moved (`applied`: committed). */
  describeBrush: ((rect: BrushRect, applied: boolean) => string) | undefined;

  #series: readonly XYSeries[] = [];
  #index: ReturnType<typeof createPointIndex> | undefined;
  #defs: SVGDefsElement | undefined;
  #under: SVGGElement | undefined;
  #points: SVGGElement | undefined;
  #over: SVGGElement | undefined;
  #ring: SVGCircleElement | undefined;
  #readOrder: PlacedPoint[] = [];
  #elements = new Map<PlacedPoint, Element>();
  #brushValue: BrushRect | null = null;
  #draft: BrushRect | null = null;
  #brush: { draft: BrushRect | null; update(patch: object): void; destroy(): void } | undefined;
  #brushLoad = false;
  #slider: HTMLElement | undefined;
  #live: HTMLElement | undefined;
  /** Series the legend is pointing at; the canvas layer dims the rest (SVG marks dim by `data-series`). */
  #dimmed: string | null = null;
  #themeWatch: { stop(): void } | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#paintRing(info ? info.index : null);
    });
    this.addEventListener(CHART_EVENT.data, (event) => {
      if ((event as CustomEvent).detail) this.#restoreOverlays();
    });
    this.addEventListener(CHART_EVENT.series, (event) => {
      const detail = (event as CustomEvent<{ highlight?: string | null }>).detail;
      if (!detail || !("highlight" in detail)) return;
      const next = detail.highlight ?? null;
      if (next === this.#dimmed) return;
      this.#dimmed = next;
      if (this.getAttribute("renderer") === "canvas") this.requestDraw("transient");
    });
  }

  get series(): readonly XYSeries[] {
    return this.#series;
  }
  set series(value: readonly XYSeries[]) {
    this.#series = value;
    this.requestDraw();
  }
  /** The committed brush rectangle in data units, or `null`. Set it to apply one from outside. */
  get brushValue(): BrushRect | null {
    return this.#brushValue;
  }
  set brushValue(value: BrushRect | null) {
    this.#brushValue = value;
    this.requestDraw("transient");
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    if (this.getAttribute("renderer") === "canvas") this.preloadCanvas();
    super.connectedCallback();
    if (this.hasAttribute("brush") && !this.hasAttribute("touch-action"))
      this.drawing.style.touchAction =
        this.getAttribute("touch-delay") === "0" ? "none" : "pan-x pan-y";
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (name === "renderer" && this.getAttribute("renderer") === "canvas") this.preloadCanvas();
    if (name === "brush" && this.isConnected && !this.hasAttribute("touch-action"))
      this.drawing.style.touchAction = this.hasAttribute("brush")
        ? this.getAttribute("touch-delay") === "0"
          ? "none"
          : "pan-x pan-y"
        : "";
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#brush?.destroy();
    this.#brush = undefined;
    this.#brushLoad = false;
    this.#slider?.remove();
    this.#live?.remove();
    this.#themeWatch?.stop();
    this.#themeWatch = undefined;
  }

  protected override isEmpty(): boolean {
    return !this.#series.some((item) => item.points.some(finite));
  }

  protected override setup(_root: SVGSVGElement, signal: AbortSignal): void {
    // A drag that drew a rectangle is the chart's gesture: claim it so no point is pinned.
    this.drawing.addEventListener(
      "pointerup",
      (event) => {
        if (this.#brush?.draft) event.preventDefault();
      },
      { signal },
    );
  }

  #copy(): XYLabels {
    return { ...DEFAULT_COPY, ...this.copy };
  }

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height } = context;
    const sized = this.sized;
    const copy = this.#copy();
    const currency = this.getAttribute("currency") || undefined;
    const locale = context.locale;
    const time = this.getAttribute("x-type") === "time";
    const fx =
      time && !this.xFormat
        ? (value: number) => formatDate(value, { locale, timeZone: context.timeZone })
        : resolveFormat(this.xFormat, { locale, currency });
    const fy = resolveFormat(this.yFormat, { locale, currency });
    const fs = resolveFormat(this.sizeFormat, { locale, currency });
    const radius = Math.max(0.5, numberAttr(this.getAttribute("radius"), 5));
    const sizeRange = (numberList(this.getAttribute("size-range"), 2) ?? [4, 30]) as [
      number,
      number,
    ];
    const shading = sized && this.getAttribute("shading") === "shaded";
    const showLabels = this.hasAttribute("show-labels") || this.defaultShowLabels;
    const showGrid = this.getAttribute("grid") !== "off";
    const trend = this.hasAttribute("trend-line");
    const hasImages = this.#series.some((item) => item.points.some((point) => point.image));
    const canvasMode = this.getAttribute("renderer") === "canvas" && !shading && !hasImages;
    const jitterAttr = this.getAttribute("jitter");
    const spread = numberList(jitterAttr, 2) ?? [numberAttr(jitterAttr, 0)];
    const jx = Math.max(0, spread[0] ?? 0);
    const jy = Math.max(0, spread[1] ?? spread[0] ?? 0);
    const seed = numberAttr(this.getAttribute("seed"), 17);

    const all: Colored[] = this.#series.map((source, index) => ({
      source,
      index,
      id: source.id,
      color: context.color(index, cssColor(source.color)),
    }));
    const visible = all.filter((item) => !this.isHidden(item.id));
    const xs: number[] = [];
    const ys: number[] = [];
    let maxSize = 0;
    for (const item of visible)
      for (const point of item.source.points) {
        if (!finite(point)) continue;
        xs.push(point.x);
        ys.push(point.y);
        maxSize = Math.max(maxSize, point.size ?? 0);
      }
    const quadrants = this.quadrants;
    const qx = quadrants ? (quadrants.x ?? mean(xs)) : null;
    const qy = quadrants ? (quadrants.y ?? mean(ys)) : null;
    const withQuadrant = (values: number[], q: number | null) =>
      q != null && Number.isFinite(q) ? [...values, q] : values;
    const maxRadius = sized ? sizeRange[1] * bubbleRadiusScale(width) : radius;
    const keyOn = sized && this.getAttribute("size-legend") !== "off" && maxSize > 0;
    const layout = xyLayout({
      width,
      height,
      xExtent: extentOf(withQuadrant(xs, qx)),
      yExtent: extentOf(withQuadrant(ys, qy)),
      xAxis: this.xAxis,
      yAxis: this.yAxis,
      xText: resolveAxisFormat(this.xAxis.format ?? this.xFormat, { locale, currency }),
      yText: resolveAxisFormat(this.yAxis.format ?? this.yFormat, { locale, currency }),
      xTime: time,
      locale,
      timeZone: context.timeZone,
      inset: sized ? maxRadius * 0.7 : radius + 2,
      reserveBottom: keyOn ? Math.ceil(maxRadius * 2 + 10) : 0,
    });
    const { margin, innerWidth, innerHeight, xScale, yScale } = layout;

    const radiusOf = (point: XYPoint) =>
      sized
        ? Math.max(
            sizeRange[0],
            maxRadius * Math.sqrt(Math.max(0, point.size ?? 0) / (maxSize || 1)),
          )
        : radius;
    const placed: PlacedPoint[] = [];
    for (const item of visible) {
      const random = seededRandom(seed + item.index * 131);
      item.source.points.forEach((point, index) => {
        if (!finite(point)) return;
        // Both draws always happen, so a point keeps its offset when the spread changes.
        const dx = (random() * 2 - 1) * jx;
        const dy = (random() * 2 - 1) * jy;
        placed.push({
          key: `${item.id}-${index}`,
          series: item,
          point,
          x: xScale.map(point.x) + dx,
          y: yScale.map(point.y) + dy,
          r: radiusOf(point),
        });
      });
    }
    const drawOrder = sized ? [...placed].sort((a, b) => b.r - a.r) : placed;
    // Reading order for the keyboard: left to right, then bottom to top.
    const readOrder = [...placed].sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y);
    this.#readOrder = readOrder;
    this.#index = createPointIndex(readOrder, 24);

    // The persistent skeleton: defs, under (axes, quadrants), points (joined), over (trends, labels).
    this.#defs ??= svg("defs");
    this.#under ??= svg("g");
    this.#points ??= svg("g");
    this.#over ??= svg("g");
    const [defs, under, points, over] = [this.#defs, this.#under, this.#points, this.#over];
    for (const group of [under, points, over])
      group.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    if (!under.isConnected) root.append(defs, under, points, over);

    const clipId = uid("plot");
    const shadeIds = new Map<number, string>();
    defs.replaceChildren(
      svg(
        "clipPath",
        { id: clipId },
        svg("rect", { x: 0, y: 0, width: innerWidth, height: innerHeight }),
      ),
    );
    if (shading)
      for (const item of visible) {
        const id = uid("sphere");
        shadeIds.set(item.index, id);
        defs.append(
          svg(
            "radialGradient",
            { id, cx: 0.5, cy: 0.5, r: 0.62, fx: 0.34, fy: 0.3 },
            svg("stop", { offset: "0%", style: `stop-color:${tint(item.color, 30, "white")}` }),
            svg("stop", { offset: "38%", style: `stop-color:${item.color}` }),
            svg("stop", { offset: "100%", style: `stop-color:${tint(item.color, 58, "black")}` }),
          ),
        );
      }

    const quadrant =
      qx != null && qy != null && Number.isFinite(qx) && Number.isFinite(qy)
        ? { x: xScale.map(qx), y: yScale.map(qy) }
        : null;
    under.replaceChildren();
    if (quadrant && quadrants?.tones)
      for (const corner of CORNERS) {
        const tone = quadrants.tones[corner];
        if (!tone) continue;
        const left = corner.endsWith("Left");
        const top = corner.startsWith("top");
        under.append(
          svg("rect", {
            x: left ? 0 : quadrant.x,
            y: top ? 0 : quadrant.y,
            width: Math.max(0, left ? quadrant.x : innerWidth - quadrant.x),
            height: Math.max(0, top ? quadrant.y : innerHeight - quadrant.y),
            "aria-hidden": "true",
            style: `fill:${TONE_COLORS[tone].soft};opacity:.55`,
          }),
        );
      }
    if (showGrid) {
      under.append(gridLines(layout.yTicks, "horizontal", innerWidth));
      const columns = gridLines(layout.xTicks, "vertical", innerHeight);
      columns.setAttribute("opacity", "0.6");
      under.append(columns);
    }
    under.append(
      baseline(0, innerWidth, innerHeight, innerHeight),
      axisLeft(layout.yTicks, 0, this.yAxis.title),
      axisBottom(layout.xTicks, innerHeight),
    );
    if (this.xAxis.title)
      under.append(
        svg(
          "text",
          {
            x: innerWidth,
            y: innerHeight + 40,
            "text-anchor": "end",
            "data-e17": "title",
            "aria-hidden": "true",
          },
          this.xAxis.title,
        ),
      );
    if (quadrant) {
      const dash = (x1: number, x2: number, y1: number, y2: number) =>
        svg("line", {
          x1,
          x2,
          y1,
          y2,
          "stroke-dasharray": "4 4",
          "aria-hidden": "true",
          style: "stroke:var(--line-strong)",
        });
      under.append(
        dash(quadrant.x, quadrant.x, 0, innerHeight),
        dash(0, innerWidth, quadrant.y, quadrant.y),
      );
      for (const corner of CORNERS) {
        const text = quadrants?.labels?.[corner];
        if (!text) continue;
        const left = corner.endsWith("Left");
        const tone = quadrants?.tones?.[corner];
        under.append(
          svg(
            "text",
            {
              x: left ? 8 : innerWidth - 8,
              y: corner.startsWith("top") ? 16 : innerHeight - 8,
              "text-anchor": left ? "start" : "end",
              "data-e17": "note",
              "aria-hidden": "true",
              style: `fill:${tone ? TONE_COLORS[tone].ink : "var(--ink-3)"}`,
            },
            truncateLabel(text, innerWidth / 2 - 12),
          ),
        );
      }
    }

    // The marks: SVG nodes joined by key, or one canvas layer.
    const pointElements: Element[] = [];
    this.#elements = new Map();
    if (canvasMode) {
      points.replaceChildren();
      points.removeAttribute("clip-path");
      this.#paintCanvas(context, drawOrder, visible, margin, sized);
    } else {
      this.#themeWatch?.stop();
      this.#themeWatch = undefined;
      points.setAttribute("clip-path", sized ? "" : `url(#${clipId})`);
      if (sized) points.removeAttribute("clip-path");
      const built = join(
        points,
        drawOrder,
        (p) => p.key,
        (p): SVGElement =>
          p.point.image
            ? svg("g", {
                "data-point": "",
                style: "transform-box:fill-box;transform-origin:center",
              })
            : svg("circle", {
                "data-point": "",
                style: "transform-box:fill-box;transform-origin:center",
              }),
        (el, p) => this.#styleMark(el, p, sized, shadeIds),
      );
      built.forEach((el, index) => {
        this.#elements.set(drawOrder[index] as PlacedPoint, el);
        pointElements.push(el);
      });
      if (context.animate && built.length <= 600)
        built.forEach((el, index) => {
          el.animate(
            [
              { opacity: 0, transform: "scale(0)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 480, delay: Math.min(700, index * 12), easing: EASE, fill: "backwards" },
          );
        });
    }

    over.replaceChildren();
    const narrow = width < 480;
    this.#ring = svg("circle", {
      fill: "none",
      "stroke-width": 2,
      display: "none",
      "aria-hidden": "true",
      "data-e17": "ring",
    });
    if (trend)
      for (const item of visible) {
        const clean = item.source.points.filter(finite);
        const fit = linearRegression(clean);
        if (!fit) continue;
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        for (const point of clean) {
          if (point.x < lo) lo = point.x;
          if (point.x > hi) hi = point.x;
        }
        const [x1, y1, x2, y2] = [
          xScale.map(lo),
          yScale.map(fit.predict(lo)),
          xScale.map(hi),
          yScale.map(fit.predict(hi)),
        ];
        const group = svg("g", { "data-trend": "", "aria-hidden": "true" });
        group.append(
          svg("line", {
            x1,
            y1,
            x2,
            y2,
            "stroke-width": 4,
            "stroke-linecap": "round",
            style: "stroke:var(--surface);opacity:.8",
          }),
          svg("line", {
            x1,
            y1,
            x2,
            y2,
            "stroke-width": 2,
            "stroke-dasharray": "6 4",
            "stroke-linecap": "round",
            style: `stroke:${item.color}`,
          }),
        );
        if (!narrow)
          group.append(
            svg(
              "text",
              {
                x: Math.min(x2, innerWidth) - 4,
                y: y2 - 8,
                "text-anchor": "end",
                "data-e17": "note",
                style: `fill:${item.color}`,
              },
              `R² ${formatNumber(fit.r2, { maximumFractionDigits: 2, locale })}`,
            ),
          );
        over.append(group);
      }
    if (showLabels)
      for (const p of drawOrder) {
        const text = p.point.label;
        if (!text) continue;
        const textWidth = estimateTextWidth(text, 11);
        const inside = textWidth <= p.r * 1.8 && p.r >= 12;
        if (!inside && (narrow || p.x + p.r + 4 + textWidth > innerWidth)) continue;
        over.append(
          svg(
            "text",
            {
              x: inside ? p.x : p.x + p.r + 4,
              y: p.y,
              dy: "0.34em",
              "text-anchor": inside ? "middle" : "start",
              "data-e17": "cat",
              "data-series": p.series.id,
              "aria-hidden": "true",
              style: `pointer-events:none;font-size:11px;${inside ? "fill:var(--ink)" : ""}`,
            },
            text,
          ),
        );
      }
    const rect = this.#draft ?? this.#brushValue;
    if (rect) {
      const xa = xScale.map(rect.x0);
      const xb = xScale.map(rect.x1);
      const ya = yScale.map(rect.y0);
      const yb = yScale.map(rect.y1);
      over.append(
        svg("rect", {
          "data-e17": "selection",
          x: Math.min(xa, xb),
          y: Math.min(ya, yb),
          width: Math.abs(xb - xa),
          height: Math.abs(yb - ya),
          "stroke-width": 1.5,
          "stroke-dasharray": this.#draft ? undefined : "5 3",
          "aria-hidden": "true",
        }),
      );
    }
    over.append(this.#ring);
    if (keyOn) this.#sizeKey(over, maxSize, maxRadius, fs, copy.size, innerHeight);
    this.#paintRing(context.hover);
    this.#syncBrush(layout, copy);

    const names = (index: number) => {
      const p = readOrder[index] as PlacedPoint;
      return p.point.label
        ? visible.length > 1
          ? `${p.point.label} · ${p.series.source.name}`
          : p.point.label
        : p.series.source.name;
    };
    const rowsOf = (p: PlacedPoint): TooltipRow[] => [
      {
        id: "x",
        name: this.xAxis.title ?? "x",
        value: fx(p.point.x),
        color: p.series.color,
        shape: "dot",
      },
      { id: "y", name: this.yAxis.title ?? "y", value: fy(p.point.y), color: "transparent" },
      ...(sized && p.point.size != null
        ? [{ id: "size", name: copy.size, value: fs(p.point.size), color: "transparent" }]
        : []),
    ];
    const elements = this.#elements;
    return {
      summary: `${readOrder.length} points, ${visible.length} ${visible.length === 1 ? "series" : "series"}`,
      marks: {
        count: readOrder.length,
        label: (i) =>
          `${names(i)}: ${rowsOf(readOrder[i] as PlacedPoint)
            .map((row) => `${row.name} ${row.value}`)
            .join(", ")}`,
        element: (i) =>
          (elements.get(readOrder[i] as PlacedPoint) as SVGElement | undefined) ?? null,
      },
      maxHoverRows: sized ? 3 : 2,
      hit: (x, y, _target, reach) =>
        this.#index?.nearest(x - margin.left, y - margin.top, reach) ?? -1,
      hover: (i) => {
        const p = readOrder[i];
        if (!p) return null;
        return {
          title: names(i),
          rows: rowsOf(p),
          x: margin.left + p.x + p.r,
          y: margin.top + p.y,
        };
      },
      snapshot: () => {
        const rows = all.flatMap((item) =>
          item.source.points.filter(finite).map((point, index) => ({ item, point, index })),
        );
        const column = (
          id: string,
          name: string,
          texts: string[],
          values: Array<string | number>,
        ) => ({
          id,
          name,
          color: "transparent",
          values,
          text: texts,
        });
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: copy.point,
          categories: rows.map(
            ({ item, point, index }) => point.label ?? `${item.source.name} ${index + 1}`,
          ),
          series: [
            column(
              "series",
              copy.series,
              rows.map(({ item }) => item.source.name),
              rows.map(({ item }) => item.source.name),
            ),
            column(
              "x",
              this.xAxis.title ?? "x",
              rows.map(({ point }) => fx(point.x)),
              rows.map(({ point }) => point.x),
            ),
            column(
              "y",
              this.yAxis.title ?? "y",
              rows.map(({ point }) => fy(point.y)),
              rows.map(({ point }) => point.y),
            ),
            ...(sized
              ? [
                  column(
                    "size",
                    copy.size,
                    rows.map(({ point }) => (point.size != null ? fs(point.size) : "")),
                    rows.map(({ point }) => point.size ?? ""),
                  ),
                ]
              : []),
          ],
          legend: all.map((item) => ({
            id: item.id,
            name: item.source.name,
            color: item.color,
            shape: "dot" as const,
          })),
        };
      },
    };
  }

  #styleMark(el: SVGElement, p: PlacedPoint, sized: boolean, shadeIds: Map<number, string>): void {
    el.setAttribute("data-series", p.series.id);
    if (p.point.image) {
      el.replaceChildren(
        svg("circle", { cx: p.x, cy: p.y, r: p.r, style: "fill:var(--surface-2)" }),
        svg("image", {
          href: p.point.image,
          x: p.x - p.r,
          y: p.y - p.r,
          width: p.r * 2,
          height: p.r * 2,
          preserveAspectRatio: "xMidYMid slice",
          style: "clip-path:circle(50%)",
        }),
        svg("circle", {
          cx: p.x,
          cy: p.y,
          r: p.r,
          fill: "none",
          "stroke-width": 2,
          style: `stroke:${p.series.color}`,
        }),
      );
      return;
    }
    const shade = shadeIds.get(p.series.index);
    el.setAttribute("cx", `${p.x}`);
    el.setAttribute("cy", `${p.y}`);
    el.setAttribute("r", `${p.r}`);
    el.setAttribute("stroke-width", `${sized ? 1.5 : 1.25}`);
    el.setAttribute(
      "style",
      `transform-box:fill-box;transform-origin:center;fill:${shade ? `url(#${shade})` : p.series.color};fill-opacity:${shade ? 0.96 : sized ? 0.42 : 0.8};stroke:${
        shade ? tint(p.series.color, 70, "black") : sized ? p.series.color : "var(--surface)"
      }`,
    );
  }

  #paintCanvas(
    context: DrawContext,
    points: readonly PlacedPoint[],
    visible: readonly Colored[],
    margin: { left: number; top: number },
    sized: boolean,
  ): void {
    const g = context.canvas();
    g.translate(margin.left, margin.top);
    // Canvas needs concrete colors: resolve tokens through one probe element per paint.
    const holder = document.createElement("i");
    this.append(holder);
    const resolve = (color: string) => {
      holder.style.color = color;
      return getComputedStyle(holder).color;
    };
    const ring = resolve("var(--surface)");
    const bySeries = new Map<string, PlacedPoint[]>();
    for (const p of points) {
      const list = bySeries.get(p.series.id);
      if (list) list.push(p);
      else bySeries.set(p.series.id, [p]);
    }
    for (const item of visible) {
      const mine = bySeries.get(item.id);
      if (!mine?.length) continue;
      const fill = resolve(item.color);
      const faded = this.#dimmed !== null && this.#dimmed !== item.id ? 0.2 : 1;
      g.globalAlpha = (sized ? 0.5 : 0.75) * faded;
      g.fillStyle = fill;
      g.beginPath();
      for (const p of mine) {
        g.moveTo(p.x + p.r, p.y);
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      g.fill();
      if (sized || (mine[0] && mine[0].r >= 3)) {
        g.globalAlpha = 0.9 * faded;
        g.lineWidth = 1;
        g.strokeStyle = sized ? fill : ring;
        g.stroke();
      }
    }
    holder.remove();
    g.globalAlpha = 1;
    this.#watchTheme();
  }

  /** The canvas holds resolved colors, so a theme change must repaint it. */
  #watchTheme(): void {
    if (this.#themeWatch) return;
    const repaint = () => this.requestDraw("transient");
    const observer = new MutationObserver(repaint);
    const options = { attributes: true, attributeFilter: ["class", "data-theme", "style"] };
    observer.observe(document.documentElement, options);
    if (document.body) observer.observe(document.body, options);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", repaint);
    this.#themeWatch = {
      stop: () => {
        observer.disconnect();
        scheme.removeEventListener("change", repaint);
      },
    };
  }

  #sizeKey(
    over: SVGGElement,
    maxSize: number,
    maxRadius: number,
    format: (value: number) => string,
    label: string,
    innerHeight: number,
  ): void {
    const group = svg("g", {
      "aria-hidden": "true",
      transform: `translate(0,${innerHeight + 40})`,
    });
    let x = 0;
    const title = svg("text", { x, y: maxRadius, dy: "0.34em", "data-e17": "title" }, label);
    group.append(title);
    x += estimateTextWidth(label, 10.5) + 12;
    for (const share of [1, 0.5, 0.15]) {
      const r = maxRadius * Math.sqrt(share);
      const text = format(maxSize * share);
      group.append(
        svg("circle", {
          cx: x + r,
          cy: maxRadius,
          r,
          "stroke-width": 1.25,
          style: "fill:var(--chart-grid);stroke:var(--ink-3)",
        }),
        svg("text", { x: x + r * 2 + 4, y: maxRadius, dy: "0.34em", "data-e17": "tick" }, text),
      );
      x += r * 2 + 4 + estimateTextWidth(text) + 12;
    }
    over.append(group);
  }

  /** Rings the active point (hover, focus or pin) without redrawing. */
  #paintRing(index: number | null): void {
    const ring = this.#ring;
    const p = index === null ? undefined : this.#readOrder[index];
    if (!ring) return;
    ring.setAttribute("display", p ? "inline" : "none");
    if (!p) return;
    ring.setAttribute("cx", `${p.x}`);
    ring.setAttribute("cy", `${p.y}`);
    ring.setAttribute("r", `${p.r + 3.5}`);
    ring.setAttribute("style", `stroke:${p.series.color}`);
  }

  // ---- the rectangular brush --------------------------------------------------------------------

  #restoreOverlays(): void {
    if (this.hasAttribute("brush") && this.#slider && !this.#slider.isConnected)
      this.drawing.append(this.#slider, this.#live as HTMLElement);
  }

  #syncBrush(layout: XYLayout, copy: XYLabels): void {
    if (!this.hasAttribute("brush")) {
      this.#brush?.destroy();
      this.#brush = undefined;
      this.#brushLoad = false;
      this.#slider?.remove();
      this.#live?.remove();
      return;
    }
    const { margin, innerWidth, innerHeight, xScale, yScale } = layout;
    this.#slider ??= document.createElement("div");
    const slider = this.#slider;
    slider.dataset.e17 = "slider";
    slider.setAttribute("role", "slider");
    slider.tabIndex = 0;
    slider.setAttribute("aria-label", copy.brush);
    slider.setAttribute("aria-valuemin", "0");
    slider.setAttribute("aria-valuemax", "100");
    slider.setAttribute("aria-valuenow", this.#draft ? "100" : "0");
    slider.setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowRight Enter Escape",
    );
    Object.assign(slider.style, {
      position: "absolute",
      pointerEvents: "none",
      left: `${margin.left}px`,
      top: `${margin.top}px`,
      width: `${innerWidth}px`,
      height: `${innerHeight}px`,
      borderRadius: "4px",
    });
    this.#live ??= document.createElement("span");
    const live = this.#live;
    live.setAttribute("aria-live", "polite");
    live.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    if (!slider.isConnected) this.drawing.append(slider, live);
    const speak = (rect: BrushRect, applied: boolean) => {
      live.textContent = this.describeBrush?.(rect, applied) ?? "";
      slider.setAttribute("aria-valuetext", live.textContent || copy.brush);
    };
    const patch = {
      xDomain: xScale.domain as readonly [number, number],
      yDomain: yScale.domain as readonly [number, number],
      plot: () => ({ x: margin.left, y: margin.top, width: innerWidth, height: innerHeight }),
      value: this.#brushValue,
      keyTarget: slider,
      touchDelay: Math.max(0, numberAttr(this.getAttribute("touch-delay"), TOUCH_DELAY)),
      onDraft: (rect: BrushRect | null) => {
        this.#draft = rect;
        if (rect) speak(rect, false);
        this.requestDraw("transient");
      },
      onChange: (rect: BrushRect | null) => {
        this.#brushValue = rect;
        if (rect) speak(rect, true);
        else live.textContent = "";
        emit(this, "brush", rect);
        this.requestDraw("transient");
      },
    };
    if (this.#brush) this.#brush.update(patch);
    else if (!this.#brushLoad) {
      this.#brushLoad = true;
      import("@jcsoftdev/ui-core/chart/brush").then(({ attachBrush }) => {
        if (!this.isConnected || !this.hasAttribute("brush") || this.#brush) return;
        this.#brush = attachBrush(this.drawing, patch);
      });
    }
  }
}

export { formatPercent };
