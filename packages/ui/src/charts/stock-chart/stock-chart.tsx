"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import type { StockDrawing, StockTool } from "./stock-drawings.js";
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
import {
  NAVIGATOR_GAP,
  NAVIGATOR_HEIGHT,
  StockPlot,
  type StockPlotType,
  type StockTexts,
} from "./stock-plot.js";
import { heikinAshi, renko } from "./stock-transforms.js";

export type {
  Measurement,
  StockAnchor,
  StockDrawing,
  StockTool,
} from "./stock-drawings.js";
export { DEFAULT_STOCK_TOOLS, fibLevels, measureRange } from "./stock-drawings.js";
export type {
  StockBar,
  StockComparison,
  StockFlag,
  StockOscillator,
  StockOverlay,
  StockSeriesType,
} from "./stock-model.js";
export type { StockTexts } from "./stock-plot.js";
export type {
  StockDrawdown,
  StockExtreme,
  StockStats,
} from "./stock-stats.js";
export { appendBars, stockStats } from "./stock-stats.js";
export { averageTrueRange, defaultBrickSize, heikinAshi, renko } from "./stock-transforms.js";
export { useStockStream } from "./use-stock-stream.js";

/** `StockTexts` where the per-type and per-tool names can be partial. */
export type StockTextsInput = Partial<Omit<StockTexts, "seriesTypeNames" | "toolNames">> & {
  seriesTypeNames?: Partial<StockTexts["seriesTypeNames"]>;
  toolNames?: Partial<StockTexts["toolNames"]>;
};

/** The visible window, reported by `onWindowChange`. */
export interface StockWindow {
  /** Inclusive indexes into `data`. */
  from: number;
  to: number;
  start: Date;
  end: Date;
}

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
  seriesTypeNames: {
    candle: "Candles",
    ohlc: "OHLC",
    line: "Line",
    area: "Area",
    column: "Columns",
    "heikin-ashi": "Heikin-Ashi",
    renko: "Renko",
  },
  signal: "Signal",
  histogram: "Histogram",
  events: "Events",
  tools: "Drawing tools",
  toolNames: {
    cursor: "Select",
    trend: "Trend line",
    horizontal: "Horizontal line",
    range: "Range box",
    fib: "Fibonacci retracement",
    measure: "Measure",
  },
  deleteDrawing: "Delete selected drawing",
  bars: "bars",
  days: "d",
  drawingLayer: "Drawing area",
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

const SERIES_TYPES: readonly StockSeriesType[] = [
  "candle",
  "ohlc",
  "line",
  "area",
  "column",
  "heikin-ashi",
  "renko",
];

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
  /** Brick size of the Renko type; the ATR(14) of the data by default. */
  renkoBrickSize?: number;
  /** Tools of the drawing toolbar; none (default) hides it. `DEFAULT_STOCK_TOOLS` has them all. */
  drawingTools?: readonly StockTool[];
  /** Controlled drawings. Anchors are moments and prices, so they survive zoom and new data. */
  drawings?: readonly StockDrawing[];
  defaultDrawings?: readonly StockDrawing[];
  /** Called with the full list after a drawing is added or deleted: persist it here. */
  onDrawingsChange?: (drawings: StockDrawing[]) => void;
  /** Click (or Enter) on a bar pins its tooltip; pin several to compare days. */
  pinnable?: boolean;
  /** Times (ms) of the tooltips pinned at first. */
  defaultPinned?: readonly (Date | number)[];
  onPinnedChange?: (times: number[]) => void;
  /** Reports the visible window whenever it or the data changes. */
  onWindowChange?: (window: StockWindow) => void;
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
  texts?: StockTextsInput;
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
  data: rawData,
  title,
  description,
  seriesType: typeProp,
  defaultSeriesType = "candle",
  onSeriesTypeChange,
  seriesTypes = SERIES_TYPES,
  renkoBrickSize,
  drawingTools = [],
  drawings: drawingsProp,
  defaultDrawings = [],
  onDrawingsChange,
  pinnable = false,
  defaultPinned = [],
  onPinnedChange,
  onWindowChange,
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
  const texts: StockTexts = {
    ...DEFAULT_TEXTS,
    ...textOverrides,
    seriesTypeNames: { ...DEFAULT_TEXTS.seriesTypeNames, ...textOverrides?.seriesTypeNames },
    toolNames: { ...DEFAULT_TEXTS.toolNames, ...textOverrides?.toolNames },
  };
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const vfmt = useMemo(() => resolveFormat(volumeFormat), [volumeFormat]);
  const [typeState, setTypeState] = useState<StockSeriesType>(defaultSeriesType);
  const seriesType = typeProp ?? typeState;
  const setSeriesType = (next: StockSeriesType) => {
    if (typeProp == null) setTypeState(next);
    onSeriesTypeChange?.(next);
  };
  const series = useSeriesState();

  const coloredComparisons = useMemo(
    () =>
      comparisons.map((comparison, i) => ({
        ...comparison,
        color: comparison.color ?? seriesColor(overlays.length + i + 1),
      })),
    [comparisons, overlays.length],
  );
  const visibleComparisons = coloredComparisons.filter((c) => !series.isHidden(c.id));
  const percent = visibleComparisons.length > 0;

  // Heikin-Ashi and Renko are the same chart over transformed bars. Comparisons need the raw
  // dates, so % mode keeps the raw bars.
  const data = useMemo(() => {
    if (percent) return rawData;
    if (seriesType === "heikin-ashi") return heikinAshi(rawData);
    if (seriesType === "renko") return renko(rawData, renkoBrickSize);
    return rawData;
  }, [rawData, seriesType, percent, renkoBrickSize]);
  const plotType: StockPlotType =
    seriesType === "heikin-ashi" || seriesType === "renko" ? "candle" : seriesType;
  const dataKind = `${percent ? "raw" : seriesType}:${renkoBrickSize ?? ""}`;

  const dates = useMemo(() => data.map((bar) => bar.date), [data]);
  const presetWindow = (id: string | undefined): IndexRange => {
    const preset = ranges.find((item) => item.id === id);
    return preset ? rangeWindow(dates, preset) : [0, Math.max(0, data.length - 1)];
  };
  const [range, setRange] = useState<IndexRange>(() => presetWindow(defaultRange));
  // Appended or trimmed bars (a live stream) keep the window, and a window at the tail follows
  // the new bars; any other change of the series resets it to the default range.
  const previous = useRef({
    last: data.length - 1,
    lastTime: +(data[data.length - 1]?.date ?? 0),
    kind: dataKind,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new series runs this.
  useEffect(() => {
    const before = previous.current;
    const lastIndex = data.length - 1;
    previous.current = { last: lastIndex, lastTime: +(data[lastIndex]?.date ?? 0), kind: dataKind };
    if (before.kind !== dataKind || before.last < 0) {
      setRange(presetWindow(defaultRange));
      return;
    }
    let anchor = -1;
    for (let i = lastIndex; i >= 0 && anchor < 0; i -= 1) {
      if (+(data[i] as StockBar).date === before.lastTime) anchor = i;
    }
    if (anchor < 0) {
      setRange(presetWindow(defaultRange));
      return;
    }
    const shift = anchor - before.last;
    if (shift === 0 && lastIndex === anchor) return;
    setRange(([a, b]) => [
      Math.max(0, a + shift),
      b >= before.last ? lastIndex : Math.max(0, b + shift),
    ]);
  }, [data]);
  const from = Math.min(range[0], Math.max(0, data.length - 1));
  const to = Math.min(range[1], Math.max(0, data.length - 1));

  const window_ = useMemo(
    () => ({
      from,
      to,
      start: (data[from]?.date ?? new Date(0)) as Date,
      end: (data[to]?.date ?? new Date(0)) as Date,
    }),
    [data, from, to],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: report when the window changes.
  useEffect(() => {
    if (data.length) onWindowChange?.(window_);
  }, [window_]);

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
  const visibleLines = lines.filter((line) => !series.isHidden(line.id));
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

  const tools = percent ? [] : drawingTools;
  const [tool, setTool] = useState<StockTool>("cursor");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingState, setDrawingState] = useState<readonly StockDrawing[]>(defaultDrawings);
  const drawings = drawingsProp ?? drawingState;
  const commitDrawings = (next: StockDrawing[]) => {
    if (drawingsProp == null) setDrawingState(next);
    onDrawingsChange?.(next);
  };
  const [pinned, setPinned] = useState<number[]>(() => defaultPinned.map((time) => +time));
  const togglePin = (time: number) => {
    const next = pinned.includes(time) ? pinned.filter((t) => t !== time) : [...pinned, time];
    setPinned(next);
    onPinnedChange?.(next);
  };

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
              <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-0.5 rounded-button border-0 bg-surface-2 p-0.5">
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
                      "cursor-pointer rounded-button px-2 py-1 font-semibold text-[11.5px] tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-accent-ink @md/chart:px-2.5",
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
                className="m-0 flex items-center gap-0.5 rounded-button border-0 bg-surface-2 p-0.5 disabled:opacity-50"
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
                      "grid h-6 w-7 cursor-pointer place-items-center rounded-button outline-none focus-visible:outline-2 focus-visible:outline-accent-ink disabled:cursor-default",
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
        {toolbar && tools.length > 0 ? (
          <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-0.5 self-start rounded-button border-0 bg-surface-2 p-0.5">
            <legend className="sr-only">{texts.tools}</legend>
            {tools.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={tool === item}
                aria-label={texts.toolNames[item]}
                title={texts.toolNames[item]}
                onClick={() => setTool(item)}
                className={cn(
                  "grid h-6 w-7 cursor-pointer place-items-center rounded-button outline-none focus-visible:outline-2 focus-visible:outline-accent-ink",
                  tool === item ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
                )}
              >
                <ToolIcon tool={item} />
              </button>
            ))}
            <button
              type="button"
              disabled={selectedId == null}
              aria-label={texts.deleteDrawing}
              title={texts.deleteDrawing}
              onClick={() => {
                if (selectedId == null) return;
                commitDrawings(drawings.filter((d) => d.id !== selectedId));
                setSelectedId(null);
              }}
              className="grid h-6 w-7 cursor-pointer place-items-center rounded-button text-ink-3 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink disabled:cursor-default disabled:opacity-40"
            >
              <ToolIcon tool="delete" />
            </button>
          </fieldset>
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
          categories={rawData.map((bar) => fullCategoryLabel(bar.date))}
          columns={[
            { id: "open", name: texts.open, values: rawData.map((bar) => fmt(bar.open)) },
            { id: "high", name: texts.high, values: rawData.map((bar) => fmt(bar.high)) },
            { id: "low", name: texts.low, values: rawData.map((bar) => fmt(bar.low)) },
            { id: "close", name: texts.close, values: rawData.map((bar) => fmt(bar.close)) },
            ...(showVolume
              ? [
                  {
                    id: "volume",
                    name: texts.volume,
                    values: rawData.map((bar) => (bar.volume == null ? "" : vfmt(bar.volume))),
                  },
                ]
              : []),
            ...(flags.length
              ? [
                  {
                    id: "events",
                    name: texts.events,
                    values: rawData.map((bar) =>
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
          seriesType={plotType}
          showVolume={showVolume}
          tool={tools.includes(tool) ? tool : "cursor"}
          onToolChange={setTool}
          drawings={tools.length ? drawings : []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={(drawing) => commitDrawings([...drawings, drawing])}
          onDelete={(id) => {
            commitDrawings(drawings.filter((d) => d.id !== id));
            setSelectedId(null);
          }}
          pins={pinned}
          pinnable={pinnable && !percent}
          onTogglePin={togglePin}
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
  if (type === "column") {
    return (
      <svg aria-hidden="true" {...common}>
        <rect x="2" y="7" width="2.5" height="5" rx="0.5" fill="currentColor" />
        <rect x="5.75" y="3" width="2.5" height="9" rx="0.5" fill="currentColor" />
        <rect x="9.5" y="5.5" width="2.5" height="6.5" rx="0.5" fill="currentColor" />
      </svg>
    );
  }
  if (type === "heikin-ashi") {
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M3.5 2.5v9M7 3.5v8M10.5 2v9" />
        <rect x="2" y="4.5" width="3" height="4" rx="0.75" fill="currentColor" />
        <rect x="5.5" y="5" width="3" height="4.5" rx="0.75" fill="currentColor" />
        <rect x="9" y="3.5" width="3" height="5" rx="0.75" />
      </svg>
    );
  }
  if (type === "renko") {
    return (
      <svg aria-hidden="true" {...common}>
        <rect x="1.5" y="8" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
        <rect x="5.25" y="4.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
        <rect x="9" y="6" width="3.5" height="3.5" rx="0.5" />
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

function ToolIcon({ tool }: { tool: StockTool | "delete" }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<StockTool | "delete", ReactNode> = {
    cursor: <path d="M3 2l7 4.5-3 .8-1.2 3z" />,
    trend: (
      <>
        <path d="M2.5 11l9-8" />
        <circle cx="2.5" cy="11" r="1" fill="currentColor" />
        <circle cx="11.5" cy="3" r="1" fill="currentColor" />
      </>
    ),
    horizontal: <path d="M1.5 7h11M4 5v4" strokeDasharray="0.1 0" />,
    range: <rect x="2.5" y="3.5" width="9" height="7" rx="1" strokeDasharray="2 1.5" />,
    fib: <path d="M2 2.5h10M2 5.5h10M2 8h10M2 11.5h10" strokeDasharray="1.5 1.5" />,
    measure: <path d="M2 10.5l9.5-7M4.5 9l1 1.5M7 7.2l1 1.5M9.4 5.4l1 1.5" />,
    delete: <path d="M3.5 4.5h7M5.5 4.5V3h3v1.5M4.5 4.5l.5 7h4l.5-7" />,
  };
  return (
    <svg aria-hidden="true" {...common}>
      {paths[tool]}
    </svg>
  );
}
