import type { ValueFormat } from "../format.js";
import type { Curve } from "../path.js";
import type { StackMode } from "../stack.js";
import type {
  ChartAnnotation,
  ChartLabels,
  ChartSeries,
  ValueAxisOptions,
  XValue,
} from "../types.js";

export type MarkKind = "line" | "area" | "column";

export interface CartesianSeries extends ChartSeries {
  /** How the series is drawn. */
  kind: MarkKind;
  /** Value axis the series is measured against. */
  axis?: "left" | "right";
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
  /** Dots on every line point. Hovered points are always marked. */
  markers?: boolean;
  /** Values printed on the marks. */
  dataLabels?: boolean;
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
  /** Background gridlines (default true). */
  grid?: boolean;
  /** Legend placement, or false to hide it. Defaults to "top" with two or more series. */
  legend?: boolean | "top" | "bottom";
  /** Shared tooltip (default true). */
  tooltip?: boolean;
  annotations?: readonly ChartAnnotation[];
  /** Drag-to-zoom on the plot plus an overview brush with a reset button. */
  brush?: boolean;
  loading?: boolean;
  /** Entry animation (default true; always off with prefers-reduced-motion). */
  animate?: boolean;
  /** Series hidden at first; the legend can show them. */
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}
