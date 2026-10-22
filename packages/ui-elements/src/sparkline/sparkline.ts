import { adoptStyles, type DefineOptions, defineElement, rootOf, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  svg,
} from "../internal/chart-base.js";
import { nearestX } from "../internal/chart-hit.js";
import css from "./sparkline.css.js";

const PAD = 3;
const EASE = "cubic-bezier(.22,1,.36,1)";

type Pt = { x: number; y: number };

/** `"1, 2,, 4"` to `[1, 2, null, 4]`. */
const parse = (text: string | null): Array<number | null> =>
  text
    ? text
        .split(text.includes(",") ? "," : /\s+/)
        .map((part) => (part.trim() === "" || part.trim() === "-" ? null : Number(part)))
    : [];

/** Monotone cubic path through `p` (Fritsch-Carlson): smooth, and never overshoots the data. */
function curve(p: Pt[]): string {
  const [first] = p;
  if (!first) return "";
  const n = p.length;
  if (n === 1) return `M${first.x} ${first.y}h.01`;
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [a, b] = [p[i] as Pt, p[i + 1] as Pt];
    s.push((b.y - a.y) / (b.x - a.x || 1));
  }
  const t = p.map((_, i) =>
    i === 0
      ? (s[0] as number)
      : i === n - 1
        ? (s[n - 2] as number)
        : (s[i - 1] as number) * (s[i] as number) <= 0
          ? 0
          : ((s[i - 1] as number) + (s[i] as number)) / 2,
  );
  let d = `M${first.x} ${first.y}`;
  for (let i = 0; i < n - 1; i++) {
    const [a, b, m] = [p[i] as Pt, p[i + 1] as Pt, s[i] as number];
    let [u, v] = [(t[i] as number) / m || 0, (t[i + 1] as number) / m || 0];
    const k = Math.hypot(u, v);
    if (k > 3) [u, v] = [(u * 3) / k, (v * 3) / k];
    const w = (b.x - a.x) / 3;
    d += `C${a.x + w} ${a.y + w * u * m} ${b.x - w} ${b.y - w * v * m} ${b.x} ${b.y}`;
  }
  return d;
}

/** Runs of consecutive points; a gap (`null`) ends a run. */
function runs(points: ReadonlyArray<Pt | null>): Pt[][] {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  for (const point of points) {
    if (point) run.push(point);
    else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

/**
 * `<ui-sparkline>`: a word-sized chart for KPI tiles on the chart base, with no axes or legend.
 * Hovering (or focusing, with `explore`) shows the point's value; screen readers get the `label` as
 * the name and one sentence (first, last, minimum, maximum) as the description, and the sparkline
 * is a single image unless `explore` adds arrow-key access to every point.
 * Attributes: `data` (numbers separated by commas; empty entries are gaps), `type` (`line`,
 * `area`, `bar`), `color`, `height` (px, default 36, or `fill`), `width` (fixed px), `last="off"`,
 * `highlight-index` (bars), `explore`, plus the chart attributes (`label`, `locale`, `value-format`
 * ...). Properties: `data`, `categories` (point names shown next to the value). A tap on touch pins the nearest point.
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
  #show: typeof import("./sparkline-value.js").showValue | undefined;
  readonly #gradient = uid("spark");
  #ownWidth = false;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      if (this.#show) this.#show(this, info);
      else
        import("./sparkline-value.js").then(({ showValue }) => {
          this.#show = showValue;
          showValue(this, info);
        });
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
    this.#syncWidth();
    if (!this.hasAttribute("height")) this.setAttribute("height", "36");
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "width") this.#syncWidth();
    super.attributeChangedCallback(name);
  }

  /** The `width` attribute sets an inline width; an inline width the author set is never touched. */
  #syncWidth(): void {
    const width = this.getAttribute("width");
    if (width) {
      this.style.width = `${width}px`;
      this.#ownWidth = true;
    } else if (this.#ownWidth) {
      this.style.removeProperty("width");
      this.#ownWidth = false;
    }
  }

  protected override isEmpty(): boolean {
    return this.data.every((value) => value == null);
  }

  protected draw({ svg: root, width, height, format, color, animate }: DrawContext): DrawResult {
    const data = this.data;
    const type = this.getAttribute("type");
    const bars = type === "bar";
    const stroke = this.getAttribute("color") ?? color(0);
    const values = data.filter((value): value is number => value != null);
    const lo0 = Math.min(...values);
    const hi0 = Math.max(...values);
    const lo = bars ? Math.min(0, lo0) : lo0;
    const span = (bars ? Math.max(0, hi0) : hi0) - lo || 1;
    const y = (value: number) => PAD + (1 - (value - lo) / span) * (height - PAD * 2);
    const highlight = Number(this.getAttribute("highlight-index") ?? Number.NaN);
    const count = data.length;
    const step = (bars ? width : width - PAD * 2) / Math.max(1, bars ? count : count - 1);
    const x = (index: number) => (bars ? (index + 0.5) * step : PAD + index * step);
    const points = data.map((value, index) =>
      value == null ? null : { x: x(index), y: y(value) },
    );
    const group = svg("g");
    if (bars) {
      const zero = y(0);
      const inner = step * 0.72;
      data.forEach((value, index) => {
        if (value == null) return;
        const top = Math.min(y(value), zero);
        const bar = svg("rect", {
          x: x(index) - inner / 2,
          y: top,
          width: inner,
          height: Math.max(1, Math.abs(y(value) - zero)),
          rx: Math.min(2, inner / 2),
          "data-bar": index,
          style: `fill:${stroke};transform-box:fill-box;transform-origin:center ${value >= 0 ? "bottom" : "top"}`,
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
      const inner = svg("g");
      const paths = runs(points).map(curve);
      if (type === "area") {
        root.append(
          svg(
            "defs",
            {},
            svg(
              "linearGradient",
              { id: this.#gradient, x1: 0, y1: 0, x2: 0, y2: 1 },
              svg("stop", { offset: "0%", style: `stop-color:${stroke};stop-opacity:.32` }),
              svg("stop", { offset: "100%", style: `stop-color:${stroke};stop-opacity:0` }),
            ),
          ),
        );
        inner.append(
          svg("path", {
            d: runs(points)
              .map((run, i) => {
                const a = run[0] as Pt;
                const z = run[run.length - 1] as Pt;
                return `${paths[i]}L${z.x} ${height}L${a.x} ${height}Z`;
              })
              .join(""),
            style: `fill:url(#${this.#gradient})`,
          }),
        );
      }
      inner.append(
        svg("path", {
          d: paths.join(""),
          fill: "none",
          "stroke-width": 1.75,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          style: `stroke:${stroke}`,
        }),
      );
      const p = [...points].reverse().find((q): q is Pt => !!q);
      if (this.getAttribute("last") !== "off" && p)
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
      group.append(inner);
      if (animate)
        inner.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 -4px 0 0)" }], {
          duration: 700,
          easing: EASE,
          fill: "backwards",
        });
    }
    root.append(group);
    const first = values[0];
    const summary =
      first !== undefined
        ? `${format(first)} → ${format(values[values.length - 1] as number)} (min ${format(lo0)}, max ${format(hi0)})`
        : undefined;
    const names = this.#categories;
    return {
      summary,
      marks: this.hasAttribute("explore")
        ? {
            count,
            label: (i) => {
              const value = data[i];
              return `${names?.[i] ?? i + 1}: ${value == null ? "-" : format(value)}`;
            },
          }
        : undefined,
      hit: (px) => nearestX(points, px),
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
