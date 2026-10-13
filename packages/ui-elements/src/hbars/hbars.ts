import { truncateLabel } from "@jcsoftdev/ui-core/chart/distribution-layout";
import { adoptStyles, type DefineOptions, defineElement, rootOf, uid } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { autoHeight, EASE } from "../internal/e19-axes.js";
import css from "./hbars.css.js";

export interface HBarSeries {
  id: string;
  label: string;
}

export interface HBarRow {
  id: string;
  name: string;
  /** Values aligned 1:1 with `series` (one or two). */
  values: readonly [number] | readonly [number, number];
  /** Tints the visible value. */
  tone?: "default" | "danger";
  /** Overrides the value text (default: the sum when stacked, both numbers when paired). */
  valueText?: string;
}

export interface HBarTick {
  /** Percentage position (0-100) over `scale-max`. */
  position: number;
  label: string;
}

/** Strings the bars add to the base labels. */
export interface HBarsLabels {
  total: string;
}

const PAD = 16;
const GAP = 12;
const TOP = 14;
const ROW_GAP = 10;
const TICKS = 16;

/**
 * `<ui-hbars>`: horizontal comparison bars (the React `HBars`): a name, a track with one or two
 * series and the value, one row per item. `stacked` splits one bar between the series; `paired`
 * draws each series as its own bar on the same scale. Hovering or focusing a row lists its values.
 * Attributes: `scale-max` (the value that fills the track), `variant` (`stacked`, `paired`),
 * `threshold` (a dashed line, same scale), `name-header` (the first column of the data table), plus
 * the chart attributes (`description` is the table caption). Properties: `rows`, `series`
 * (at most two; color follows position, `--accent` then `--accent-2`), `ticks`, `labels`.
 */
export class UiHbars extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "scale-max",
    "variant",
    "threshold",
    "name-header",
  ];
  declare labels: Partial<ChartLabels & HBarsLabels>;
  #rows: readonly HBarRow[] = [];
  #series: readonly HBarSeries[] = [];
  #ticks: readonly HBarTick[] | undefined;

  get rows(): readonly HBarRow[] {
    return this.#rows;
  }
  set rows(value: readonly HBarRow[]) {
    this.#rows = value;
    this.#size();
    this.requestDraw();
  }
  get series(): readonly HBarSeries[] {
    return this.#series;
  }
  set series(value: readonly HBarSeries[]) {
    this.#series = value;
    this.#size();
    this.requestDraw();
  }
  get ticks(): readonly HBarTick[] | undefined {
    return this.#ticks;
  }
  set ticks(value: readonly HBarTick[] | undefined) {
    this.#ticks = value;
    this.#size();
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "hbars";
    adoptStyles(rootOf(this), css);
    this.#size();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "variant") this.#size();
    super.attributeChangedCallback(name);
  }

  get #paired(): boolean {
    return this.getAttribute("variant") === "paired";
  }

  /** The drawing is as tall as its rows, unless the author set a height. */
  #size(): void {
    const n = this.#rows.length;
    const track = this.#paired ? 26 : 22;
    autoHeight(
      this,
      TOP + n * track + Math.max(0, n - 1) * ROW_GAP + (this.#ticks ? ROW_GAP + TICKS : 0) + 8,
    );
  }

  protected override isEmpty(): boolean {
    return this.#rows.length === 0;
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, format, color, animate } = context;
    const series = this.#series;
    const off = series.map((item) => this.isHidden(item.id));
    // A series hidden from the legend counts as zero everywhere.
    const rows = this.#rows.map((row) => ({
      ...row,
      values: row.values.map((value, i) => (off[i] ? 0 : value)) as unknown as HBarRow["values"],
    }));
    const paired = this.#paired;
    const text: HBarsLabels = { total: "Total", ...this.labels };
    const scaleMax = Number(this.getAttribute("scale-max")) || 1;
    const threshold = this.getAttribute("threshold");
    const narrow = width <= 560;
    const nameWidth = narrow ? 86 : 118;
    const valueWidth = narrow ? 26 : 30;
    const trackX = PAD + nameWidth + GAP;
    const trackWidth = Math.max(20, width - PAD - valueWidth - GAP - trackX);
    const trackHeight = paired ? 26 : 22;
    const step = trackHeight + ROW_GAP;
    const own = !!(this.palette?.length || this.hasAttribute("palette"));
    const fill = (i: number) => (own ? color(i) : i === 0 ? "var(--accent)" : "var(--accent-2)");
    const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);
    const widthOf = (value: number) => Math.max(0, Math.min(1, value / scaleMax)) * trackWidth;
    const valueTextOf = (row: HBarRow): string[] =>
      row.valueText !== undefined
        ? [row.valueText]
        : paired
          ? row.values.filter((_, i) => !off[i]).map((v) => format(v))
          : [format(sum(row.values))];

    const marks: ChartMark[] = [];
    const bars: SVGElement[] = [];
    rows.forEach((row, index) => {
      const y = TOP + index * step;
      const band = svg("rect", {
        x: 0,
        y: y - ROW_GAP / 2,
        width,
        height: trackHeight + ROW_GAP,
        "data-row": index,
      });
      root.append(band);
      marks.push({
        el: band,
        label: `${row.name}: ${row.values
          .map((v, i) => (off[i] ? "" : `${series[i]?.label ?? i + 1} ${format(v)}`))
          .filter(Boolean)
          .join(", ")}`,
      });
      root.append(
        svg(
          "text",
          {
            x: PAD,
            y: y + trackHeight / 2,
            dy: "0.34em",
            "aria-hidden": "true",
            style: "fill:var(--ink);font-size:12.5px;font-weight:600",
          },
          truncateLabel(row.name, nameWidth, 12.5),
        ),
      );
      // The track: a hairline every 20% and the closing edge.
      for (let k = 0; k <= 5; k += 1)
        root.append(
          svg("line", {
            x1: trackX + (trackWidth * k) / 5,
            x2: trackX + (trackWidth * k) / 5,
            y1: y,
            y2: y + trackHeight,
            "shape-rendering": "crispEdges",
            "aria-hidden": "true",
            style: `stroke:${k === 5 ? "var(--line-strong)" : "var(--line)"}`,
          }),
        );
      if (paired) {
        row.values.forEach((value, i) => {
          const bar = svg("rect", {
            x: trackX,
            y:
              y +
              (trackHeight - (row.values.length * 8 + (row.values.length - 1) * 3)) / 2 +
              i * 11,
            width: widthOf(value),
            height: 8,
            rx: 2,
            "data-fill": "",
            "aria-hidden": "true",
            style: `fill:${fill(i)};transform-box:fill-box;transform-origin:left center`,
          });
          root.append(bar);
          bars.push(bar);
        });
      } else {
        const total = sum(row.values);
        const full = widthOf(total);
        const clip = uid("hbars");
        const group = svg("g", {
          "clip-path": `url(#${clip})`,
          "aria-hidden": "true",
          "data-fill": "",
        });
        let x = trackX;
        row.values.forEach((value, i) => {
          const w = total ? (full * value) / total : 0;
          group.append(
            svg("rect", {
              x,
              y: y + (trackHeight - 12) / 2,
              width: w,
              height: 12,
              style: `fill:${fill(i)}`,
            }),
          );
          x += w;
        });
        root.append(
          svg(
            "clipPath",
            { id: clip },
            svg("rect", {
              x: trackX,
              y: y + (trackHeight - 12) / 2,
              width: Math.max(0, full),
              height: 12,
              rx: 2,
            }),
          ),
          group,
        );
        group.style.cssText = "transform-box:fill-box;transform-origin:left center";
        bars.push(group);
      }
      if (threshold !== null) {
        const tx = trackX + widthOf(Number(threshold));
        root.append(
          svg("line", {
            x1: tx,
            x2: tx,
            y1: y - 4,
            y2: y + trackHeight + 4,
            "stroke-width": 1.5,
            "stroke-dasharray": "3 3",
            "aria-hidden": "true",
            style: "stroke:var(--danger)",
          }),
        );
      }
      const lines = valueTextOf(row);
      const label = svg("text", {
        x: width - PAD,
        "text-anchor": "end",
        "aria-hidden": "true",
        style: `fill:${row.tone === "danger" ? "var(--danger)" : "var(--ink)"};font-size:12px;font-weight:600;font-variant-numeric:tabular-nums`,
      });
      const lead = y + trackHeight / 2 - ((lines.length - 1) * 7.5) / 2;
      lines.forEach((line, i) => {
        label.append(svg("tspan", { x: width - PAD, y: lead + i * 15, dy: "0.34em" }, line));
      });
      root.append(label);
    });
    if (this.#ticks) {
      const y = TOP + rows.length * step - ROW_GAP + ROW_GAP + 11;
      for (const tick of this.#ticks)
        root.append(
          svg(
            "text",
            {
              x: trackX + (trackWidth * tick.position) / 100,
              y,
              "text-anchor": "middle",
              "aria-hidden": "true",
              style:
                "fill:var(--ink-3);font-size:10.5px;font-weight:500;font-variant-numeric:tabular-nums",
            },
            tick.label,
          ),
        );
    }
    if (animate)
      bars.forEach((bar, index) => {
        bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 480,
          delay: Math.min(400, index * 30),
          easing: EASE,
          fill: "backwards",
        });
      });

    const countedRows = Math.max(1, series.length) + (!paired && series.length === 2 ? 1 : 0);
    return {
      summary: `${rows.length} ${rows.length === 1 ? "row" : "rows"}${series.length ? `: ${series.map((s) => s.label).join(", ")}` : ""}.`,
      marks,
      maxHoverRows: countedRows,
      hit: (_x, y) => {
        const index = Math.floor((y - TOP + ROW_GAP / 2) / step);
        return index >= 0 && index < rows.length ? index : -1;
      },
      hover: (index) => {
        const row = rows[index];
        if (!row) return null;
        const items = row.values
          .map((value, i) => ({
            id: series[i]?.id ?? `${i}`,
            name: series[i]?.label ?? `${i + 1}`,
            value: format(value),
            color: fill(i),
            shape: "square" as const,
            hidden: off[i],
          }))
          .filter((item) => !item.hidden)
          .map(({ hidden: _hidden, ...item }) => item as TooltipRow);
        if (!paired && items.length > 1)
          items.push({
            id: "__total",
            name: text.total,
            value: format(sum(row.values)),
            color: "transparent",
            shape: "square",
            emphasis: true,
          });
        return {
          title: row.name,
          rows: items,
          x:
            trackX +
            Math.min(trackWidth, widthOf(paired ? Math.max(...row.values) : sum(row.values))),
          y: TOP + index * step + trackHeight / 2,
        };
      },
      nav: (index, intent) => {
        if (intent === "up" || intent === "left") return Math.max(0, index - 1);
        if (intent === "down" || intent === "right") return Math.min(rows.length - 1, index + 1);
        if (intent === "home") return 0;
        if (intent === "end") return rows.length - 1;
        return index;
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? "",
        categoryHeader: this.getAttribute("name-header") ?? "",
        categories: rows.map((row) => row.name),
        series: series.map((item, i) => ({
          id: item.id,
          name: item.label,
          color: fill(i),
          shape: "square" as const,
          hidden: this.isHidden(item.id),
          values: this.#rows.map((row) => row.values[i] ?? null),
          text: this.#rows.map((row) =>
            row.values[i] === undefined ? "" : format(row.values[i] as number),
          ),
        })),
      }),
    };
  }
}

/** Registers `<ui-hbars>` (or `<prefix>-hbars`) and returns the tag. */
export function defineHbars(options?: DefineOptions): string {
  return defineElement("hbars", UiHbars, options);
}
