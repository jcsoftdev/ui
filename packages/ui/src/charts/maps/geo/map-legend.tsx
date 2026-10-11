import {
  type ColorRange,
  rangeColor,
  type ScaleColors,
  scaleGradient,
} from "../../core/color-scale.js";
import type { ValueFormatter } from "../../core/format.js";

export interface MapLegendProps {
  kind: "sequential" | "diverging";
  domain: readonly [number, number];
  center?: number;
  colors?: ScaleColors;
  /** Stepped scale: one swatch per range instead of a gradient bar. */
  ranges?: readonly ColorRange[];
  format: ValueFormatter;
  /** Swatch for regions without data, with its label. */
  noData?: string;
}

/**
 * Color key of a choropleth: a gradient bar with its extremes (and centre when
 * diverging), or one swatch per range. It sits under the map in narrow
 * containers and above it, aligned to the end, from `@md/chart`.
 */
export function MapLegend({
  kind,
  domain,
  center = 0,
  colors,
  ranges,
  format,
  noData,
}: MapLegendProps) {
  const missing = noData ? (
    <span className="inline-flex items-center gap-1.5 font-semibold text-fs-120 text-ink-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-xs border border-line"
        style={{ background: "var(--surface-2)" }}
      />
      {noData}
    </span>
  ) : null;
  return (
    <div className="@md/chart:-order-1 flex flex-wrap items-end gap-x-4 gap-y-2 @md/chart:justify-end">
      {ranges && ranges.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-fs-120">
          {ranges.map((range, index) => (
            <li
              key={range.label}
              className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink-2"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-xs"
                style={{ background: rangeColor(range, index, ranges.length).color }}
              />
              <span className="truncate">{range.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div
          aria-hidden="true"
          className="flex w-full max-w-[220px] flex-col gap-1 text-fs-110 text-ink-3 tabular-nums"
        >
          <span
            className="h-2 w-full rounded-pill"
            style={{ background: scaleGradient(kind, colors) }}
          />
          <span className="flex justify-between font-semibold">
            <span>{format(domain[0])}</span>
            {kind === "diverging" ? <span>{format(center)}</span> : null}
            <span>{format(domain[1])}</span>
          </span>
        </div>
      )}
      {missing}
    </div>
  );
}
