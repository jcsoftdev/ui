import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  assignLanes,
  clockTicks,
  fitLaneHeight,
  formatClock,
  hourEdge,
} from "@jcsoftdev/ui-core/chart/lanes";
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
import { autoHeight, axisBottom, EASE, gridLines, hasAutoHeight } from "../internal/e19-axes.js";
import css from "./timeline-chart.css.js";

export interface TimelineRow {
  id: string;
  /** Row title, e.g. the barber's name. */
  label: string;
}

export interface TimelineItem {
  id: string;
  rowId: string;
  start: Date | number;
  end: Date | number;
  /** Text inside the bar when it fits, e.g. the client's name. */
  label?: string;
  /** Group id (status); picks the color and the legend entry. */
  group?: string;
  /** Second line in the tooltip, e.g. the service. */
  detail?: string;
}

export interface TimelineGroup {
  id: string;
  name: string;
  /** CSS color; defaults to the palette slot. */
  color?: string;
}

/** Strings the timeline adds to the base labels. */
export interface TimelineLabels {
  group: string;
  row: string;
  time: string;
  duration: string;
  now: string;
  minutes: string;
  hours: string;
  category: string;
}
const DEFAULT_TEXT: TimelineLabels = {
  group: "Status",
  row: "Row",
  time: "Time",
  duration: "Duration",
  now: "Now",
  minutes: "min",
  hours: "h",
  category: "Item",
};

const MARGIN = { top: 22, right: 12, bottom: 30 };
const ROW_PAD = 8;
const GAP = 3;
const HOUR = 3_600_000;
const FALLBACK_GROUP = "__none";

interface Placed {
  item: TimelineItem;
  start: number;
  end: number;
  row: number;
  lane: number;
  group: string;
}

interface Band {
  row: TimelineRow;
  rowIndex: number;
  own: TimelineItem[];
  lanes: number[];
  count: number;
  top: number;
  height: number;
}

function fitText(text: string, room: number, size = 11): string {
  if (estimateTextWidth(text, size) <= room) return text;
  const chars = Math.floor(room / (size * 0.58)) - 1;
  return chars >= 3 ? `${text.slice(0, chars).trimEnd()}…` : "";
}

/**
 * `<ui-timeline-chart>`: Gantt-style time ranges, one row per resource and one bar per item (the
 * React `TimelineChart`). Bars that overlap inside a row are stacked into lanes, so nothing is
 * hidden. Colors come from groups (statuses, which the legend toggles), and an optional marker
 * shows the current time. One tab stop: Left and Right walk the bars in time order, Up and Down
 * jump to the nearest bar of the next row.
 * Attributes: `now` (`auto`, a timestamp or an ISO date; absent hides the marker), `lane-height`
 * (px, 28), `grid="off"`, `height` (`fill` or px stretches the lanes to fit; by default the height
 * follows the lanes), plus the chart attributes. Properties: `rows`, `items`, `groups`, `domain`
 * (`[start, end]`, default the items rounded out to whole hours), `now`, `labels`.
 */
export class UiTimelineChart extends ChartElement {
  static override observedAttributes = [...CHART_ATTRIBUTES, "now", "lane-height", "grid"];
  static override retain = true;
  declare labels: Partial<ChartLabels & TimelineLabels>;
  #rows: readonly TimelineRow[] = [];
  #items: readonly TimelineItem[] = [];
  #groups: readonly TimelineGroup[] = [];
  #domain: readonly [Date | number, Date | number] | undefined;
  #now: Date | number | "auto" | false | undefined;
  #layers:
    | { stripes: SVGGElement; axes: SVGGElement; bars: SVGGElement; now: SVGGElement }
    | undefined;

  get rows(): readonly TimelineRow[] {
    return this.#rows;
  }
  set rows(value: readonly TimelineRow[]) {
    this.#rows = value;
    this.#size();
    this.requestDraw();
  }
  get items(): readonly TimelineItem[] {
    return this.#items;
  }
  set items(value: readonly TimelineItem[]) {
    this.#items = value;
    this.#size();
    this.requestDraw();
  }
  get groups(): readonly TimelineGroup[] {
    return this.#groups;
  }
  set groups(value: readonly TimelineGroup[]) {
    this.#groups = value;
    this.requestDraw();
  }
  get domain(): readonly [Date | number, Date | number] | undefined {
    return this.#domain;
  }
  set domain(value: readonly [Date | number, Date | number] | undefined) {
    this.#domain = value;
    this.requestDraw();
  }
  /** A "now" marker: a time, `"auto"` for the current time, `false` to hide it. */
  get now(): Date | number | "auto" | false {
    if (this.#now !== undefined) return this.#now;
    const attr = this.getAttribute("now");
    if (attr === null || attr === "off") return false;
    if (attr === "" || attr === "auto") return "auto";
    const stamp = Number(attr);
    return Number.isFinite(stamp) ? stamp : new Date(attr);
  }
  set now(value: Date | number | "auto" | false) {
    this.#now = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "timeline-chart";
    adoptStyles(rootOf(this), css);
    this.#size();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "lane-height") this.#size();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.#items.length === 0 || this.#rows.length === 0;
  }

  get #laneHeight(): number {
    return Number(this.getAttribute("lane-height")) || 28;
  }

  /** Rows with their lanes, tops and heights for a lane height. */
  #bands(laneHeight: number): { bands: Band[]; plotHeight: number } {
    const visible = this.#items.filter((item) => !this.isHidden(item.group ?? FALLBACK_GROUP));
    let top = 0;
    const bands = this.#rows.map((row, rowIndex) => {
      const own = visible.filter((item) => item.rowId === row.id);
      const { lanes, count } = assignLanes(
        own.map((item) => ({ start: +item.start, end: +item.end })),
      );
      const lanesUsed = Math.max(1, count);
      const height = lanesUsed * (laneHeight + GAP) - GAP + ROW_PAD * 2;
      const band: Band = { row, rowIndex, own, lanes, count: lanesUsed, top, height };
      top += height;
      return band;
    });
    return { bands, plotHeight: top };
  }

  #size(): void {
    autoHeight(
      this,
      Math.max(this.#bands(this.#laneHeight).plotHeight + MARGIN.top + MARGIN.bottom, 120),
    );
  }

  #layer(root: SVGSVGElement) {
    if (this.#layers?.stripes.parentNode !== root) {
      this.#layers = { stripes: svg("g"), axes: svg("g"), bars: svg("g"), now: svg("g") };
      root.replaceChildren(...Object.values(this.#layers));
    }
    return this.#layers;
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, color, animate, locale, timeZone } = context;
    const text: TimelineLabels = { ...DEFAULT_TEXT, ...this.labels };
    const rows = this.#rows;
    const items = this.#items;
    const zone = { locale, timeZone };
    const layers = this.#layer(root);
    const hostStretch =
      this.getAttribute("height") === "fill" ||
      this.hasAttribute("aspect-ratio") ||
      !hasAutoHeight(this);

    const colorOf = (id: string | undefined): string => {
      const at = this.#groups.findIndex((group) => group.id === id);
      return at < 0 ? "var(--accent-word)" : color(at, this.#groups[at]?.color);
    };
    const groupName = (id: string | undefined) =>
      this.#groups.find((group) => group.id === id)?.name ?? "";
    const rowName = (id: string) => rows.find((row) => row.id === id)?.label ?? id;

    const base = this.#bands(this.#laneHeight);
    const laneHeight = hostStretch
      ? fitLaneHeight({
          counts: base.bands.map((band) => band.count),
          available: height - MARGIN.top - MARGIN.bottom,
          gap: GAP,
          rowPad: ROW_PAD,
        })
      : this.#laneHeight;
    const { bands, plotHeight } = hostStretch ? this.#bands(laneHeight) : base;
    // The bands were laid out with the lane count of the visible items only.
    const placed: Placed[] = [];
    for (const band of bands)
      band.own.forEach((item, i) => {
        placed.push({
          item,
          start: +item.start,
          end: +item.end,
          row: band.rowIndex,
          lane: band.lanes[i] as number,
          group: item.group ?? FALLBACK_GROUP,
        });
      });
    placed.sort((a, b) => a.row - b.row || a.start - b.start || a.lane - b.lane);

    let t0 = Number.POSITIVE_INFINITY;
    let t1 = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      t0 = Math.min(t0, +item.start);
      t1 = Math.max(t1, +item.end);
    }
    const domain = this.#domain;
    const start = domain ? +domain[0] : Number.isFinite(t0) ? hourEdge(t0, "floor", timeZone) : 0;
    const end = domain ? +domain[1] : Number.isFinite(t1) ? hourEdge(t1, "ceil", timeZone) : HOUR;

    const narrow = width < 440;
    const left = Math.min(
      narrow ? 78 : 132,
      Math.max(64, Math.max(...rows.map((r) => estimateTextWidth(r.label, 12)), 0) + 18),
    );
    const innerWidth = Math.max(60, width - left - MARGIN.right);
    const x = (t: number) => ((t - start) / (end - start || 1)) * innerWidth;
    const ticks = clockTicks(start, end, Math.max(2, Math.floor(innerWidth / 62)), zone).map(
      (tick) => ({
        key: tick.value,
        position: x(tick.value),
        label: tick.label,
      }),
    );
    for (const layer of Object.values(layers))
      layer.setAttribute("transform", `translate(${left},${MARGIN.top})`);

    // Row stripes and titles, the grid and the time axis.
    layers.stripes.replaceChildren();
    for (const band of bands) {
      if (band.rowIndex % 2 === 0)
        layers.stripes.append(
          svg("rect", {
            x: -left + 4,
            y: band.top,
            width: left + innerWidth + MARGIN.right - 8,
            height: band.height,
            rx: 10,
            "aria-hidden": "true",
            style: "fill:var(--surface-2);fill-opacity:.45",
          }),
        );
      layers.stripes.append(
        svg(
          "text",
          {
            x: -10,
            y: band.top + band.height / 2,
            dy: "0.34em",
            "text-anchor": "end",
            "aria-hidden": "true",
            style: "fill:var(--ink-2);font-size:12px;font-weight:600",
          },
          fitText(band.row.label, left - 18, 12),
        ),
      );
    }
    layers.axes.replaceChildren();
    if (this.getAttribute("grid") !== "off")
      layers.axes.append(gridLines(ticks, "vertical", plotHeight));
    layers.axes.append(axisBottom(ticks, plotHeight));

    // Bars: one keyed group per item, so a data change touches only what moved.
    const geometry = placed.map((entry) => {
      const x0 = x(entry.start);
      const band = bands[entry.row] as Band;
      return {
        entry,
        x: x0,
        y: band.top + ROW_PAD + entry.lane * (laneHeight + GAP),
        w: Math.max(3, x(entry.end) - x0),
      };
    });
    const bars = join(
      layers.bars,
      geometry,
      (g) => g.entry.item.id,
      () =>
        svg(
          "g",
          { "data-bar": "", "aria-hidden": "true" },
          svg("rect", { rx: 7 }),
          svg("text", {
            dy: "0.34em",
            style: "fill:var(--surface);font-size:11px;font-weight:700;pointer-events:none",
          }),
        ),
      (el, g) => {
        const [rect, label] = [
          el.firstElementChild as SVGRectElement,
          el.lastElementChild as SVGTextElement,
        ];
        el.setAttribute("data-series", g.entry.group);
        rect.setAttribute("x", `${g.x}`);
        rect.setAttribute("y", `${g.y}`);
        rect.setAttribute("width", `${g.w}`);
        rect.setAttribute("height", `${laneHeight}`);
        rect.style.fill = colorOf(g.entry.item.group);
        label.setAttribute("x", `${g.x + 8}`);
        label.setAttribute("y", `${g.y + laneHeight / 2}`);
        label.textContent = g.w > 44 ? fitText(g.entry.item.label ?? "", g.w - 14) : "";
      },
    );

    // The current time.
    layers.now.replaceChildren();
    const nowSetting = this.now;
    const nowValue = nowSetting === false ? null : nowSetting === "auto" ? Date.now() : +nowSetting;
    if (nowValue != null && nowValue >= start && nowValue <= end) {
      const nx = x(nowValue);
      layers.now.setAttribute("aria-hidden", "true");
      layers.now.setAttribute("pointer-events", "none");
      layers.now.append(
        svg("line", {
          x1: nx,
          x2: nx,
          y1: -6,
          y2: plotHeight,
          "stroke-width": 1.5,
          style: "stroke:var(--danger)",
        }),
        svg("rect", {
          x: nx - 20,
          y: -MARGIN.top + 2,
          width: 40,
          height: 16,
          rx: 8,
          style: "fill:var(--danger)",
        }),
        svg(
          "text",
          {
            x: nx,
            y: -MARGIN.top + 10,
            dy: "0.34em",
            "text-anchor": "middle",
            style: "fill:var(--surface);font-size:10px;font-weight:700",
          },
          text.now,
        ),
      );
    }

    if (animate) {
      const per = Math.min(24, 500 / Math.max(1, bars.length));
      bars.forEach((bar, i) => {
        bar.animate(
          [
            { transform: "scaleX(0)", opacity: 0 },
            { transform: "scaleX(1)", opacity: 1 },
          ],
          { duration: 520, delay: i * per, easing: EASE, fill: "backwards" },
        );
      });
      layers.now.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 360,
        delay: 400,
        easing: "linear",
        fill: "backwards",
      });
    }

    const duration = (ms: number) => {
      const minutes = Math.round(ms / 60_000);
      if (minutes < 60) return `${minutes} ${text.minutes}`;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h} ${text.hours} ${m} ${text.minutes}` : `${h} ${text.hours}`;
    };
    const clock = (value: number) => formatClock(value, zone);
    const nameOf = (g: (typeof geometry)[number]) => g.entry.item.label ?? g.entry.item.id;
    const stepRow = (index: number, delta: number): number => {
      const from = geometry[index];
      if (!from) return index;
      let best = -1;
      let bestGap = Number.POSITIVE_INFINITY;
      let target = from.entry.row + delta;
      while (best < 0 && target >= 0 && target < bands.length) {
        geometry.forEach((g, i) => {
          if (g.entry.row !== target) return;
          const gap = Math.abs(g.entry.start - from.entry.start);
          if (gap < bestGap) {
            best = i;
            bestGap = gap;
          }
        });
        target += delta;
      }
      return best >= 0 ? best : index;
    };

    return {
      summary: `${geometry.length} items in ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`,
      maxHoverRows: 5,
      marks: {
        count: geometry.length,
        label: (i) => {
          const g = geometry[i] as (typeof geometry)[number];
          const group = groupName(g.entry.item.group);
          return `${nameOf(g)}. ${rowName(g.entry.item.rowId)}. ${clock(g.entry.start)} - ${clock(g.entry.end)}${group ? `. ${group}` : ""}`;
        },
        element: (i) => bars[i] ?? null,
      },
      hit: (px, py, _target, radius) => {
        const slop = Math.min(radius, 6);
        const lx = px - left;
        const ly = py - MARGIN.top;
        let best = -1;
        let bestGap = Number.POSITIVE_INFINITY;
        geometry.forEach((g, i) => {
          const dx = Math.max(g.x - lx, 0, lx - (g.x + g.w));
          const dy = Math.max(g.y - ly, 0, ly - (g.y + laneHeight));
          const gap = Math.hypot(dx, dy);
          if (gap <= slop && gap < bestGap) {
            best = i;
            bestGap = gap;
          }
        });
        return best;
      },
      hover: (i): HoverContent | null => {
        const g = geometry[i];
        if (!g) return null;
        const group = groupName(g.entry.item.group);
        const rowsOut: TooltipRow[] = [
          ...(group
            ? [
                {
                  id: "group",
                  name: text.group,
                  value: group,
                  color: colorOf(g.entry.item.group),
                  shape: "square" as const,
                },
              ]
            : []),
          {
            id: "row",
            name: text.row,
            value: rowName(g.entry.item.rowId),
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "time",
            name: text.time,
            value: `${clock(g.entry.start)} - ${clock(g.entry.end)}`,
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "duration",
            name: text.duration,
            value: duration(g.entry.end - g.entry.start),
            color: "var(--ink-3)",
            shape: "dot",
          },
          ...(g.entry.item.detail
            ? [{ id: "detail", name: g.entry.item.detail, value: "", color: "transparent" }]
            : []),
        ];
        return {
          title: nameOf(g),
          rows: rowsOut,
          x: left + g.x + g.w / 2,
          y: MARGIN.top + g.y + laneHeight / 2,
        };
      },
      nav: (index, intent) => {
        if (intent === "left") return Math.max(0, index - 1);
        if (intent === "right") return Math.min(geometry.length - 1, index + 1);
        if (intent === "home") return 0;
        if (intent === "end") return geometry.length - 1;
        if (intent === "up") return stepRow(index, -1);
        if (intent === "down") return stepRow(index, 1);
        return index;
      },
      snapshot: () => {
        const sorted = [...items].sort((a, b) => +a.start - +b.start);
        const column = (id: string, name: string, cell: (item: TimelineItem) => string) => ({
          id,
          name,
          color: "var(--ink-3)",
          values: sorted.map(cell),
          text: sorted.map(cell),
        });
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: text.category,
          categories: sorted.map((item) => item.label ?? item.id),
          series: [
            column("row", text.row, (item) => rowName(item.rowId)),
            column("group", text.group, (item) => groupName(item.group)),
            column("time", text.time, (item) => `${clock(+item.start)} - ${clock(+item.end)}`),
            column("duration", text.duration, (item) => duration(+item.end - +item.start)),
          ],
          legend: this.#groups.map((group, i) => ({
            id: group.id,
            name: group.name,
            color: color(i, group.color),
            shape: "square" as const,
          })),
        };
      },
    };
  }
}

/** Registers `<ui-timeline-chart>` (or `<prefix>-timeline-chart`) and returns the tag. */
export function defineTimelineChart(options?: DefineOptions): string {
  return defineElement("timeline-chart", UiTimelineChart, options);
}
