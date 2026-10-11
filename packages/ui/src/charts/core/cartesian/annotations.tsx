import { memo } from "react";
import { estimateTextWidth } from "../axes.js";
import { TONE_COLORS } from "../palette.js";
import type { AnnotationGeometry } from "./layout.js";

export interface AnnotationLayerProps {
  annotations: readonly AnnotationGeometry[];
  width: number;
  height: number;
  /** "under" draws range bands behind the data, "over" draws lines and labels above it. */
  layer: "under" | "over";
}

function Pill({
  x,
  y,
  text,
  ink,
  soft,
  anchor,
}: {
  x: number;
  y: number;
  text: string;
  ink: string;
  soft: string;
  anchor: "start" | "middle" | "end";
}) {
  const width = estimateTextWidth(text, 10.5) + 12;
  const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return (
    <g>
      <rect x={left} y={y - 9} width={width} height={18} rx={9} style={{ fill: soft }} />
      <text
        x={left + width / 2}
        y={y}
        dy="0.35em"
        textAnchor="middle"
        className="font-bold text-fs-105"
        style={{ fill: ink }}
      >
        {text}
      </text>
    </g>
  );
}

/** Threshold lines and highlighted ranges with their labels. */
export const AnnotationLayer = memo(function AnnotationLayer({
  annotations,
  width,
  height,
  layer,
}: AnnotationLayerProps) {
  const items = annotations.filter((note) => (layer === "under") === (note.kind === "range"));
  if (!items.length) return null;
  return (
    <g>
      {items.map((note) => {
        const { ink, soft } = TONE_COLORS[note.tone];
        if (!("direction" in note)) {
          const half = note.label ? (estimateTextWidth(note.label, 10.5) + 12) / 2 : 0;
          const x = Math.min(Math.max(note.x, half), Math.max(half, width - half));
          const above = note.y > 26;
          const y = note.kind === "point" ? note.y + (above ? -16 : 16) : note.y;
          return (
            <g key={note.key} data-annotation={note.kind}>
              {note.kind === "point" ? (
                <circle
                  cx={note.x}
                  cy={note.y}
                  r={5}
                  strokeWidth={2.5}
                  style={{ fill: ink, stroke: "var(--surface)" }}
                />
              ) : null}
              {note.label ? (
                note.kind === "point" ? (
                  <Pill x={x} y={y} text={note.label} ink={ink} soft={soft} anchor="middle" />
                ) : (
                  <text
                    x={x}
                    y={y}
                    dy="0.35em"
                    textAnchor="middle"
                    paintOrder="stroke"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    className="stroke-surface font-bold text-fs-110"
                    style={{ fill: ink }}
                  >
                    {note.label}
                  </text>
                )
              ) : null}
            </g>
          );
        }
        const horizontal = note.direction === "horizontal";
        if (note.kind === "range") {
          return (
            <g key={note.key}>
              <rect
                x={horizontal ? 0 : note.from}
                y={horizontal ? note.from : 0}
                width={horizontal ? width : note.to - note.from}
                height={horizontal ? note.to - note.from : height}
                style={{ fill: ink, fillOpacity: 0.07 }}
              />
              {note.label ? (
                <text
                  x={(horizontal ? 0 : note.from) + 6}
                  y={(horizontal ? note.from : 0) + 13}
                  className="font-bold text-fs-105"
                  style={{ fill: ink }}
                >
                  {note.label}
                </text>
              ) : null}
            </g>
          );
        }
        return (
          <g key={note.key}>
            <line
              x1={horizontal ? 0 : note.from}
              x2={horizontal ? width : note.from}
              y1={horizontal ? note.from : 0}
              y2={horizontal ? note.from : height}
              strokeWidth={1.25}
              strokeDasharray="5 4"
              shapeRendering="crispEdges"
              style={{ stroke: ink }}
            />
            {note.label ? (
              horizontal ? (
                <Pill
                  x={width - 2}
                  y={note.from}
                  text={note.label}
                  ink={ink}
                  soft={soft}
                  anchor="end"
                />
              ) : (
                <Pill
                  x={note.from + (note.from > width * 0.7 ? -4 : 4)}
                  y={11}
                  text={note.label}
                  ink={ink}
                  soft={soft}
                  anchor={note.from > width * 0.7 ? "end" : "start"}
                />
              )
            ) : null}
          </g>
        );
      })}
    </g>
  );
});
