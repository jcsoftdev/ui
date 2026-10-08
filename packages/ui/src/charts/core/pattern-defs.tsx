import { type ChartPattern, resolvePattern } from "./patterns.js";

export interface PatternDefItem {
  /** Id the marks reference with `url(#id)` (see `patternId`). */
  id: string;
  pattern: ChartPattern;
  /** Series color: a CSS color or `var()` token. */
  color: string;
}

/**
 * `<pattern>` definitions to place inside an `<svg><defs>`. Strokes and fills
 * use the item colour through `style`, so tokens resolve per theme.
 */
export function ChartPatternDefs({ items }: { items: readonly PatternDefItem[] }) {
  return (
    <>
      {items.map(({ id, pattern, color }) => {
        const tile = resolvePattern(pattern);
        return (
          <pattern
            key={id}
            id={id}
            patternUnits="userSpaceOnUse"
            width={tile.size}
            height={tile.size}
          >
            <rect
              width={tile.size}
              height={tile.size}
              style={{ fill: color, fillOpacity: tile.backdrop ?? 0.2 }}
            />
            {tile.shapes.map((shape, index) => {
              // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and ordered.
              const key = index;
              if (shape.type === "line") {
                return (
                  <line
                    key={key}
                    x1={shape.x1}
                    y1={shape.y1}
                    x2={shape.x2}
                    y2={shape.y2}
                    strokeWidth={shape.width ?? 1.6}
                    style={{ stroke: color }}
                  />
                );
              }
              if (shape.type === "circle") {
                return (
                  <circle
                    key={key}
                    cx={shape.cx}
                    cy={shape.cy}
                    r={shape.r}
                    style={{ fill: color }}
                  />
                );
              }
              if (shape.type === "rect") {
                return (
                  <rect
                    key={key}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    style={{ fill: color }}
                  />
                );
              }
              return (
                <path
                  key={key}
                  d={shape.d}
                  strokeWidth={shape.width ?? 1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ fill: shape.filled ? color : "none", stroke: color }}
                />
              );
            })}
          </pattern>
        );
      })}
    </>
  );
}
