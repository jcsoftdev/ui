import type { ReactNode } from "react";
import type { ValueFormat } from "../format.js";
import type { Curve } from "../path.js";
import type { StackMode } from "../stack.js";
import type { TooltipRow } from "../tooltip.js";
import type {
  ChartAnnotation,
  ChartLabels,
  ChartSeries,
  ValueAxisOptions,
  XValue,
} from "../types.js";
import type { CartesianAxisSpec } from "./axis-stack.js";

export type MarkKind = "line" | "area" | "column";

export interface CartesianSeries extends ChartSeries {
  /** How the series is drawn. */
  kind: MarkKind;
  /** Id of the value axis the series is measured against: "left" (default), "right" or one declared in `axes`. */
  axis?: string;
  /**
   * Floating columns: where each bar starts (`data` is where it ends). Floating
   * series never stack; both ends are rounded.
   */
  from?: ReadonlyArray<number | null>;
  /**
   * Columns of one group pile up with `stack`; each group is a column of its
   * own next to the others in the same category.
   */
  stackGroup?: string;
  /** Color of each bar (columns), `undefined` entries keep the series color. */
  pointColors?: ReadonlyArray<string | undefined>;
}

/** A label spanning consecutive categories, drawn under their own tick labels. */
export interface CategoryGroup {
  label: string;
  /** How many consecutive categories belong to the group. */
  count: number;
}

/** What a click on the plot reports: the nearest category and the series line closest to the pointer. */
export interface CartesianPointEvent {
  /** Index in the `categories` you passed (not in the zoomed or downsampled window). */
  index: number;
  category: XValue;
  seriesId: string;
  value: number | null;
}

/** What an overlay needs to draw in data units on top of a cartesian plot. */
export interface CartesianPlotInfo {
  /** Plot box inside the chart container, in pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** True on a horizontal bar chart: categories run top to bottom, values left to right. */
  horizontal?: boolean;
  /** "index": x is a (fractional) index into `categories`; "time": x is epoch milliseconds. */
  xKind: "index" | "time";
  /**
   * Data x (the category axis) to plot-relative pixels and back. These are pixels along x on a vertical
   * chart and along y when `horizontal`; use `plotToPixel` / `pixelToPlot` from `core/ink` to convert
   * a whole point.
   */
  toX: (value: number) => number;
  fromX: (pixel: number) => number;
  /** Primary value axis, data y to plot-relative pixels and back (along x when `horizontal`). */
  toY: (value: number) => number;
  fromY: (pixel: number) => number;
  /** Text of a data x (the nearest category, or a date) and of a data y. */
  formatX: (value: number) => string;
  formatY: (value: number) => string;
}

/**
 * Layers added to a cartesian chart. `svg` renders inside the chart drawing (plot
 * coordinates, so it is part of the SVG export); `html` renders over the plot, above the chart's
 * own pointer layer, for tools that need pointer events.
 */
export interface CartesianOverlay {
  svg?: (plot: CartesianPlotInfo) => ReactNode;
  html?: (plot: CartesianPlotInfo) => ReactNode;
}

/** What `tooltipRows` receives for the hovered category. */
export interface CartesianTooltipContext {
  /** Index in the `categories` you passed (not in the zoomed or downsampled window). */
  index: number;
  category: XValue;
  /** The rows the tooltip would show. */
  rows: TooltipRow[];
}

/** What `tooltipRows` may replace; omitted parts keep their default. */
export interface CartesianTooltipContent {
  title?: ReactNode;
  rows?: TooltipRow[];
  /** Rendered under the rows. */
  footer?: ReactNode;
}

export interface CartesianChartProps {
  /** One entry per data point: strings, numbers or dates. */
  categories: readonly XValue[];
  series: readonly CartesianSeries[];
  /** Accessible name of the chart (`aria-label` of the drawing). */
  title: string;
  /** Extra sentence for the hidden data table caption. */
  description?: string;
  /** Height of the plot in pixels, 300 by default. */
  height?: number | "fill";
  /** Width / height ratio; sizes the plot from the container width (wins over a pixel `height`). */
  aspectRatio?: number;
  /** "horizontal" lays categories top to bottom (bar charts). */
  orientation?: "vertical" | "horizontal";
  /** Stacks every area and column series. */
  stack?: StackMode;
  curve?: Curve;
  /** Dots on every line point, or only on these indices of `categories`. Hovered points are always marked. */
  markers?: boolean | readonly number[];
  /** Values printed on the marks. */
  dataLabels?: boolean;
  /** Strokes lines with a gradient from each series color to the next palette color. */
  lineGradient?: boolean;
  /** Eases lines and areas between data updates (live data); off by default. */
  transition?: boolean;
  /** Series with more points than this are reduced with LTTB, 2000 by default; `false` draws every point. */
  maxPoints?: number | false;
  /** Charts with the same id share hover (crosshair and tooltip) and the zoom window. */
  syncId?: string;
  /** Called with the category (and nearest series) under the pointer when the plot is clicked or Enter is pressed. */
  onPointClick?: (point: CartesianPointEvent) => void;
  /** Gradient fill under areas (default true). */
  gradient?: boolean;
  /** Corner radius at the value end of bars, 6 by default. */
  barRadius?: number;
  /** Format of values in tooltips, labels and the data table. */
  valueFormat?: ValueFormat;
  /** Label of a category on the axis and in the tooltip (dates get Spanish defaults). */
  xFormat?: (value: XValue) => string;
  /** "time" spaces dates by real elapsed time; "auto" picks it when every category is a Date and no series is a column. */
  xScale?: "auto" | "band" | "time";
  yAxis?: ValueAxisOptions;
  /** Secondary axis for series with `axis: "right"`. */
  rightAxis?: ValueAxisOptions;
  /**
   * Any number of value axes. `yAxis` and `rightAxis` are shorthand for the ids "left" and "right";
   * more entries stack outward on their `side` (right by default) and series pick one with `axis`.
   */
  axes?: readonly CartesianAxisSpec[];
  /** Background gridlines (default true). */
  grid?: boolean;
  /** Legend placement, or false to hide it. Defaults to "top" with two or more series. */
  legend?: boolean | "top" | "bottom";
  /** Shared tooltip (default true). */
  tooltip?: boolean;
  /** Customises the tooltip content of a category: replace the title or rows, or add a footer. */
  tooltipRows?: (context: CartesianTooltipContext) => CartesianTooltipContent;
  annotations?: readonly ChartAnnotation[];
  /** Tilts the category labels (degrees, e.g. -45) so long names fit; vertical charts only. */
  categoryLabelRotation?: number;
  /** Shows every n-th category label, or those the predicate accepts; replaces the automatic thinning. */
  categoryTickEvery?: number | ((index: number, label: string) => boolean);
  /** Second tier of labels under the category axis (vertical charts); counts must add up to the categories. */
  categoryGroups?: readonly CategoryGroup[];
  /** Click (or Enter on the focused plot) on a category; receives its index in `categories`. */
  onCategoryClick?: (index: number) => void;
  /** Drag-to-zoom on the plot plus an overview brush with a reset button. */
  brush?: boolean;
  /**
   * Controlled band selection (vertical charts): drag across the plot, or click one category, to select
   * an inclusive range of category indices; clicking the only selected category clears it. Unlike `brush`
   * it does not zoom: it reports the range so another chart or a grid can filter by it.
   */
  /** Extra layers over the plot, e.g. the ruler and ink tools of `useChartInk`. Vertical charts only. */
  overlay?: CartesianOverlay;
  rangeSelect?: {
    value: readonly [number, number] | null;
    onChange: (range: readonly [number, number] | null) => void;
  };
  loading?: boolean;
  /** Entry animation (default true; always off with prefers-reduced-motion). */
  animate?: boolean;
  /** Series hidden at first; the legend can show them. */
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}
