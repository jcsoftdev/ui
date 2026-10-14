import { type CategoryLayout, categoryLayout } from "@jcsoftdev/ui-core/chart/distribution-layout";
import { resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { beeswarm } from "@jcsoftdev/ui-core/chart/swarm";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
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
  autoHeight,
  axisBottom,
  axisFormatOf,
  axisLeft,
  axisTitle,
  baseline,
  cssColor,
  gridLines,
  rowLabels,
} from "../internal/e19-axes.js";
import css from "./beeswarm.css.js";

/** Above this many dots the layer is a canvas; below it every dot is an SVG circle, kept by `join()`. */
const CANVAS_AT = 1500;
const ENTRY_DOTS = 600;
/** Rows of the data table of a canvas swarm. */
const TABLE_ROWS = 1000;

export interface BeeswarmPoint {
  value: number;
  /** Row (or column) of the point; all points share one row when omitted. */
  category?: string;
  /** Drives the radius (area-proportional) when the chart has sizes. */
  size?: number;
  /** Name shown in the tooltip and data table, e.g. the client. */
  label?: string;
}

export interface BeeswarmSeries {
  id: string;
  name: string;
  points: readonly BeeswarmPoint[];
  color?: string;
}

/** Strings the beeswarm adds to the base labels. */
export interface BeeswarmLabels {
  value: string;
  size: string;
  series: string;
  category: string;
  point: string;
}
const DEFAULT_TEXT: BeeswarmLabels = {
  value: "Value",
  size: "Size",
  series: "Series",
  category: "Category",
  point: "Point",
};

interface Placed {
  key: string;
  series: BeeswarmSeries;
  seriesIndex: number;
  point: BeeswarmPoint;
  category: number;
  x: number;
  y: number;
  r: number;
}

const numbers = (text: string | null): number[] | undefined => {
  const parts = text
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return parts?.length && parts.every(Number.isFinite) ? parts : undefined;
};

/**
 * `<ui-beeswarm>`: every observation is a dot on the value axis, nudged sideways just enough that
 * no two overlap, so clusters read as density while each point stays individually explorable (the
 * React `BeeswarmChart`). Up to 1500 dots are SVG circles updated with `join()`; beyond that they
 * are painted on the canvas layer and named by virtual marks. One tab stop: the arrows walk the
 * points in reading order (row by row, along the value axis), Up and Down jump a row.
 * Attributes: `orientation` (`horizontal` rows or `vertical` columns), `radius`, `gap`,
 * `size-range` (`3,14`), `grid="off"`, `axis-min`, `axis-max`, `axis-ticks`, `axis-title`, plus the
 * chart attributes. Properties: `series`, `categories`, `sizeFormat`, `labels`.
 */
export class UiBeeswarm extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "orientation",
    "radius",
    "gap",
    "size-range",
    "grid",
    "axis-min",
    "axis-max",
    "axis-ticks",
    "axis-title",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels & BeeswarmLabels>;
  sizeFormat: ValueFormat | undefined;
  #series: readonly BeeswarmSeries[] = [];
  #categories: readonly string[] | undefined;
  #dimmed: string | null = null;
  #canvas = false;
  #rings = new Map<number, SVGCircleElement>();
  #parts: { axes: SVGGElement; dots: SVGGElement; rings: SVGGElement } | undefined;
  /** The last layout, reused while the size, the data and every attribute stay the same. */
  #last:
    | { key: string; layout: CategoryLayout; points: Placed[]; series: unknown; categories: unknown; hidden: string }
    | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.series, (event) => {
      const detail = (event as CustomEvent<{ highlight?: string | null }>).detail;
      if (detail && "highlight" in detail) {
        this.#dimmed = detail.highlight ?? null;
        if (this.#canvas) this.requestDraw("transient");
      }
    });
  }

  get series(): readonly BeeswarmSeries[] {
    return this.#series;
  }
  set series(value: readonly BeeswarmSeries[]) {
    this.#series = value;
    this.#size();
    this.requestDraw();
  }
  get categories(): readonly string[] | undefined {
    return this.#categories;
  }
  set categories(value: readonly string[] | undefined) {
    this.#categories = value;
    this.#size();
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "beeswarm";
    adoptStyles(rootOf(this), css);
    this.#size();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "orientation") this.#size();
    super.attributeChangedCallback(name);
  }

  /** Rows need room: the drawing grows with the number of categories unless the author set a height. */
  #size(): void {
    autoHeight(
      this,
      this.getAttribute("orientation") === "vertical"
        ? 340
        : Math.max(200, this.#categoryList().length * 96 + 48),
    );
  }

  #warned = false;
  #warnOnce(message: string): void {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(`<ui-beeswarm>: ${message}`);
  }

  #categoryList(): readonly string[] {
    if (this.#categories) return this.#categories;
    const seen = new Set<string>();
    for (const item of this.#series)
      for (const point of item.points) seen.add(point.category ?? "");
    return seen.size ? [...seen] : [""];
  }

  protected override isEmpty(): boolean {
    return !this.#series.some((item) => item.points.some((point) => Number.isFinite(point.value)));
  }

  #layers(root: SVGSVGElement) {
    if (this.#parts?.axes.parentNode !== root) {
      this.#parts = { axes: svg("g"), dots: svg("g"), rings: svg("g") };
      root.replaceChildren(this.#parts.axes, this.#parts.dots, this.#parts.rings);
    }
    return this.#parts;
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, format, color, animate, locale } = context;
    const text: BeeswarmLabels = { ...DEFAULT_TEXT, ...this.labels };
    const horizontalAttr = this.getAttribute("orientation") !== "vertical";
    const categories = this.#categoryList();
    const all = this.#series;
    const visible = all.filter((item) => !this.isHidden(item.id));
    const sizeFormat = resolveFormat(this.sizeFormat, { locale });
    const sized = all.some((item) => item.points.some((point) => point.size != null));
    const parts = this.#layers(root);

    const hidden = visible.map((item) => item.id).join("\u0000");
    const key = `${width}x${height}|${locale}|${horizontalAttr}|${UiBeeswarm.observedAttributes.map((name) => this.getAttribute(name)).join("&")}`;
    const last = this.#last;
    let layout: CategoryLayout;
    let points: Placed[];
    if (
      last?.key === key &&
      last.series === all &&
      last.categories === this.#categories &&
      last.hidden === hidden
    ) {
      ({ layout, points } = last);
    } else {
      ({ layout, points } = this.#place(context, categories, visible, all, sized, horizontalAttr));
      this.#last = { key, layout, points, series: all, categories: this.#categories, hidden };
    }
    const { margin, innerWidth, innerHeight, horizontal } = layout;
    const title = this.getAttribute("axis-title") ?? undefined;

    const axes = parts.axes;
    axes.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    axes.replaceChildren();
    if (this.getAttribute("grid") !== "off")
      axes.append(
        gridLines(
          layout.valueTicks,
          horizontal ? "vertical" : "horizontal",
          horizontal ? innerHeight : innerWidth,
        ),
      );
    if (horizontal) {
      axes.append(rowLabels(layout.categoryTicks), axisBottom(layout.valueTicks, innerHeight));
      if (title) axes.append(axisTitle(title, innerWidth, -10));
    } else {
      axes.append(
        axisLeft(layout.valueTicks, 0, title),
        axisBottom(layout.categoryTicks, innerHeight),
      );
    }
    axes.append(
      baseline(0, horizontal ? 0 : innerWidth, horizontal ? 0 : innerHeight, innerHeight),
    );

    // Dots: the plot sits at the margin, so the points are placed in drawing coordinates.
    this.#canvas = points.length > CANVAS_AT;
    parts.rings.replaceChildren();
    this.#rings.clear();
    const dim = (seriesId: string) => this.#dimmed !== null && this.#dimmed !== seriesId;
    let dots: SVGCircleElement[] = [];
    if (this.#canvas) {
      parts.dots.replaceChildren();
      const g = context.canvas();
      const surface = cssColor(this, "var(--surface)");
      const fills = new Map<string, string>();
      g.lineWidth = 1;
      g.strokeStyle = surface;
      for (const p of points) {
        let fill = fills.get(p.series.id);
        if (!fill) {
          fill = cssColor(this, color(p.seriesIndex, p.series.color));
          fills.set(p.series.id, fill);
        }
        g.globalAlpha = dim(p.series.id) ? 0.2 : 1;
        g.fillStyle = fill;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.globalAlpha *= 0.82;
        g.fill();
        g.globalAlpha = dim(p.series.id) ? 0.2 : 1;
        g.stroke();
      }
      g.globalAlpha = 1;
    } else {
      dots = join(
        parts.dots,
        points,
        (p) => p.key,
        () => svg("circle", { "data-dot": "", "stroke-width": 1, "aria-hidden": "true" }),
        (el, p) => {
          el.setAttribute("cx", `${p.x}`);
          el.setAttribute("cy", `${p.y}`);
          el.setAttribute("r", `${p.r}`);
          el.setAttribute("data-series", p.series.id);
          el.style.cssText = `fill:${color(p.seriesIndex, p.series.color)};fill-opacity:.82;stroke:var(--surface)`;
        },
      );
      if (animate && points.length <= ENTRY_DOTS)
        dots.forEach((dot, index) => {
          dot.animate(
            [
              { opacity: 0, transform: "scale(0.2)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 420,
              delay: Math.min(900, index * 6),
              easing: "cubic-bezier(.34,1.56,.64,1)",
              fill: "backwards",
            },
          );
        });
    }

    const ringOf = (index: number): SVGCircleElement | null => {
      const p = points[index];
      if (!p) return null;
      let ring = this.#rings.get(index);
      if (!ring) {
        if (this.#rings.size > 6) {
          const [oldest] = this.#rings.keys();
          if (oldest !== undefined) {
            this.#rings.get(oldest)?.remove();
            this.#rings.delete(oldest);
          }
        }
        ring = svg("circle", {
          "data-ring": "",
          cx: p.x,
          cy: p.y,
          r: p.r + 3,
          "aria-hidden": "true",
          style: `stroke:${color(p.seriesIndex, p.series.color)}`,
        });
        parts.rings.append(ring);
        this.#rings.set(index, ring);
      }
      return ring;
    };

    const titleOf = (p: Placed) => p.point.label ?? (categories[p.category] || p.series.name);
    const rowsOf = (p: Placed): TooltipRow[] => [
      {
        id: "value",
        name: visible.length > 1 ? p.series.name : text.value,
        value: format(p.point.value),
        color: color(p.seriesIndex, p.series.color),
        shape: "dot",
      },
      ...(p.point.size != null && sized
        ? [{ id: "size", name: text.size, value: sizeFormat(p.point.size), color: "transparent" }]
        : []),
    ];
    // First point of every row, for Up and Down.
    const rowStart: number[] = [];
    points.forEach((p, i) => {
      if (rowStart[p.category] === undefined) rowStart[p.category] = i;
    });
    const rows = [...rowStart.keys()].filter((c) => rowStart[c] !== undefined);

    return {
      summary: `${points.length} points in ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`,
      maxHoverRows: sized ? 2 : 1,
      marks: {
        count: points.length,
        label: (i) => {
          const p = points[i] as Placed;
          const where =
            p.point.label && categories[p.category] ? `, ${categories[p.category]}` : "";
          return `${titleOf(p)}${where}: ${rowsOf(p)
            .map((row) => `${row.name} ${row.value}`)
            .join(", ")}`;
        },
        element: ringOf,
      },
      hit: (x, y, _target, radius) => {
        let best = -1;
        let bestGap = Number.POSITIVE_INFINITY;
        for (let i = 0; i < points.length; i += 1) {
          const p = points[i] as Placed;
          const gap = Math.hypot(p.x - x, p.y - y) - p.r;
          if (gap < bestGap && gap <= radius) {
            best = i;
            bestGap = gap;
          }
        }
        return best;
      },
      hover: (i): HoverContent | null => {
        const p = points[i];
        if (!p) return null;
        return {
          title:
            p.point.label && categories[p.category]
              ? `${p.point.label} · ${categories[p.category]}`
              : titleOf(p),
          rows: rowsOf(p),
          x: p.x + p.r,
          y: p.y,
          category: p.category,
        };
      },
      nav: (index, intent) => {
        const p = points[index];
        if (!p) return undefined;
        if (intent === "left") return Math.max(0, index - 1);
        if (intent === "right") return Math.min(points.length - 1, index + 1);
        if (intent === "home") return 0;
        if (intent === "end") return points.length - 1;
        const at = rows.indexOf(p.category);
        const target = rows[at + (intent === "down" ? 1 : -1)];
        return target === undefined ? index : rowStart[target];
      },
      snapshot: () => {
        // A canvas-sized swarm lists its first rows only: a table of every dot would defeat the canvas.
        const flat: Array<{ item: BeeswarmSeries; seriesIndex: number; point: BeeswarmPoint; index: number }> = [];
        const limit = this.#canvas ? TABLE_ROWS : Number.POSITIVE_INFINITY;
        all.forEach((item, seriesIndex) =>
          item.points.forEach((point, index) => {
            if (flat.length < limit && Number.isFinite(point.value))
              flat.push({ item, seriesIndex, point, index });
          }),
        );
        const column = (
          id: string,
          name: string,
          cell: (row: (typeof flat)[number]) => string,
        ) => ({
          id,
          name,
          color: "var(--ink-3)",
          values: flat.map(cell),
          text: flat.map(cell),
        });
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: text.point,
          categories: flat.map(
            ({ item, point, index }) =>
              point.label ?? `${point.category ?? item.name} ${index + 1}`,
          ),
          series: [
            column("series", text.series, ({ item }) => item.name),
            column("row", text.category, ({ point }) => point.category ?? ""),
            {
              id: "value",
              name: text.value,
              color: "var(--ink-3)",
              values: flat.map(({ point }) => point.value),
              text: flat.map(({ point }) => format(point.value)),
            },
            ...(sized
              ? [
                  {
                    id: "size",
                    name: text.size,
                    color: "var(--ink-3)",
                    values: flat.map(({ point }) => point.size ?? null),
                    text: flat.map(({ point }) =>
                      point.size != null ? sizeFormat(point.size) : "",
                    ),
                  },
                ]
              : []),
          ],
          legend: all.map((item, seriesIndex) => ({
            id: item.id,
            name: item.name,
            color: color(seriesIndex, item.color),
            shape: "dot" as const,
          })),
        };
      },
    };
  }

  /** Lays the dots out: the category geometry, then one swarm per row, shrunk until it fits its row. */
  #place(
    context: DrawContext,
    categories: readonly string[],
    visible: readonly BeeswarmSeries[],
    all: readonly BeeswarmSeries[],
    sized: boolean,
    horizontalAttr: boolean,
  ) {
    const { width, height, locale } = context;
    const radius = Number(this.getAttribute("radius")) || 4.5;
    const gap = this.getAttribute("gap") === null ? 1.25 : Number(this.getAttribute("gap"));
    const sizeRange = numbers(this.getAttribute("size-range")) ?? [3, 14];
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    let maxSize = 0;
    for (const item of visible)
      for (const point of item.points) {
        if (!Number.isFinite(point.value)) continue;
        if (point.value < lo) lo = point.value;
        if (point.value > hi) hi = point.value;
        if (point.size != null && point.size > maxSize) maxSize = point.size;
      }
    const min = this.getAttribute("axis-min");
    const max = this.getAttribute("axis-max");
    const ticks = this.getAttribute("axis-ticks");
    const layout = categoryLayout({
      width,
      height,
      orientation: horizontalAttr ? "horizontal" : "vertical",
      categories,
      seriesCount: 1,
      extent: Number.isFinite(lo) ? [lo, hi] : null,
      format: axisFormatOf(this, locale),
      axis: {
        min: min === null ? undefined : Number(min),
        max: max === null ? undefined : Number(max),
        tickCount: ticks === null ? undefined : Number(ticks),
      },
      title: this.hasAttribute("axis-title"),
      padding: 0.1,
    });
    const horizontal = layout.horizontal;
    const radiusOf = (point: BeeswarmPoint) =>
      sized
        ? Math.max(
            sizeRange[0] as number,
            (sizeRange[1] ?? 14) * Math.sqrt(Math.max(0, point.size ?? 0) / (maxSize || 1)),
          )
        : radius;
    const rowOf = new Map(categories.map((name, row) => [name, row] as const));
    const members: Array<
      Array<{ series: BeeswarmSeries; seriesIndex: number; point: BeeswarmPoint; index: number }>
    > = categories.map(() => []);
    for (const item of visible) {
      const seriesIndex = all.indexOf(item);
      item.points.forEach((point, index) => {
        if (!Number.isFinite(point.value)) return;
        const row = rowOf.get(point.category ?? (categories[0] as string));
        if (row !== undefined)
          (members[row] as (typeof members)[number]).push({
            series: item,
            seriesIndex,
            point,
            index,
          });
      });
    }
    const placed: Placed[] = [];
    const taken = new Map<string, number>();
    const unique = all.map((item) => {
      const seen = taken.get(item.id) ?? 0;
      taken.set(item.id, seen + 1);
      return seen ? `${item.id}~${seen}` : item.id;
    });
    if (taken.size < all.length || new Set(categories).size < categories.length)
      this.#warnOnce("duplicate series ids or categories: dots stay separate, but ids should be unique");
    members.forEach((row, category) => {
      if (row.length === 0) return;
      const slot = layout.slot(category, 0);
      const limit = slot.size / 2;
      let scale = 1;
      let offsets: number[] = [];
      for (let pass = 0; pass < 4; pass += 1) {
        const swarm = row.map(({ point }) => ({
          position: layout.valueScale.map(point.value),
          radius: radiusOf(point) * scale,
        }));
        offsets = beeswarm(swarm, { gap });
        let reach = 0;
        offsets.forEach((offset, i) => {
          reach = Math.max(reach, Math.abs(offset) + (swarm[i]?.radius ?? 0));
        });
        if (reach <= limit) break;
        scale *= Math.max(0.35, (limit / reach) * 0.98);
      }
      row.forEach(({ series, seriesIndex, point, index }, i) => {
        const along = layout.valueScale.map(point.value);
        const cross = slot.center + Math.max(-limit, Math.min(limit, offsets[i] ?? 0));
        placed.push({
          key: `${unique[seriesIndex]}-${index}`,
          series,
          seriesIndex,
          point,
          category,
          x: layout.margin.left + (horizontal ? along : cross),
          y: layout.margin.top + (horizontal ? cross : along),
          r: Math.max(1.25, radiusOf(point) * scale),
        });
      });
    });
    // Reading order: row by row, then along the value axis.
    placed.sort((a, b) => a.category - b.category || a.point.value - b.point.value);
    return { layout, points: placed };
  }
}

/** Registers `<ui-beeswarm>` (or `<prefix>-beeswarm`) and returns the tag. */
export function defineBeeswarm(options?: DefineOptions): string {
  return defineElement("beeswarm", UiBeeswarm, options);
}
