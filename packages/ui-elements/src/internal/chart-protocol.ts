/**
 * The contract between a chart (anything built on `ChartElement`) and its opt-in parts
 * (`ui-chart-legend`, `-tooltip`, `-data-table`, `-export-menu`, `-breadcrumb`). Parts import only
 * this file, never the chart base, so a chart pays for none of them and a part pays for no chart.
 */
import { byId } from "./base.js";

/** Marker attribute a chart puts on its host so parts can find it with `closest()`. */
export const CHART_MARKER = "data-ui-chart";

/** Events a chart emits on its host (they bubble and are composed). */
export const CHART_EVENT = {
  /** The chart connected or upgraded: parts that were defined first bind now. */
  ready: "chart-ready",
  /**
   * The chart's data changed (`detail`: `{ revision }`) or was cleared by the loading or empty
   * state (`detail`: `null`). Read `chart.chartSnapshot`; it is computed only when asked for.
   */
  data: "chart-data",
  /**
   * The details to show changed (`detail`: `HoverInfo | null`): the hovered or keyboard-focused
   * mark, else the pinned selection. Fires on a change of mark or content, never per pixel.
   */
  hover: "chart-hover",
  /** The selected (pinned) mark changed (`detail`: `{ index, category } | null`). */
  select: "chart-select",
  /** A mark was activated for drill-down (`detail`: `{ index, category }`). */
  drill: "chart-drill",
  /** A series was hidden, shown or highlighted. */
  series: "chart-series",
} as const;

export type MarkShape = "line" | "dashed" | "square" | "dot";

export interface SnapshotSeries {
  id: string;
  name: string;
  color: string;
  shape?: MarkShape;
  hidden?: boolean;
  /** Raw values, one per category (`null` is a gap): CSV and XLSX export. */
  values: ReadonlyArray<number | string | Date | null>;
  /** The same values formatted for the locale: the data table. */
  text: readonly string[];
}

/** What a chart publishes for legend, data table and export: its data, formatted and raw. */
export interface ChartSnapshot {
  title: string;
  categoryHeader: string;
  /** Row headers, formatted. */
  categories: readonly string[];
  /** Row headers as data (a `Date` becomes a real date in XLSX); defaults to `categories`. */
  categoryValues?: ReadonlyArray<string | number | Date>;
  series: readonly SnapshotSeries[];
}

export interface TooltipRow {
  id: string;
  name: string;
  value: string;
  color: string;
  shape?: MarkShape;
  /** Secondary text after the value, e.g. a share "(32%)". */
  note?: string;
  /** Bold and separated, e.g. a total. */
  emphasis?: boolean;
}

export type HoverSource = "pointer" | "keyboard" | "touch";

export interface HoverContent {
  title?: string;
  rows: readonly TooltipRow[];
  /** Wrapped sentence under the title, for notes that are not series values. */
  body?: string;
  /** Anchor in pixels, relative to the chart's drawing area. */
  x: number;
  y: number;
  /** Preferred side of the anchor; the tooltip flips when it does not fit. */
  side?: "left" | "right";
  /** Category the mark belongs to, when it is not the mark index (a stacked or grouped mark). */
  category?: number;
}

export interface HoverInfo extends HoverContent {
  /** Index of the mark (what `hit` returns and the keyboard moves over). */
  index: number;
  /** Index of the category of that mark; equal to `index` unless the chart says otherwise. */
  category: number;
  source: HoverSource;
  /** True when these are the details of the selected mark, not of a transient hover. */
  pinned: boolean;
}

/** What a part may use of a chart. Implemented by `ChartElement`. */
export interface ChartHost extends HTMLElement {
  readonly chartSnapshot: ChartSnapshot | null;
  /** The sized box that holds the drawing (tooltip coordinates are relative to it). */
  readonly drawing: HTMLElement;
  readonly hover: HoverInfo | null;
  /** The selected (pinned) mark index, or `null`. */
  readonly selected: number | null;
  /** Selects mark `index` (`null` clears): pins its details and fires `chart-select`. */
  select(index: number | null): void;
  /** Fires `chart-drill` for mark `index`. */
  drill(index: number): void;
  /** The canvas layer under the drawing, when the chart uses one (PNG export paints it first). */
  readonly canvasLayer?: HTMLCanvasElement;
  /** The drawings to export, in reading order. */
  exportSvgs(): SVGSVGElement[];
  isHidden(id: string): boolean;
  toggleSeries(id: string): void;
  highlight(id: string | null): void;
  /** A visible data table takes over the screen-reader fallback table; call with `false` to hand it back. */
  claimTable(on: boolean): void;
  readonly locale: string;
  readonly timeZone: string | undefined;
}

export const isChart = (element: Element | null): element is ChartHost =>
  !!element && "chartSnapshot" in element && "exportSvgs" in element;

/** The chart a part belongs to: the one `for` names, else the closest ancestor chart. */
export function chartOf(part: HTMLElement): ChartHost | null {
  const id = part.getAttribute("for");
  const target = id ? byId(part, id) : part.closest(`[${CHART_MARKER}]`);
  return isChart(target) ? target : null;
}

/**
 * Binds `part` to its chart as soon as one is available (parts and charts can be defined in any
 * order) and calls `attach(chart)`, whose return value is the cleanup. When the chart is replaced
 * (a new element with the same id, or the part moved under another chart) it detaches from the old
 * one and attaches to the new one. Returns the unbind.
 *
 * Limit: the lookup stays inside the part's own root node. `for` resolves ids in that root only,
 * `closest()` does not cross a shadow boundary, and `chart-ready` is only heard in that root, so a
 * part inside a shadow root cannot reach a chart outside it (and the reverse).
 */
export function bindChart(part: HTMLElement, attach: (chart: ChartHost) => () => void): () => void {
  let bound: ChartHost | null = null;
  let detach: (() => void) | undefined;
  const root = part.getRootNode();
  const sync = () => {
    const chart = chartOf(part);
    if (chart === bound) return;
    detach?.();
    detach = undefined;
    bound = chart;
    if (chart) detach = attach(chart);
  };
  root.addEventListener(CHART_EVENT.ready, sync);
  sync();
  return () => {
    root.removeEventListener(CHART_EVENT.ready, sync);
    detach?.();
    detach = undefined;
    bound = null;
  };
}
