import { memo } from "react";
import { cn } from "../../../utils/cn.js";
import type { SeriesGeometry } from "./layout.js";

const DIM = "transition-opacity duration-200 ease-out";

export interface SeriesMarkProps {
  geometry: SeriesGeometry;
  /** Another series is highlighted from the legend. */
  dimmed: boolean;
  /** Id of the gradient (areas) defined in the chart `<defs>`. */
  gradientId?: string;
  /** Static dots on every point (lines and areas). */
  markers: boolean;
  /** Stacked areas use a flatter fill so layers stay distinguishable. */
  stacked: boolean;
}

/** Fill and stroke of an area or line series. */
export const LineAreaMark = memo(function LineAreaMark({
  geometry,
  dimmed,
  gradientId,
  markers,
  stacked,
}: SeriesMarkProps) {
  const { color, dashed } = geometry;
  return (
    <g className={DIM} style={{ opacity: dimmed ? 0.16 : 1 }}>
      {geometry.area ? (
        <path
          d={geometry.area}
          style={{
            fill: gradientId ? `url(#${gradientId})` : color,
            fillOpacity: gradientId ? 1 : stacked ? 0.42 : 0.16,
          }}
        />
      ) : null}
      {geometry.line ? (
        <path
          d={geometry.line}
          fill="none"
          strokeWidth={geometry.kind === "area" ? 2 : 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "6 6" : undefined}
          style={{ stroke: color }}
        />
      ) : null}
      {markers
        ? geometry.points.map((point, index) =>
            point ? (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: one marker per category index.
                key={index}
                cx={point.x}
                cy={point.y}
                r={3.25}
                strokeWidth={2}
                style={{ fill: "var(--surface)", stroke: color }}
              />
            ) : null,
          )
        : null}
    </g>
  );
});

export interface BarMarkProps {
  geometry: SeriesGeometry;
  dimmed: boolean;
  horizontal: boolean;
}

/** Bars of a column series, rounded at their value end. */
export const BarMark = memo(function BarMark({ geometry, dimmed, horizontal }: BarMarkProps) {
  const { color, dashed } = geometry;
  return (
    <g className={DIM} style={{ opacity: dimmed ? 0.16 : 1 }}>
      {geometry.bars?.map((bar) => (
        <path
          key={bar.key}
          d={bar.d}
          data-bar=""
          style={{
            fill: color,
            fillOpacity: dashed ? 0.35 : 1,
            stroke: dashed ? color : undefined,
            strokeDasharray: dashed ? "4 3" : undefined,
            transformBox: "fill-box",
            transformOrigin: horizontal
              ? bar.negative
                ? "right center"
                : "left center"
              : bar.negative
                ? "center top"
                : "center bottom",
          }}
        />
      ))}
    </g>
  );
});

export interface DataLabelsProps {
  geometry: SeriesGeometry;
  dimmed: boolean;
}

/** Values printed next to (or inside) the marks, with a halo for legibility. */
export const DataLabels = memo(function DataLabels({ geometry, dimmed }: DataLabelsProps) {
  if (!geometry.labels.length) return null;
  return (
    <g data-fade="" className={DIM} style={{ opacity: dimmed ? 0.16 : 1 }}>
      {geometry.labels.map((label) => (
        <text
          key={label.key}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          paintOrder="stroke"
          strokeWidth={label.inside ? 0 : 3}
          strokeLinejoin="round"
          className={cn(
            "font-bold text-[10.5px] tabular-nums",
            label.inside ? "fill-surface" : "fill-ink-2 stroke-surface",
          )}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
});
