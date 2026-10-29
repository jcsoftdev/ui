import { memo } from "react";

export interface AxisTick {
  /** Stable key. */
  key: string | number;
  /** Pixel position along the axis, inside the plot. */
  position: number;
  label: string;
}

/** Approximate rendered width of a tick label at 11px (tabular figures). */
export function estimateTextWidth(text: string, fontSize = 11): number {
  return text.length * fontSize * 0.58;
}

/**
 * Drops labels that would collide, keeping an even rhythm (every 2nd, 3rd, ...)
 * so the first label always stays.
 */
export function thinTicks(ticks: readonly AxisTick[], gap = 10): AxisTick[] {
  if (ticks.length < 3) return [...ticks];
  const widest = Math.max(...ticks.map((tick) => estimateTextWidth(tick.label)));
  const first = ticks[0] as AxisTick;
  const second = ticks[1] as AxisTick;
  const spacing = Math.abs(second.position - first.position) || 1;
  const every = Math.max(1, Math.ceil((widest + gap) / spacing));
  return ticks.filter((_, index) => index % every === 0);
}

const TEXT = "fill-ink-3 font-medium text-fs-110 tabular-nums";

export interface GridLinesProps {
  ticks: readonly AxisTick[];
  /** Lines across the plot: horizontal for a vertical value axis. */
  direction: "horizontal" | "vertical";
  /** Plot width (horizontal lines) or height (vertical lines). */
  length: number;
  /** Position of the zero line, drawn stronger. */
  zero?: number;
}

/** Soft background lines; the zero line, when visible, is a little stronger. */
export const GridLines = memo(function GridLines({
  ticks,
  direction,
  length,
  zero,
}: GridLinesProps) {
  const horizontal = direction === "horizontal";
  return (
    <g>
      {ticks.map((tick) => (
        <line
          key={tick.key}
          x1={horizontal ? 0 : tick.position}
          x2={horizontal ? length : tick.position}
          y1={horizontal ? tick.position : 0}
          y2={horizontal ? tick.position : length}
          shapeRendering="crispEdges"
          style={{ stroke: "var(--chart-grid)" }}
        />
      ))}
      {zero != null ? (
        <line
          x1={horizontal ? 0 : zero}
          x2={horizontal ? length : zero}
          y1={horizontal ? zero : 0}
          y2={horizontal ? zero : length}
          shapeRendering="crispEdges"
          style={{ stroke: "var(--line-strong)" }}
        />
      ) : null}
    </g>
  );
});

export interface AxisProps {
  ticks: readonly AxisTick[];
  /** Offset of the axis line: `y` for bottom, `x` for left/right. */
  offset: number;
  title?: string;
  /** Overrides the label color (a value axis matched to its series). */
  color?: string;
  /** Tilts the labels by this many degrees (negative reads up and to the right), e.g. -45. */
  rotate?: number;
}

/** Category or time labels under the plot. */
export const AxisBottom = memo(function AxisBottom({ ticks, offset, rotate }: AxisProps) {
  return (
    <g transform={`translate(0,${offset})`}>
      {ticks.map((tick) =>
        rotate ? (
          <text
            key={tick.key}
            x={tick.position}
            y={12}
            textAnchor={rotate < 0 ? "end" : "start"}
            transform={`rotate(${rotate} ${tick.position} 12)`}
            className={TEXT}
          >
            {tick.label}
          </text>
        ) : (
          <text key={tick.key} x={tick.position} y={18} textAnchor="middle" className={TEXT}>
            {tick.label}
          </text>
        ),
      )}
    </g>
  );
});

/** Value labels on the left, right-aligned against the plot. */
export const AxisLeft = memo(function AxisLeft({ ticks, offset, title, color }: AxisProps) {
  return (
    <g transform={`translate(${offset},0)`}>
      {title ? (
        <text
          x={-10}
          y={-16}
          textAnchor="end"
          className="fill-ink-3 font-bold text-fs-110"
          style={color ? { fill: color } : undefined}
        >
          {title}
        </text>
      ) : null}
      {ticks.map((tick) => (
        <text
          key={tick.key}
          x={-10}
          y={tick.position}
          dy="0.34em"
          textAnchor="end"
          className={TEXT}
          style={color ? { fill: color } : undefined}
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
});

/** Value labels on the right, for a secondary axis. */
export const AxisRight = memo(function AxisRight({ ticks, offset, title, color }: AxisProps) {
  return (
    <g transform={`translate(${offset},0)`}>
      {title ? (
        <text
          x={10}
          y={-16}
          textAnchor="start"
          className="fill-ink-3 font-bold text-fs-110"
          style={color ? { fill: color } : undefined}
        >
          {title}
        </text>
      ) : null}
      {ticks.map((tick) => (
        <text
          key={tick.key}
          x={10}
          y={tick.position}
          dy="0.34em"
          textAnchor="start"
          className={TEXT}
          style={color ? { fill: color } : undefined}
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
});
