import type { ComponentPropsWithoutRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { glyphLayout, type TableShape, UNIT } from "./layout.js";

export type TableGlyphSize = "sm" | "md" | "lg" | "fill";

export type TableGlyphPattern = "dashed" | "solid" | "soft" | "strong";

export type TableGlyphPart = "root" | "body" | "chair";

export interface TableGlyphProps extends Omit<ComponentPropsWithoutRef<"svg">, "children"> {
  shape: TableShape;
  /** Chairs drawn around the table. */
  seats: number;
  /** How many chairs are filled, in drawing order. Clamped to `seats`. */
  occupied?: number;
  /**
   * Height of a one-unit box from the control-height tokens, so it follows density; wider shapes
   * grow from it. `fill` takes the size of the parent instead.
   */
  size?: TableGlyphSize;
  /** Box in grid units (1 unit is one square cell). Defaults to 1x1, rect 2x1 and bar 3x1. */
  width?: number;
  height?: number;
  /** Table surface: `dashed` outline, `solid` outline on the surface, `soft` or `strong` tint. Defaults to `solid`. */
  pattern?: TableGlyphPattern;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<TableGlyphPart>;
}

const sizeClasses: Record<TableGlyphSize, string> = {
  sm: "h-control w-auto",
  md: "h-control-lg w-auto",
  lg: "h-[calc(var(--control-height-lg)*1.5)] w-auto",
  fill: "size-full",
};

const patternClasses: Record<TableGlyphPattern, string> = {
  dashed: "fill-transparent",
  solid: "fill-surface",
  soft: "fill-current/10",
  strong: "fill-current/35",
};

const defaultBox: Record<TableShape, readonly [number, number]> = {
  round: [1, 1],
  square: [1, 1],
  rect: [2, 1],
  bar: [3, 1],
};

const STROKE = 1.5;

/**
 * An SVG table with its chairs placed from `seats` and `shape`: radial for round, one per side
 * (then spread) for square, ends plus long sides for rect, a row of stools for bar. It draws with
 * `currentColor` and the surface token, so it follows the text colour and the theme. Decorative
 * (`aria-hidden`) unless an `aria-label` is given.
 */
export function TableGlyph({
  shape,
  seats,
  occupied = 0,
  size = "md",
  width,
  height,
  pattern = "solid",
  className,
  classNames,
  "aria-label": ariaLabel,
  ...props
}: TableGlyphProps) {
  const [defaultW, defaultH] = defaultBox[shape];
  const w = (width ?? defaultW) * UNIT;
  const h = (height ?? defaultH) * UNIT;
  const layout = glyphLayout(shape, seats, w, h);
  const filled = Math.max(0, Math.min(Math.floor(occupied), layout.chairs.length));
  const { body } = layout;
  const labelled = ariaLabel !== undefined;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role={labelled ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      data-shape={shape}
      data-seats={layout.chairs.length}
      data-occupied={filled}
      data-pattern={pattern}
      preserveAspectRatio="xMidYMid meet"
      className={cn("shrink-0 text-ink-2", sizeClasses[size], classNames?.root, className)}
      {...props}
    >
      {body.round ? (
        <circle
          cx={body.x + body.width / 2}
          cy={body.y + body.height / 2}
          r={body.width / 2}
          data-part="body"
          className={cn("stroke-current", patternClasses[pattern], classNames?.body)}
          strokeWidth={STROKE}
          strokeDasharray={pattern === "dashed" ? "5 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <rect
          x={body.x}
          y={body.y}
          width={body.width}
          height={body.height}
          rx={6}
          data-part="body"
          className={cn("stroke-current", patternClasses[pattern], classNames?.body)}
          strokeWidth={STROKE}
          strokeDasharray={pattern === "dashed" ? "5 4" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {layout.chairs.map((chair, index) => {
        const taken = index < filled;
        const chairClass = cn(
          "stroke-current",
          taken ? "fill-current" : "fill-surface",
          classNames?.chair,
        );
        const key = `${chair.cx.toFixed(2)}-${chair.cy.toFixed(2)}`;
        return chair.circle ? (
          <circle
            key={key}
            cx={chair.cx}
            cy={chair.cy}
            r={chair.width / 2}
            data-part="chair"
            data-occupied={taken ? "" : undefined}
            className={chairClass}
            strokeWidth={STROKE}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <rect
            key={key}
            x={chair.cx - chair.width / 2}
            y={chair.cy - chair.height / 2}
            width={chair.width}
            height={chair.height}
            rx={5}
            transform={`rotate(${chair.rotate.toFixed(2)} ${chair.cx.toFixed(2)} ${chair.cy.toFixed(2)})`}
            data-part="chair"
            data-occupied={taken ? "" : undefined}
            className={chairClass}
            strokeWidth={STROKE}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
