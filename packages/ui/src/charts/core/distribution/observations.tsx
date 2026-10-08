import { memo } from "react";
import { sequentialColor } from "../color-scale.js";

export interface ObservationDotsProps {
  points: ReadonlyArray<{ value: number; offset: number }>;
  /** Value to pixel along the value axis. */
  map: (value: number) => number;
  /** Pixel of the group axis on the cross axis. */
  center: number;
  horizontal: boolean;
  color: string;
  /** "value" grades the fill from a pale tint of `color` to `color` across `range`. */
  coloring?: "series" | "value";
  range?: readonly [number, number];
  radius?: number;
  dimmed?: boolean;
}

/** Raw observations of a box or violin as small dots (jitter already applied). */
export const ObservationDots = memo(function ObservationDots({
  points,
  map,
  center,
  horizontal,
  color,
  coloring = "series",
  range,
  radius = 2.6,
  dimmed,
}: ObservationDotsProps) {
  const graded = coloring === "value" && range != null;
  return (
    <g
      data-observations=""
      className="pointer-events-none transition-opacity duration-150"
      style={{ opacity: dimmed ? 0.2 : 1 }}
    >
      {points.map((point, index) => {
        const at = map(point.value);
        const fill = graded
          ? sequentialColor(point.value, range, { mid: "var(--surface)", high: color }).color
          : color;
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: samples repeat; order is stable.
            key={index}
            cx={horizontal ? at : center + point.offset}
            cy={horizontal ? center + point.offset : at}
            r={radius}
            strokeWidth={graded ? 0.75 : 0.5}
            style={{
              fill,
              fillOpacity: graded ? 0.95 : 0.6,
              stroke: graded ? color : "var(--surface)",
            }}
          />
        );
      })}
    </g>
  );
});
