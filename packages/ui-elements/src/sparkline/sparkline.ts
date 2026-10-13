import { areaPath, barPath, linePath, type Point } from "@jcsoftdev/ui-core/chart/path";
import { bandScale, extent, pointScale } from "@jcsoftdev/ui-core/chart/scale";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  svg,
} from "../internal/chart-base.js";
import css from "./sparkline.css.js";

const PAD = 3;
const EASE = "cubic-bezier(.22,1,.36,1)";

/** `"1, 2,, 4"` to `[1, 2, null, 4]`. */
const parse = (text: string | null): Array<number | null> =>
  text
    ? text.split(/[\s,]+/).map((part) => (part === "" || part === "-" ? null : Number(part)))
    : [];

/**
 * `<ui-sparkline>`: a word-sized chart for KPI tiles on the chart base, with no axes or legend.
 * Hovering (or focusing, with `explore`) shows the point's value; screen readers get the `label` as
 * the name and one sentence (first, last, minimum, maximum) as the description, and the sparkline
 * is a single image unless `explore` adds arrow-key access to every point.
 * Attributes: `data` (numbers separated by commas; empty entries are gaps), `type` (`line`,
 * `area`, `bar`), `color`, `height` (px, default 36, or `fill`), `width` (fixed px), `last="off"`,
 * `highlight-index` (bars), `explore`, plus the chart attributes (`label`, `locale`, `value-format`
 * ...). Properties: `data`, `categories` (point names shown next to the value).
 */
export class UiSparkline extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "type",
    "color",
    "width",
    "last",
    "highlight-index",
    "explore",
  ];
  protected override tableFallback = false;
  #data: ReadonlyArray<number | null> | undefined;
  #categories: readonly string[] | undefined;
  #dot: SVGCircleElement | undefined;
  readonly #pill = document.createElement("div");

  constructor() {
    super();
    this.#pill.dataset.uiPart = "value";
    this.#pill.setAttribute("aria-hidden", "true");
    this.#pill.hidden = true;
    this.addEventListener(CHART_EVENT.hover, (event) => {
      this.#showValue((event as CustomEvent<HoverInfo | null>).detail);
    });
  }

  get data(): ReadonlyArray<number | null> {
    return this.#data ?? parse(this.getAttribute("data"));
  }
  set data(value: ReadonlyArray<number | null>) {
    this.#data = value;
    this.requestDraw();
  }
  get categories(): readonly string[] | undefined {
    return this.#categories;
  }
  set categories(value: readonly string[] | undefined) {
    this.#categories = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "sparkline";
    adoptStyles(rootOf(this), css);
    const width = this.getAttribute("width");
    this.style.width = width ? `${width}px` : "";
    if (!this.hasAttribute("height")) this.setAttribute("height", "36");
    super.connectedCallback();
    this.append(this.#pill);
  }

  override attributeChangedCallback(name: string): void {
    if (name === "width")
      this.style.width = this.getAttribute("width") ? `${this.getAttribute("width")}px` : "";
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.data.every((value) => value == null);
  }

  #showValue(info: HoverInfo | null): void {
    this.#pill.hidden = !info;
    if (this.#dot) this.#dot.style.display = info ? "" : "none";
    if (!info) return;
    const row = info.rows[0];
    this.#pill.textContent = `${info.title ? `${info.title} ` : ""}${row?.value ?? ""}`;
    const half = this.#pill.offsetWidth / 2 + 4;
    const x = Math.min(Math.max(info.x, half), Math.max(half, this.drawing.clientWidth - half));
    this.#pill.style.left = `${this.drawing.offsetLeft + x}px`;
    this.#dot?.setAttribute("cx", `${info.x}`);
    this.#dot?.setAttribute("cy", `${info.y}`);
  }

  protected draw({ svg: root, width, height, format, color, animate }: DrawContext): DrawResult {
    const data = this.data;
    const type =
      this.getAttribute("type") === "bar"
        ? "bar"
        : this.getAttribute("type") === "area"
          ? "area"
          : "line";
    const stroke = this.getAttribute("color") ?? color(0);
    const [lo0, hi0] = extent(data) ?? [0, 1];
    const lo = type === "bar" ? Math.min(0, lo0) : lo0;
    const hi = type === "bar" ? Math.max(0, hi0) : hi0;
    const span = hi - lo || 1;
    const y = (value: number) => PAD + (1 - (value - lo) / span) * (height - PAD * 2);
    const highlight = Number(this.getAttribute("highlight-index") ?? Number.NaN);
    const points: Array<Point | null> = [];
    let indexAt: (px: number) => number;
    const group = svg("g");
    if (type === "bar") {
      const band = bandScale({
        count: data.length,
        range: [0, width],
        paddingInner: 0.28,
        paddingOuter: 0,
      });
      indexAt = band.indexAt;
      const zero = y(0);
      data.forEach((value, index) => {
        if (value == null) {
          points.push(null);
          return;
        }
        points.push({ x: band.center(index), y: y(value) });
        const top = Math.min(y(value), zero);
        const bar = svg("path", {
          d: barPath(
            band.start(index),
            top,
            band.bandwidth,
            Math.max(1, Math.abs(y(value) - zero)),
            2,
            value >= 0 ? "top" : "bottom",
          ),
          "data-bar": index,
          style: `fill:${stroke};transform-box:fill-box;transform-origin:center bottom`,
        });
        if (Number.isFinite(highlight) && highlight !== index) bar.dataset.dim = "";
        group.append(bar);
        if (animate)
          bar.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
            duration: 480,
            delay: index * 18,
            easing: EASE,
            fill: "backwards",
          });
      });
    } else {
      const scale = pointScale({ count: data.length, range: [PAD, width - PAD] });
      indexAt = scale.indexAt;
      data.forEach((value, index) => {
        points.push(value == null ? null : { x: scale.center(index), y: y(value) });
      });
      const bottom = points.map((point, index) => ({
        x: point?.x ?? scale.center(index),
        y: height,
      }));
      const inner = svg("g");
      if (type === "area") {
        const gradient = `${this.id || "ui-spark"}-fill`;
        root.append(
          svg(
            "defs",
            {},
            svg(
              "linearGradient",
              { id: gradient, x1: 0, y1: 0, x2: 0, y2: 1 },
              svg("stop", { offset: "0%", style: `stop-color:${stroke};stop-opacity:.32` }),
              svg("stop", { offset: "100%", style: `stop-color:${stroke};stop-opacity:0` }),
            ),
          ),
        );
        inner.append(
          svg("path", { d: areaPath(points, bottom, "smooth"), style: `fill:url(#${gradient})` }),
        );
      }
      inner.append(
        svg("path", {
          d: linePath(points, "smooth"),
          fill: "none",
          "stroke-width": 1.75,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          style: `stroke:${stroke}`,
        }),
      );
      let last = points.length - 1;
      while (last >= 0 && !points[last]) last--;
      if (this.getAttribute("last") !== "off" && last >= 0) {
        const p = points[last] as Point;
        inner.append(
          svg("circle", {
            cx: p.x,
            cy: p.y,
            r: 2.75,
            "stroke-width": 1.5,
            "data-last": "",
            style: `fill:${stroke};stroke:var(--surface)`,
          }),
        );
      }
      group.append(inner);
      if (animate)
        inner.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 -4px 0 0)" }], {
          duration: 700,
          easing: EASE,
          fill: "backwards",
        });
    }
    root.append(group);
    this.#dot = svg("circle", {
      r: 3.5,
      "stroke-width": 2,
      style: `fill:${stroke};stroke:var(--surface);display:none`,
      "pointer-events": "none",
    });
    root.append(this.#dot);

    const values = data.filter((value): value is number => value != null);
    const first = values[0];
    const summary =
      values.length && first !== undefined
        ? `${format(first)} → ${format(values[values.length - 1] as number)} (min ${format(Math.min(...values))}, max ${format(Math.max(...values))})`
        : undefined;
    const names = this.#categories;
    const marks: ChartMark[] = [];
    if (this.hasAttribute("explore")) {
      const step = width / Math.max(1, data.length);
      data.forEach((value, index) => {
        if (value == null) return;
        const el = svg("rect", { x: index * step, y: 0, width: step, height, fill: "transparent" });
        root.append(el);
        marks.push({ el, label: `${names?.[index] ?? index + 1}: ${format(value)}` });
      });
    }
    const valid = data.map((_, index) => index).filter((index) => data[index] != null);
    return {
      summary,
      marks,
      hit: (px) => {
        const index = indexAt(px);
        return index >= 0 && data[index] != null
          ? index
          : valid.reduce(
              (best, i) => (Math.abs(i - index) < Math.abs(best - index) ? i : best),
              valid[0] ?? -1,
            );
      },
      hover: (index) => {
        const value = data[index];
        const point = points[index];
        if (value == null || !point) return null;
        return {
          title: names?.[index],
          rows: [{ id: "value", name: names?.[index] ?? "", value: format(value), color: stroke }],
          x: point.x,
          y: point.y,
        };
      },
    };
  }
}

/** Registers `<ui-sparkline>` (or `<prefix>-sparkline`) and returns the tag. */
export function defineSparkline(options?: DefineOptions): string {
  return defineElement("sparkline", UiSparkline, options);
}
