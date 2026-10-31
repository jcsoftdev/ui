import { type CSSProperties, memo } from "react";
import { cn } from "../../../utils/cn.js";
import type { SeriesGeometry } from "./layout.js";

const DIM = "transition-opacity duration-200 ease-out";

export interface SeriesMarkProps {
  geometry: SeriesGeometry;
  /** Another series is highlighted from the legend. */
  dimmed: boolean;
  /** Id of the gradient (areas) defined in the chart `<defs>`. */
  gradientId?: string;
  /** Static dots on every point (lines and areas), or only on the listed point indices. */
  markers: boolean | ReadonlySet<number>;
  /** Stacked areas use a flatter fill so layers stay distinguishable. */
  stacked: boolean;
  /** Id of a gradient that strokes the line instead of the flat color. */
  strokeGradientId?: string;
  /** Eases the paths between data updates (Chromium and Firefox; others jump). */
  transition?: boolean;
}

const PATH_EASE = "d 420ms cubic-bezier(0.22, 1, 0.36, 1)";

function morph(d: string, on: boolean): CSSProperties {
  return on ? ({ d: `path("${d}")`, transition: PATH_EASE } as CSSProperties) : {};
}

/** Fill and stroke of an area or line series. */
export const LineAreaMark = memo(function LineAreaMark({
  geometry,
  dimmed,
  gradientId,
  markers,
  stacked,
  strokeGradientId,
  transition = false,
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
            ...morph(geometry.area, transition),
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
          style={{
            stroke: strokeGradientId ? `url(#${strokeGradientId})` : color,
            ...morph(geometry.line, transition),
          }}
        />
      ) : null}
      {markers
        ? geometry.points.map((point, index) =>
            point && (markers === true || markers.has(index)) ? (
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
  /** Id of the `<pattern>` (in the chart `<defs>`) that fills the bars instead of the plain color. */
  patternId?: string;
}

/** Bars of a column series, rounded at their value end. */
export const BarMark = memo(function BarMark({
  geometry,
  dimmed,
  horizontal,
  patternId,
}: BarMarkProps) {
  const { color, dashed } = geometry;
  return (
    <g className={DIM} style={{ opacity: dimmed ? 0.16 : 1 }}>
      {geometry.bars?.map((bar) => (
        <path
          key={bar.key}
          d={bar.d}
          data-bar=""
          style={{
            fill: patternId ? `url(#${patternId})` : (bar.color ?? color),
            fillOpacity: dashed ? 0.35 : 1,
            stroke: dashed || patternId ? (bar.color ?? color) : undefined,
            strokeWidth: patternId ? 1.25 : undefined,
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
            "font-bold text-fs-110 tabular-nums",
            label.inside ? "fill-surface" : "fill-ink-2 stroke-surface",
          )}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
});
