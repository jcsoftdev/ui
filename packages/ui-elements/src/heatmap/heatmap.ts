import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import {
  type ColorRange,
  DEFAULT_SCALE_COLORS,
  inkOn,
  rangeColor,
  rangeIndex,
  type ScaleColors,
  tint,
} from "@jcsoftdev/ui-core/chart/color-scale";
import { type HeatmapScale, heatmapScale } from "@jcsoftdev/ui-core/chart/heatmap-scale";
import { type HexLayout, hexLayout, hexPath } from "@jcsoftdev/ui-core/chart/hex-layout";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  svg,
} from "../internal/chart-base.js";
import { autoHeight, cssColor } from "../internal/e19-axes.js";
import css from "./heatmap.css.js";

/** A cell: a number, `null` for no data (drawn empty), `undefined` for no cell at all. */
export type HeatmapValue = number | null | undefined;

/** Strings the heatmap adds to the base labels. */
export interface HeatmapLabels {
  /** Tooltip value of a cell without data. */
  noData: string;
  /** Header of the row names in the data table. */
  category: string;
}
const DEFAULT_TEXT: HeatmapLabels = { noData: "No data", category: "Row" };

/** Height of the column-label header above the cells. */
const TOP = 22;
/** Continuous colors are quantised to this many steps so the canvas resolves each CSS color once. */
const STEPS = 96;
/** Up to this many cells the data table lists them all; a denser matrix lists a corner of it. */
const TABLE_CELLS = 5000;
const TABLE_ROWS = 60;
const TABLE_COLUMNS = 40;
const EMPTY = "var(--surface-2)";

interface Cell {
  row: number;
  column: number;
  value: number | null;
  /** Index of the range the cell falls in (stepped scales), -1 otherwise. */
  range: number;
}

/** Date columns are rare: their calendar labels are a chunk of their own, loaded on first use. */
type DateLabels = typeof import("./heatmap-dates.js");
let dateLabels: Promise<DateLabels> | undefined;
let dateLabelsReady: DateLabels | undefined;
const loadDateLabels = (): Promise<DateLabels> =>
  (dateLabels ??= import("./heatmap-dates.js").then((loaded) => (dateLabelsReady = loaded)));

/** A numeric attribute, or the default when it is missing or not a number. */
const number = (text: string | null, fallback: number): number => {
  const value = text === null || text.trim() === "" ? Number.NaN : Number(text);
  return Number.isFinite(value) ? value : fallback;
};

const pair = (text: string | null): [number, number] | undefined => {
  const parts = text
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return parts?.length === 2 && parts.every(Number.isFinite)
    ? [parts[0] as number, parts[1] as number]
    : undefined;
};

/**
 * `<ui-heatmap>`: one colored cell per row and column (the React `HeatmapChart`), painted on the
 * canvas layer so matrices of tens of thousands of cells stay cheap; the cells are named by
 * virtual marks. One tab stop: the arrows move between rows and columns (2D, skipping holes), Home
 * and End jump to the ends of the row, Enter selects. The legend is a continuous gradient from the
 * snapshot's `scale`, or one swatch per range when `ranges` is set.
 * Attributes: `scale` (`sequential` | `diverging`), `domain` (`0,100`), `center`, `shape` (`rect` |
 * `hex`), `gap`, `radius`, `cell-labels`, plus the chart attributes. Properties: `rows`, `columns`
 * (strings or dates), `values` (`values[row][column]`), `colors`, `ranges`, `labels`.
 */
export class UiHeatmap extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "scale",
    "domain",
    "center",
    "shape",
    "gap",
    "radius",
    "cell-labels",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels & HeatmapLabels>;
  colors: ScaleColors | undefined;
  #rows: readonly string[] = [];
  #columns: ReadonlyArray<string | Date> = [];
  #values: ReadonlyArray<ReadonlyArray<HeatmapValue>> = [];
  #ranges: readonly ColorRange[] | undefined;
  #rings = new Map<number, SVGElement>();
  #parts: { labels: SVGGElement; rings: SVGGElement } | undefined;

  get rows(): readonly string[] {
    return this.#rows;
  }
  set rows(value: readonly string[]) {
    this.#rows = value;
    this.#size();
    this.requestDraw();
  }
  get columns(): ReadonlyArray<string | Date> {
    return this.#columns;
  }
  set columns(value: ReadonlyArray<string | Date>) {
    this.#columns = value;
    this.requestDraw();
  }
  get values(): ReadonlyArray<ReadonlyArray<HeatmapValue>> {
    return this.#values;
  }
  set values(value: ReadonlyArray<ReadonlyArray<HeatmapValue>>) {
    this.#values = value;
    this.requestDraw();
  }
  get ranges(): readonly ColorRange[] | undefined {
    return this.#ranges;
  }
  set ranges(value: readonly ColorRange[] | undefined) {
    this.#ranges = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "heatmap";
    adoptStyles(rootOf(this), css);
    this.#size();
    super.connectedCallback();
  }

  /** 34 px per row plus the header unless the author set a height. */
  #size(): void {
    autoHeight(this, Math.max(120, this.#rows.length * 34 + TOP));
  }

  protected override isEmpty(): boolean {
    return (
      this.#rows.length === 0 ||
      this.#columns.length === 0 ||
      !this.#values.some((row) => row.some((v) => typeof v === "number" && Number.isFinite(v)))
    );
  }

  #layers(root: SVGSVGElement) {
    if (this.#parts?.labels.parentNode !== root) {
      this.#parts = { labels: svg("g"), rings: svg("g") };
      root.replaceChildren(this.#parts.labels, this.#parts.rings);
    }
    return this.#parts;
  }

  protected draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, format, locale, timeZone } = context;
    const text: HeatmapLabels = { ...DEFAULT_TEXT, ...this.labels };
    const rowNames = this.#rows;
    const rows = rowNames.length;
    const columns = this.#columns.length;
    const zone = { locale, timeZone };
    const dated = columns > 0 && this.#columns.every((c) => c instanceof Date);
    if (dated && !dateLabelsReady) void loadDateLabels().then(() => this.requestDraw());
    const plain = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone });
    const columnNames = this.#columns.map((c) =>
      c instanceof Date ? (dateLabelsReady?.formatDate(c, zone) ?? plain.format(c)) : c,
    );
    const headers: Array<string | null> =
      dated && dateLabelsReady
        ? dateLabelsReady.datetimeColumnLabels(
            this.#columns as Date[],
            Math.max(2, Math.floor(width / 72)),
            zone,
          )
        : columnNames;
    const kind = this.getAttribute("scale") === "diverging" ? "diverging" : "sequential";
    const center = number(this.getAttribute("center"), 0);
    const gap = Math.max(0, number(this.getAttribute("gap"), 3));
    const radius = Math.max(0, number(this.getAttribute("radius"), 4));
    const hex = this.getAttribute("shape") === "hex";
    const ranges = this.#ranges?.length ? this.#ranges : undefined;
    const parts = this.#layers(root);

    const finite: number[] = [];
    for (const row of this.#values)
      for (const v of row) if (typeof v === "number" && Number.isFinite(v)) finite.push(v);
    const scale: HeatmapScale = heatmapScale(finite, {
      scale: kind,
      domain: pair(this.getAttribute("domain")),
      center,
      colors: this.colors,
      ranges,
    });
    const [lo, hi] = scale.domain;

    // Cells that exist (a hole is `undefined`, an empty cell `null`), row by row.
    const cells: Cell[] = [];
    const at = new Int32Array(rows * columns).fill(-1);
    for (let row = 0; row < rows; row += 1)
      for (let column = 0; column < columns; column += 1) {
        const v = this.#values[row]?.[column];
        if (v === undefined) continue;
        const value = typeof v === "number" && Number.isFinite(v) ? v : null;
        const range = ranges && value !== null ? rangeIndex(value, ranges) : -1;
        at[row * columns + column] = cells.length;
        cells.push({ row, column, value, range });
      }

    // Geometry.
    let widest = 0;
    for (const label of rowNames) widest = Math.max(widest, estimateTextWidth(label, 11));
    const gutter = Math.min(width < 420 ? 52 : 120, widest + 10);
    const areaW = Math.max(0, width - gutter);
    const areaH = Math.max(0, height - TOP);
    const w = columns ? areaW / columns : 0;
    const h = rows ? areaH / rows : 0;
    const pad = Math.min(gap, w * 0.2, h * 0.2);
    const honey: HexLayout | null = hex
      ? hexLayout({ rows, columns, width: areaW, height: areaH })
      : null;
    const hexRadius = honey ? Math.max(0, honey.radius - gap * 0.55) : 0;
    const centerOf = (row: number, column: number) => {
      if (honey) {
        const c = honey.center(row, column);
        return { x: gutter + c.x, y: TOP + c.y };
      }
      return { x: gutter + column * w + w / 2, y: TOP + row * h + h / 2 };
    };

    // Labels: row names in the gutter, column names where they do not collide.
    const labels = parts.labels;
    labels.replaceChildren();
    rowNames.forEach((name, row) => {
      const clipped =
        estimateTextWidth(name, 11) > gutter - 10
          ? `${name.slice(0, Math.max(1, Math.floor((gutter - 14) / 6.4)))}…`
          : name;
      const el = svg("text", {
        "data-label": "",
        x: gutter - 8,
        y: centerOf(row, 0).y,
        "text-anchor": "end",
        "dominant-baseline": "central",
        "aria-hidden": "true",
      });
      el.textContent = clipped;
      labels.append(el);
    });
    let lastEnd = Number.NEGATIVE_INFINITY;
    headers.forEach((name, column) => {
      if (!name) return;
      const x = centerOf(0, column).x;
      const textWidth = estimateTextWidth(name, 11);
      if (x - textWidth / 2 < lastEnd + 6 || x + textWidth / 2 > width + 2) return;
      lastEnd = x + textWidth / 2;
      const el = svg("text", {
        "data-label": "",
        x,
        y: TOP - 8,
        "text-anchor": "middle",
        "aria-hidden": "true",
      });
      el.textContent = name;
      labels.append(el);
    });

    // Cells on the canvas layer. Continuous colors take one of STEPS stops, resolved once each.
    // TODO(theme): the canvas keeps the colours resolved here; repaint on a theme change once the
    // base chart exposes its theme hook.
    const resolved = new Map<string, string>();
    const resolve = (value: string) => {
      let out = resolved.get(value);
      if (out === undefined) {
        out = cssColor(this, value);
        resolved.set(value, out);
      }
      return out;
    };
    const snap = (value: number) =>
      hi > lo ? lo + (Math.round(((value - lo) / (hi - lo)) * STEPS) / STEPS) * (hi - lo) : value;
    const stopOf = (cell: Cell) => {
      if (cell.value === null) return null;
      if (cell.range >= 0 || ranges) {
        if (cell.range < 0) return null;
        return scale.color(cell.value);
      }
      return scale.color(snap(Math.min(hi, Math.max(lo, cell.value))));
    };
    const g = context.canvas();
    const family = getComputedStyle(this).fontFamily;
    const ink = resolve("var(--ink)");
    const surface = resolve("var(--surface)");
    const round = (g as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect;
    g.font = `700 11px ${family}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const showText = this.hasAttribute("cell-labels");
    for (const cell of cells) {
      const hidden = cell.range >= 0 && this.isHidden(`range-${cell.range}`);
      const stop = hidden ? null : stopOf(cell);
      g.fillStyle = resolve(stop?.color ?? EMPTY);
      g.beginPath();
      let cx: number;
      let cy: number;
      let cw = 0;
      let ch = 0;
      if (honey) {
        const c = centerOf(cell.row, cell.column);
        cx = c.x;
        cy = c.y;
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 180) * (60 * i - 90);
          const px = cx + hexRadius * Math.cos(angle);
          const py = cy + hexRadius * Math.sin(angle);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        cw = hexRadius * 1.6;
      } else {
        const x = gutter + cell.column * w + pad / 2;
        const y = TOP + cell.row * h + pad / 2;
        cw = Math.max(0, w - pad);
        ch = Math.max(0, h - pad);
        cx = x + cw / 2;
        cy = y + ch / 2;
        if (typeof round === "function" && radius > 0)
          g.roundRect(x, y, cw, ch, Math.min(radius, cw / 2, ch / 2));
        else g.rect(x, y, cw, ch);
      }
      g.fill();
      if (showText && stop && cell.value !== null) {
        const label = format(cell.value);
        const room = honey
          ? cw >= estimateTextWidth(label, 11)
          : cw >= estimateTextWidth(label, 11) + 6 && ch >= 16;
        if (room) {
          g.fillStyle = inkOn(stop.strength).includes("surface") ? surface : ink;
          g.fillText(label, cx, cy);
        }
      }
    }

    // Focus ring: one shape per cell asked for, a handful kept.
    parts.rings.replaceChildren();
    this.#rings.clear();
    const ringOf = (index: number): SVGElement | null => {
      const cell = cells[index];
      if (!cell) return null;
      let ring = this.#rings.get(index);
      if (!ring) {
        if (this.#rings.size > 6) {
          const [oldest] = this.#rings.keys();
          if (oldest !== undefined) {
            this.#rings.get(oldest)?.remove();
            this.#rings.delete(oldest);
          }
        }
        if (honey) {
          const c = centerOf(cell.row, cell.column);
          ring = svg("path", { "data-ring": "", d: hexPath(c.x, c.y, hexRadius + 1.5) });
        } else {
          ring = svg("rect", {
            "data-ring": "",
            x: gutter + cell.column * w + pad / 2 - 1,
            y: TOP + cell.row * h + pad / 2 - 1,
            width: Math.max(0, w - pad) + 2,
            height: Math.max(0, h - pad) + 2,
            rx: radius + 1,
          });
        }
        ring.setAttribute("aria-hidden", "true");
        parts.rings.append(ring);
        this.#rings.set(index, ring);
      }
      return ring;
    };

    const title = (cell: Cell) => `${rowNames[cell.row] ?? ""} · ${columnNames[cell.column] ?? ""}`;
    const valueText = (cell: Cell) => (cell.value === null ? text.noData : format(cell.value));
    const colorOf = (cell: Cell) => stopOf(cell)?.color ?? EMPTY;

    /** Next defined cell from (row, column) stepping by (dr, dc); the same cell at the edge. */
    const step = (index: number, dr: number, dc: number): number => {
      const from = cells[index] as Cell;
      let row = from.row + dr;
      let column = from.column + dc;
      while (row >= 0 && row < rows && column >= 0 && column < columns) {
        const found = at[row * columns + column] as number;
        if (found >= 0) return found;
        row += dr;
        column += dc;
      }
      return index;
    };

    return {
      summary: `${rows} rows by ${columns} columns, ${cells.length} cells.`,
      marks: {
        count: cells.length,
        label: (i) => `${title(cells[i] as Cell)}: ${valueText(cells[i] as Cell)}`,
        element: ringOf,
      },
      hit: (x, y) => {
        let row: number;
        let column: number;
        if (honey) {
          const found = honey.cellAt(x - gutter, y - TOP);
          if (!found) return -1;
          ({ row, column } = found);
        } else {
          const px = x - gutter;
          const py = y - TOP;
          if (px < 0 || py < 0 || !w || !h) return -1;
          column = Math.floor(px / w);
          row = Math.floor(py / h);
          if (column >= columns || row >= rows) return -1;
        }
        return at[row * columns + column] ?? -1;
      },
      hover: (i): HoverContent | null => {
        const cell = cells[i];
        if (!cell) return null;
        const c = centerOf(cell.row, cell.column);
        return {
          title: title(cell),
          rows: [
            {
              id: "value",
              name: rowNames[cell.row] ?? "",
              value: valueText(cell),
              color: colorOf(cell),
              shape: "dot",
            },
          ],
          x: c.x,
          y: c.y,
          category: cell.row,
        };
      },
      nav: (index, intent) => {
        const cell = cells[index];
        if (!cell) return undefined;
        if (intent === "left") return step(index, 0, -1);
        if (intent === "right") return step(index, 0, 1);
        if (intent === "up") return step(index, -1, 0);
        if (intent === "down") return step(index, 1, 0);
        // Home and End: the first and last cell of the row.
        let found = index;
        const range = intent === "home" ? [0, columns, 1] : [columns - 1, -1, -1];
        for (let c = range[0] as number; c !== range[1]; c += range[2] as number) {
          const candidate = at[cell.row * columns + c] as number;
          if (candidate >= 0) {
            found = candidate;
            break;
          }
        }
        return found;
      },
      maxHoverRows: 1,
      snapshot: () => {
        const dense = rows * columns > TABLE_CELLS;
        const tableRows = dense ? Math.min(rows, TABLE_ROWS) : rows;
        const tableColumns = dense ? Math.min(columns, TABLE_COLUMNS) : columns;
        const series = Array.from({ length: tableColumns }, (_, column) => {
          const values = Array.from({ length: tableRows }, (_, row) => {
            const v = this.#values[row]?.[column];
            return typeof v === "number" && Number.isFinite(v) ? v : null;
          });
          return {
            id: `${column}`,
            name: `${columnNames[column] ?? ""}`,
            color: "var(--ink-3)",
            values,
            text: values.map((v) => (v === null ? text.noData : format(v))),
          };
        });
        const base = {
          title: this.getAttribute("label") ?? "",
          categoryHeader: text.category,
          categories: rowNames.slice(0, tableRows),
          series,
        };
        if (ranges)
          return {
            ...base,
            legend: ranges.map((range, index) => ({
              id: `range-${index}`,
              name: range.label,
              color: rangeColor(range, index, ranges.length).color,
              shape: "square" as const,
            })),
          };
        const { low, mid, high } = { ...DEFAULT_SCALE_COLORS, ...this.colors };
        return {
          ...base,
          scale: {
            min: lo,
            max: hi,
            colors: kind === "diverging" ? [low, mid, high] : [tint(high, 12, mid), high],
            // The neutral colour sits at the centre value, not at the middle of the bar.
            stops:
              kind === "diverging"
                ? [0, hi > lo ? Math.min(1, Math.max(0, (center - lo) / (hi - lo))) : 0.5, 1]
                : undefined,
            format,
            label: this.getAttribute("label") ?? undefined,
          },
        };
      },
    };
  }
}

/** Registers `<ui-heatmap>` (or `<prefix>-heatmap`) and returns the tag. */
export function defineHeatmap(options?: DefineOptions): string {
  return defineElement("heatmap", UiHeatmap, options);
}
