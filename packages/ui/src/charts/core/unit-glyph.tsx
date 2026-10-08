import { memo } from "react";
import { EASE_OUT } from "./motion.js";
import type { ResolvedUnitShape } from "./unit-icons.js";

export interface UnitGlyphProps {
  shape: ResolvedUnitShape;
  /** Top-left corner of the square cell, in pixels. */
  x: number;
  y: number;
  /** Side of the square cell. */
  size: number;
  /** 0 to 1: how much of the unit is filled (the rest shows the track). */
  fill: number;
  color: string;
  /** Draw the unfilled part in the track color. */
  track?: boolean;
  /** Unique id for the clip of a partial unit. */
  clipId: string;
  /** Partial units fill left to right ("right") or bottom to top ("up"). */
  direction?: "right" | "up";
}

/**
 * One icon of a unit chart, centered in a square cell. A partial unit draws
 * the track silhouette and clips the colored copy, so 0.6 of a person is
 * exactly 60% of its width. The outer group carries `data-unit` and a
 * fill-box origin, so entry animations can scale it in place.
 */
export const UnitGlyph = memo(function UnitGlyph({
  shape,
  x,
  y,
  size,
  fill,
  color,
  track = true,
  clipId,
  direction = "right",
}: UnitGlyphProps) {
  const scale = size / Math.max(shape.width, shape.height);
  const dx = x + (size - shape.width * scale) / 2;
  const dy = y + (size - shape.height * scale) / 2;
  const amount = Math.min(1, Math.max(0, fill));
  const partial = amount > 0 && amount < 1;
  return (
    <g data-unit="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      <g transform={`translate(${dx} ${dy}) scale(${scale})`}>
        {partial ? (
          <clipPath id={clipId}>
            {direction === "up" ? (
              <rect
                x={0}
                y={shape.height * (1 - amount)}
                width={shape.width}
                height={shape.height * amount}
              />
            ) : (
              <rect x={0} y={0} width={shape.width * amount} height={shape.height} />
            )}
          </clipPath>
        ) : null}
        {track && amount < 1 ? (
          <path d={shape.path} style={{ fill: "var(--track)", fillRule: shape.fillRule }} />
        ) : null}
        {amount > 0 ? (
          <path
            d={shape.path}
            clipPath={partial ? `url(#${clipId})` : undefined}
            style={{ fill: color, fillRule: shape.fillRule }}
          />
        ) : null}
      </g>
    </g>
  );
});

/**
 * Unit charts make their frame a named container, so the HTML around the
 * drawing follows the chart width instead of the viewport.
 */
export const UNIT_FRAME_CLASS = "@container/units";

/** Legend under the drawing in narrow containers, at its requested place from `@sm` up. */
export const UNIT_LEGEND_CLASS = "order-last @sm/units:order-none";

/**
 * Pops every `[data-unit]` in document order: a short scale-and-fade with a
 * stagger that keeps the whole sequence under about a second.
 */
export function popUnits(root: Element, { duration = 420, budget = 900 } = {}): void {
  const units = root.querySelectorAll("[data-unit]");
  const step = units.length > 1 ? Math.min(28, budget / units.length) : 0;
  units.forEach((unit, index) => {
    unit.animate(
      [
        { transform: "scale(0.3)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration, delay: index * step, easing: EASE_OUT, fill: "backwards" },
    );
  });
}
