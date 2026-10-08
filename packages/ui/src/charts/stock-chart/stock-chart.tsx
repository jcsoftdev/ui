"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import type { IndexRange } from "../core/cartesian/brush.js";
import { fullCategoryLabel } from "../core/category-axis.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import type { IndicatorSeries } from "../core/indicators.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { seriesColor } from "../core/palette.js";
import { rangeWindow, type TimeRangePreset } from "../core/time-range.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useSeriesState } from "../core/use-series-state.js";
import {
  bollingerMiddle,
  oscillatorModel,
  overlayId,
  overlayLines,
  type StockBar,
  type StockComparison,
  type StockFlag,
  type StockOscillator,
  type StockOverlay,
  type StockSeriesType,
  sameDay,
} from "./stock-model.js";
import { NAVIGATOR_GAP, NAVIGATOR_HEIGHT, StockPlot, type StockTexts } from "./stock-plot.js";

export type {
  StockBar,
  StockComparison,
  StockFlag,
  StockOscillator,
  StockOverlay,
  StockSeriesType,
} from "./stock-model.js";
export type { StockTexts } from "./stock-plot.js";

const DEFAULT_TEXTS: StockTexts = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  change: "Change",
  price: "Price",
  ranges: "Range",
  seriesTypes: "Series type",
  seriesTypeNames: { candle: "Candles", ohlc: "OHLC", line: "Line", area: "Area" },
  signal: "Signal",
  histogram: "Histogram",
  events: "Events",
};

/** 1W, 1M, 3M, 6M, 1Y, All. Pass Spanish labels ("1S", "1A", "Todo") through `ranges`. */
export const DEFAULT_STOCK_RANGES: readonly TimeRangePreset[] = [
  { id: "1w", label: "1W", unit: "week", count: 1, description: "Last week" },
  { id: "1m", label: "1M", unit: "month", count: 1, description: "Last month" },
  { id: "3m", label: "3M", unit: "month", count: 3, description: "Last 3 months" },
  { id: "6m", label: "6M", unit: "month", count: 6, description: "Last 6 months" },
  { id: "1y", label: "1Y", unit: "year", count: 1, description: "Last year" },
  { id: "all", label: "All", unit: "all", description: "All data" },
];

const SERIES_TYPES: readonly StockSeriesType[] = ["candle", "ohlc", "line", "area"];

export interface StockChartProps {
  /** Bars in ascending date order. */
  data: readonly StockBar[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Controlled series type. */
  seriesType?: StockSeriesType;
  /** Initial series type when uncontrolled, "candle" by default. */
  defaultSeriesType?: StockSeriesType;
  onSeriesTypeChange?: (type: StockSeriesType) => void;
  /** Types offered in the toolbar; an empty list hides the switch. */
  seriesTypes?: readonly StockSeriesType[];
  /** Range selector buttons; an empty list hides them. */
  ranges?: readonly TimeRangePreset[];
  /** Id of the preset applied first; the whole series by default. */
  defaultRange?: string;
  /** Indicators over the price: SMA, EMA, Bollinger bands, VWAP. */
  overlays?: readonly StockOverlay[];
  /** RSI or MACD in a pane under the price, sharing the crosshair. */
  oscillator?: StockOscillator;
  /** Volume bars at the bottom of the price pane; shown when the data has volume. */
  volume?: boolean;
  /** Mini chart of the whole series with a draggable window (default true). */
  navigator?: boolean;
  /** Dashed line and tag at the last value (default true). */
  lastPrice?: boolean;
  /** Other series on the same dates: the chart switches to % change from the first visible bar. */
  comparisons?: readonly StockComparison[];
  /** Event flags pinned above the bars. */
  flags?: readonly StockFlag[];
  /** Name of the main series in the legend (% mode). */
  name?: string;
  /** Pixels of the drawing (price, oscillator and navigator), 420 by default, or `"fill"`. */
  height?: number | "fill";
  /** Width / height ratio; sizes the chart from the container width. */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  volumeFormat?: ValueFormat;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  /** Toolbar with the range and series-type buttons (default true). */
  toolbar?: boolean;
  loading?: boolean;
  animate?: boolean;
  texts?: Partial<StockTexts>;
  labels?: Partial<ChartLabels>;
  className?: string;
}

/**
 * Price chart for long daily series: candles, OHLC bars, a line or an area;
 * a range selector and a navigator to zoom; moving averages, Bollinger bands
 * and VWAP over the price; RSI or MACD in a second pane with one crosshair
 * across both; a last-price tag; comparison series in % change; event flags.
 * The indicator math lives in `core/indicators.ts`.
 */
export function StockChart({
  data,
  title,
  description,
  seriesType: typeProp,
  defaultSeriesType = "candle",
  onSeriesTypeChange,
  seriesTypes = SERIES_TYPES,
  ranges = DEFAULT_STOCK_RANGES,
  defaultRange,
  overlays = [],
  oscillator,
  volume,
  navigator = true,
  lastPrice = true,
  comparisons = [],
  flags = [],
  name,
  height = 420,
  aspectRatio,
  valueFormat,
  volumeFormat = "compact",
  grid = true,
  legend = true,
  tooltip = true,
  toolbar = true,
  loading,
  animate = true,
  texts: textOverrides,
  labels: labelOverrides,
  className,
}: StockChartProps) {
  const labels = resolveLabels(labelOverrides);
  const texts = { ...DEFAULT_TEXTS, ...textOverrides };
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const vfmt = useMemo(() => resolveFormat(volumeFormat), [volumeFormat]);
  const [typeState, setTypeState] = useState<StockSeriesType>(defaultSeriesType);
  const seriesType = typeProp ?? typeState;
  const setSeriesType = (next: StockSeriesType) => {
    if (typeProp == null) setTypeState(next);
    onSeriesTypeChange?.(next);
  };
  const series = useSeriesState();

  const dates = useMemo(() => data.map((bar) => bar.date), [data]);
  const presetWindow = (id: string | undefined): IndexRange => {
    const preset = ranges.find((item) => item.id === id);
    return preset ? rangeWindow(dates, preset) : [0, Math.max(0, data.length - 1)];
  };
  const [range, setRange] = useState<IndexRange>(() => presetWindow(defaultRange));
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new series resets the window.
  useEffect(() => setRange(presetWindow(defaultRange)), [data.length]);
  const from = Math.min(range[0], Math.max(0, data.length - 1));
  const to = Math.min(range[1], Math.max(0, data.length - 1));

  const lines = useMemo(() => overlayLines(data, overlays, from), [data, overlays, from]);
  const middles = useMemo(() => {
    const out = new Map<string, IndicatorSeries>();
    overlays.forEach((overlay, i) => {
      if (overlay.type === "bollinger")
        out.set(overlayId(overlay, i), bollingerMiddle(data, overlay));
    });
    return out;
  }, [data, overlays]);
  const oscillatorData = useMemo(
    () => (oscillator ? oscillatorModel(data, oscillator) : null),
    [data, oscillator],
  );
  const coloredComparisons = useMemo(
    () =>
      comparisons.map((comparison, i) => ({
        ...comparison,
        color: comparison.color ?? seriesColor(overlays.length + i + 1),
      })),
    [comparisons, overlays.length],
  );
  const visibleComparisons = coloredComparisons.filter((c) => !series.isHidden(c.id));
  const visibleLines = lines.filter((line) => !series.isHidden(line.id));
  const percent = visibleComparisons.length > 0;
  const showVolume = volume ?? data.some((bar) => bar.volume != null);

  // Room for the right axis: the widest label of the visible values, or a signed percent.
  const axisRoom = useMemo(() => {
    const top = Math.max(0, ...data.map((bar) => bar.high));
    const widest = percent
      ? estimateTextWidth("+100.0%")
      : Math.max(
          estimateTextWidth(fmt(top)),
          estimateTextWidth(resolveAxisFormat(valueFormat)(top)),
        );
    return Math.round(Math.max(44, widest + 18));
  }, [data, fmt, valueFormat, percent]);

  const navExtra = navigator ? NAVIGATOR_HEIGHT + NAVIGATOR_GAP : 0;
  const [chosen, setChosen] = useState<string | undefined>(defaultRange);
  const matches = (preset: TimeRangePreset) => {
    const [a, b] = rangeWindow(dates, preset);
    return a === from && b === to;
  };
  // Several presets can cover the same window (1A and Todo on short data): the clicked one wins.
  const chosenPreset = ranges.find((preset) => preset.id === chosen);
  const activePreset =
    chosenPreset && matches(chosenPreset) ? chosenPreset : ranges.find((preset) => matches(preset));

  const legendItems: LegendItem[] = [
    ...(percent
      ? [
          {
            id: "price",
            name: name ?? texts.price,
            color: "var(--accent-word)",
            shape: "line" as const,
          },
        ]
      : []),
    ...lines.map((line) => ({
      id: line.id,
      name: line.name,
      color: line.color,
      shape: "line" as const,
      hidden: series.isHidden(line.id),
    })),
    ...coloredComparisons.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      shape: "line" as const,
      hidden: series.isHidden(c.id),
    })),
  ];

  const header =
    toolbar || (legend && legendItems.length > 0) ? (
      <div className="flex flex-col gap-1.5">
        {toolbar ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {ranges.length ? (
              <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-0.5 rounded-pill border-0 bg-surface-2 p-0.5">
                <legend className="sr-only">{texts.ranges}</legend>
                {ranges.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={activePreset?.id === preset.id}
                    aria-label={preset.description ?? preset.label}
                    onClick={() => {
                      setChosen(preset.id);
                      setRange(rangeWindow(dates, preset));
                    }}
                    className={cn(
                      "cursor-pointer rounded-pill px-2 py-1 font-semibold text-[11.5px] tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-accent-ink @md/chart:px-2.5",
                      activePreset?.id === preset.id
                        ? "bg-surface text-ink shadow-xs"
                        : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </fieldset>
            ) : null}
            {seriesTypes.length > 1 ? (
              <fieldset
                disabled={percent}
                className="m-0 flex items-center gap-0.5 rounded-pill border-0 bg-surface-2 p-0.5 disabled:opacity-50"
              >
                <legend className="sr-only">{texts.seriesTypes}</legend>
                {seriesTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={seriesType === type}
                    aria-label={texts.seriesTypeNames[type]}
                    title={texts.seriesTypeNames[type]}
                    onClick={() => setSeriesType(type)}
                    className={cn(
                      "grid h-6 w-7 cursor-pointer place-items-center rounded-pill outline-none focus-visible:outline-2 focus-visible:outline-accent-ink disabled:cursor-default",
                      seriesType === type
                        ? "bg-surface text-ink shadow-xs"
                        : "text-ink-3 hover:text-ink",
                    )}
                  >
                    <SeriesTypeIcon type={type} />
                  </button>
                ))}
              </fieldset>
            ) : null}
          </div>
        ) : null}
        {legend && legendItems.length > 0 ? (
          <ChartLegend
            items={legendItems}
            onToggle={(id) => {
              if (id !== "price") series.toggle(id);
            }}
          />
        ) : null}
      </div>
    ) : null;

  return (
    <ChartFrame
      height={height === "fill" ? "fill" : height + navExtra}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={data.length === 0}
      skeleton="bars"
      legend={header}
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((bar) => fullCategoryLabel(bar.date))}
          columns={[
            { id: "open", name: texts.open, values: data.map((bar) => fmt(bar.open)) },
            { id: "high", name: texts.high, values: data.map((bar) => fmt(bar.high)) },
            { id: "low", name: texts.low, values: data.map((bar) => fmt(bar.low)) },
            { id: "close", name: texts.close, values: data.map((bar) => fmt(bar.close)) },
            ...(showVolume
              ? [
                  {
                    id: "volume",
                    name: texts.volume,
                    values: data.map((bar) => (bar.volume == null ? "" : vfmt(bar.volume))),
                  },
                ]
              : []),
            ...(flags.length
              ? [
                  {
                    id: "events",
                    name: texts.events,
                    values: data.map((bar) =>
                      flags
                        .filter((flag) => sameDay(flag.date, bar.date))
                        .map((flag) => flag.text)
                        .join("; "),
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      {(width, measured) => (
        <StockPlot
          width={width}
          height={measured - navExtra}
          title={title}
          data={data}
          range={[from, to]}
          onRangeChange={setRange}
          seriesType={seriesType}
          showVolume={showVolume}
          overlays={visibleLines}
          middles={middles}
          comparisons={visibleComparisons}
          oscillator={oscillatorData}
          flags={flags}
          lastPrice={lastPrice}
          navigator={navigator}
          fmt={fmt}
          vfmt={vfmt}
          valueFormat={valueFormat}
          axisRoom={axisRoom}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          texts={{ ...texts, price: name ?? texts.price }}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

function SeriesTypeIcon({ type }: { type: StockSeriesType }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
  };
  if (type === "candle") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M4 1.5v11M10 1.5v11" />
        <rect x="2.5" y="4" width="3" height="5" rx="0.75" fill="currentColor" />
        <rect x="8.5" y="3" width="3" height="6" rx="0.75" />
      </svg>
    );
  }
  if (type === "ohlc") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M4.5 2v10M2.5 5h2M4.5 9h2M10 2v10M8 8h2M10 4h2" />
      </svg>
    );
  }
  if (type === "line") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M1.5 10.5 5 6l3 2.5 4.5-6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" {...common}>
      <path
        d="M1.5 12.5V10L5 6l3 2.5 4.5-6v10z"
        fill="currentColor"
        fillOpacity="0.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
