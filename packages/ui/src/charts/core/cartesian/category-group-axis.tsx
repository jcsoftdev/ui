import { estimateTextWidth } from "../axes.js";
import type { CategoryGroupSpan } from "./category-groups.js";

function fit(label: string, room: number): string {
  if (estimateTextWidth(label, 12) <= room) return label;
  const max = Math.max(1, Math.floor(room / 7) - 1);
  return room < 14 ? "" : `${label.slice(0, max).trimEnd()}…`;
}

/** Brackets and labels of category groups, placed `offset` pixels below the plot. */
export function CategoryGroupAxis({
  spans,
  offset,
}: {
  spans: readonly CategoryGroupSpan[];
  offset: number;
}) {
  return (
    <g transform={`translate(0,${offset})`}>
      {spans.map((span) => (
        <g key={span.key}>
          <path
            d={`M${span.from + 4} 0 V4 H${span.to - 4} V0`}
            fill="none"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--line-strong)" }}
          />
          <text
            x={span.center}
            y={19}
            textAnchor="middle"
            className="font-bold text-fs-120"
            style={{ fill: "var(--ink-2)" }}
          >
            {fit(span.label, span.to - span.from - 8)}
          </text>
        </g>
      ))}
    </g>
  );
}
