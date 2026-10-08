import { Fragment, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * One series. Color is assigned by position, never by name: `series[0]`
 * paints `accent`, `series[1]` paints `accent-2`. `label` is the only textual
 * identity of the series and feeds the accessible table, so color is never
 * the only way to tell series apart.
 */
export interface HBarSeries {
  id: string;
  label: string;
}

/** At most two series. */
export type HBarSeriesTuple = readonly [HBarSeries] | readonly [HBarSeries, HBarSeries];

/** One value per declared series, in the same order. */
export type HBarValues = readonly [number] | readonly [number, number];

export interface HBarRow {
  id: string;
  name: string;
  /** Values aligned 1:1 with `HBarsProps.series`. */
  values: HBarValues;
  /** Tints the visible value. */
  tone?: "default" | "danger";
  /** Overrides the value text (default: sum when stacked, both numbers when paired). */
  valueText?: ReactNode;
}

export interface HBarTick {
  /** Percentage position (0-100) over `scaleMax`. */
  position: number;
  label: string;
}

export type HBarsVariant = "stacked" | "paired";

export interface HBarsProps {
  rows: HBarRow[];
  series: HBarSeriesTuple;
  /** Domain value that maps to 100% of the bar width. */
  scaleMax: number;
  /** Ticks of the bottom axis; the whole row is omitted when not passed. */
  ticks?: HBarTick[];
  /** Threshold line, in the same scale as `scaleMax`. */
  threshold?: number;
  /**
   * "stacked" (default): one fill per row split between series by `flex`.
   * "paired": each series draws its own independent fill so two metrics on
   * the same scale can be compared.
   */
  variant?: HBarsVariant;
  /** Accessible table caption exposing the same numbers as the visual grid. */
  description: string;
  /** Header of the name column in the accessible table. */
  nameHeader: string;
  className?: string;
}

const SEGMENT_CLASS: Record<0 | 1, string> = {
  0: "bg-accent",
  1: "bg-accent-2",
};

function rowSum(values: HBarValues): number {
  return values.reduce((total, value) => total + value, 0);
}

function defaultValueText(values: HBarValues, variant: HBarsVariant): ReactNode {
  if (variant === "paired") {
    return values.map((value, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: two fixed values, never reordered.
      <Fragment key={index}>
        {index > 0 ? <br /> : null}
        {value}
      </Fragment>
    ));
  }
  return rowSum(values);
}

/**
 * Horizontal comparison bars. The visual grid is `aria-hidden`; an `sr-only`
 * table exposes name plus each series value as real text.
 */
export function HBars({
  rows,
  series,
  scaleMax,
  ticks,
  threshold,
  variant = "stacked",
  description,
  nameHeader,
  className,
}: HBarsProps) {
  const paired = variant === "paired";
  const thresholdPct = threshold != null ? (threshold / scaleMax) * 100 : null;

  return (
    <div className={cn("@container flex flex-col", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-cols-[118px_minmax(0,1fr)_30px] items-center gap-x-3 gap-y-2.5 px-4 pt-3.5 pb-1.5",
          "@max-[560px]:grid-cols-[86px_minmax(0,1fr)_26px]",
        )}
      >
        {rows.map((row) => (
          <Fragment key={row.id}>
            <span className="truncate font-semibold text-[12.5px]">{row.name}</span>
            <div className="relative flex h-[22px] items-center border-r-divider bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px)] [background-size:20%_100%]">
              {paired ? (
                <div className="flex h-[26px] w-full flex-col items-start justify-center gap-[3px]">
                  {row.values.map((value, index) => (
                    <div
                      key={series[index]?.id ?? index}
                      className="relative z-[1] flex h-2 overflow-hidden rounded-xs"
                      style={{ width: `${(value / scaleMax) * 100}%` }}
                    >
                      <div className={cn("block h-full flex-1", SEGMENT_CLASS[index as 0 | 1])} />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="relative z-[1] flex h-3 overflow-hidden rounded-xs"
                  style={{ width: `${(rowSum(row.values) / scaleMax) * 100}%` }}
                >
                  {row.values.map((value, index) => (
                    <div
                      key={series[index]?.id ?? index}
                      className={cn("block h-full", SEGMENT_CLASS[index as 0 | 1])}
                      style={{ flex: value }}
                    />
                  ))}
                </div>
              )}
              {thresholdPct != null ? (
                <span
                  aria-hidden="true"
                  className="absolute top-[-4px] bottom-[-4px] z-[2] border-danger border-l-[1.5px] border-dashed"
                  style={{ left: `${thresholdPct}%` }}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "text-right font-semibold text-[12px] leading-none tabular-nums",
                paired && "leading-[1.25]",
                row.tone === "danger" && "text-danger",
              )}
            >
              {row.valueText ?? defaultValueText(row.values, variant)}
            </span>
          </Fragment>
        ))}
        {ticks ? (
          <>
            <span />
            <div className="relative h-4">
              {ticks.map((tick) => (
                <span
                  key={tick.position}
                  className="-translate-x-1/2 absolute font-medium text-[10.5px] text-ink-3 leading-none tabular-nums"
                  style={{ left: `${tick.position}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
            <span />
          </>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>{description}</caption>
        <thead>
          <tr>
            <th scope="col">{nameHeader}</th>
            {series.map((item) => (
              <th key={item.id} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              {row.values.map((value, index) => (
                <td key={series[index]?.id ?? index}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
