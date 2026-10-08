# Charts

Our own chart library: pure React + SVG, zero runtime dependencies, themed only through tokens.

```tsx
import { BarChart, LineChart } from "@jcsoftdev/ui/charts";
import { Sparkline } from "@jcsoftdev/ui/charts/sparkline"; // single entry, tree-shakes
```

| Chart | Folder | Built on |
| --- | --- | --- |
| `LineChart` | `line-chart/` | `CartesianChart` (series `kind: "line"`) |
| `AreaChart` | `area-chart/` | `CartesianChart` (`kind: "area"`) |
| `BarChart` | `bar-chart/` | `CartesianChart` (`kind: "column"`) |
| `ComboChart` | `combo-chart/` | `CartesianChart` (mixed kinds, right axis) |
| `Sparkline` | `sparkline/` | scales + paths directly (no frame) |
| `BoxPlot` | `box-plot/` | `distribution/` (`categoryLayout`, `BoxGlyph`) |
| `ViolinChart` | `violin-chart/` | `distribution/` (`gaussianKde`, `violinPath`) |
| `RaincloudChart` | `raincloud-chart/` | `distribution/` (half violin + `BoxGlyph` + jittered rain) |
| `Histogram` | `histogram/` | `distribution/` (`binEdges`, `binCounts`, `xyLayout`) |
| `BeeswarmChart` | `beeswarm-chart/` | `distribution/` (`beeswarm` collision layout) |
| `ScatterChart` | `scatter-chart/` | `XYPointChart` (trend lines, quadrants) |
| `BubbleChart` | `bubble-chart/` | `XYPointChart` (`sized`, area-proportional radius) |

Everything else lives in `core/` (exported as `@jcsoftdev/ui/charts/core` and re-exported from `@jcsoftdev/ui/charts`).
Polar and other chart families should be built from these blocks; see "Building a new chart" below.

## Data model

```ts
type XValue = string | number | Date;

interface ChartSeries {
  id: string;                       // stable key, legend toggling
  name: string;                     // legend, tooltip, data table
  data: ReadonlyArray<number | null>; // one value per category, null = gap
  color?: string;                   // CSS color; defaults to the palette slot
  dashed?: boolean;
  format?: ValueFormat;             // overrides the chart valueFormat
}
```

Cartesian charts take `categories: XValue[]` plus `series`. When every category is a `Date` and no series is a
column, the x axis becomes a real time scale (`xScale="auto"`); force it with `xScale="band" | "time"`.

## Core modules

| Module | What it gives you |
| --- | --- |
| `scales/linear.ts` | `linearScale`, `niceDomain`, `linearTicks`, `tickStep`, `extent`. All scales share `ContinuousScale { domain, range, map, invert, ticks }`. |
| `scales/log.ts` | `logScale` (base 10, whole decades). |
| `scales/band.ts` | `bandScale`, `pointScale`: index based (`start(i)`, `center(i)`, `indexAt(px)`, `bandwidth`, `step`). |
| `scales/time.ts` | `timeScale`, `timeTicks` (day / week-on-Monday / month / year, es-PE labels such as "lun 28", "6 oct", "jul 2026"), `formatDate` ("mar 6 oct 2026"), `shortMonth`, `shortWeekday`. |
| `format.ts` | `formatNumber` ("12 345.68"), `formatCurrency` ("S/ 1 234.50"), `formatPercent` ("12.5%"), `formatCompact` ("1,2 mil"), `resolveFormat(ValueFormat)`, `resolveAxisFormat` (shorter tick labels). Groups use a no-break space. |
| `path.ts` | `linePath`, `areaPath` (variable baseline), `curveCommands` (`"linear" \| "smooth"` = monotone cubic, never overshoots), `monotoneTangents`, `roundedRectPath`, `barPath` (rounded at the value end only), `segments`. |
| `stack.ts` | `stackLayers(series, "normal" \| "percent")`: positives up, negatives down, percent normalised to 0-1. |
| `palette.ts` | `CHART_PALETTE`, `seriesColor(i, override?)`, `TONE_COLORS` (neutral/accent/danger/warning/success ink + soft). |
| `use-chart-size.ts` | `useChartWidth()` (ResizeObserver, SSR fallback width 640), `useIsomorphicLayoutEffect`. |
| `motion.ts` | `useReducedMotion`, `useEntryAnimation(ref, play, { disabled, replayKey })`, `revealClip`, `fadeIn`, `EASE_OUT`. Web Animations API, skipped under `prefers-reduced-motion`. |
| `use-series-state.ts` | `useSeriesState(initialHidden)`: hidden set, legend highlight, `toggle`. |
| `chart-frame.tsx` | `ChartFrame`: measures width, swaps in loading/empty states, places legend / drawing / footer / hidden table. Render prop `children(width)`. |
| `chart-states.tsx` | `ChartSkeleton` (`shape: "bars" \| "line" \| "ring"`), `ChartEmpty`. |
| `legend.tsx` | `ChartLegend`: toggle buttons with `aria-pressed`, hover/focus highlight, swatch shapes `line \| dashed \| square \| dot`. The last visible series cannot be hidden. |
| `tooltip.tsx` | `ChartTooltip`: positioned card with rows (color, name, value, note, emphasis); flips past 60% of the width; moves with a transform. |
| `data-table.tsx` | `ChartDataTable`: visually hidden table for screen readers. |
| `axes.tsx` | `GridLines`, `AxisBottom`, `AxisLeft`, `AxisRight`, `thinTicks`, `estimateTextWidth`. |
| `types.ts` | `XValue`, `ChartSeries`, `ChartAnnotation`, `ValueAxisOptions`, `ChartLabels` + `DEFAULT_LABELS` + `resolveLabels`. |
| `distribution/` | Statistics and geometry for the distribution family; see below. |
| `cartesian/` | `CartesianChart` (the engine), `computeLayout` (pure geometry), `ChartBrush`, marks and annotations. |

## Theming

Colors only come from CSS variables, applied through `style` (`fill`, `stroke`, `stopColor`) so `var()` resolves; never
as SVG presentation attributes. Text uses Tailwind token utilities (`fill-ink-3`, `text-[11px]`).

- Series 1 is always `var(--accent-word)`, so it follows `data-accent`. Series 2-8 use `--chart-cat-1` ... `--chart-cat-7`.
- `--chart-grid` (gridlines, hover band, empty-state rules) and `--chart-crosshair` are chart-only tokens.
- All of them are defined in `tokens/default.json` with light and dark values; `pnpm build:styles` regenerates `styles/`.

## Interaction and accessibility contract

Every chart must keep these, so all families behave the same:

- The drawing is `<svg role="img" aria-label={title}>`, and a `ChartDataTable` with the same numbers is rendered (hidden).
- Visible strings are props (`labels: Partial<ChartLabels>`, English defaults); data formatting is es-PE.
- Keyboard: the plot overlay is a focusable `role="slider"` whose `aria-valuetext` reads the category and every series
  value. Arrows move, Home/End jump, Escape clears. The brush is its own slider (arrows pan, Shift+arrows resize).
- Pointer: one transparent overlay owns pointer events; hover state lives in the plot component and marks are
  `memo`ised with stable geometry from `computeLayout`, so hovering only re-renders the crosshair, markers and tooltip.
- Legend hover/focus dims the other series (`opacity` transition); click toggles them.
- Entry animation through `useEntryAnimation` (line reveal by a clip rect, bars grow from their baseline with a short
  stagger, labels fade). Nothing animates with `prefers-reduced-motion` or `animate={false}`.
- `loading` shows `ChartSkeleton`; no finite data shows `ChartEmpty`.

## Annotations (cartesian)

```ts
annotations={[
  { type: "line", axis: "y", value: 1500, label: "Meta diaria", tone: "success" },
  { type: "range", axis: "y", from: 0, to: 30, label: "Bajo", tone: "danger" },
  { type: "line", axis: "x", value: new Date(2026, 9, 8), label: "Feriado" },
  { type: "range", axis: "x", from: "jue", to: "vie", tone: "warning" },
]}
```

`axis: "y"` is the value axis (drawn vertical in horizontal bar charts), `axis: "x"` the category axis; x values match a
category (dates by time). `yAxis: "right"` measures against the secondary axis.

## Distribution family (`core/distribution/`)

```ts
interface DistributionSeries {          // BoxPlot, ViolinChart, RaincloudChart
  id: string; name: string; color?: string; format?: ValueFormat;
  data: ReadonlyArray<ReadonlyArray<number | null>>; // data[i] = raw samples of categories[i]
}
// Histogram: { id, name, values: number[] }   Beeswarm: { id, name, points: { value, category?, size?, label? }[] }
// Scatter / Bubble: { id, name, points: { x, y, size?, label? }[] }
```

| Module | What it gives you |
| --- | --- |
| `stats.ts` | Pure, tested in `test/charts-distribution.test.mjs`: `quantileSorted` (type 7), `boxStats` (Tukey whiskers, outliers, mean), `standardDeviation`, `silvermanBandwidth`, `gaussianKde`, `normalPdf`, `sturgesBinCount`, `freedmanDiaconisWidth`, `binEdges` (nice widths), `binCounts`, `histogram`, `linearRegression` (slope, intercept, r²), `seededRandom` (stable jitter), `beeswarm` (collision-free offsets, closest free slot to the axis). |
| `layout.ts` | `categoryLayout` (category axis + value axis, vertical or horizontal, dodged `slot(category, series)`), `xyLayout` (two continuous axes, `inset` for radii), `nearestPoint`, `truncateLabel`, `tooltipFit`. |
| `marks.tsx` | `CategoryAxes`, `XYAxes`, `BoxGlyph` (`variant: "box" \| "inner"`), `boxTooltipRows`, `boxValueText`, `BoxStatsTable`. |
| `geometry.ts` | `violinPath` (full or half, either orientation), `toXY`. |
| `explorer.tsx` | `PlotExplorer`: the focusable `role="slider"` overlay (arrows, Home/End, PageUp/PageDown, Escape) plus pointer picking. |
| `use-legend.tsx` | `useDistributionLegend`: colors, toggling, highlight and the legend node. |
| `xy-points.tsx` | `XYPointChart`, the engine behind `ScatterChart` and `BubbleChart`. |
| `labels.ts` | `StatLabels` (median, Q1, mean, outliers, ...) merged with `ChartLabels`; pass Spanish through `labels`. |

Exploration order is the reading order: boxes/violins category by category, histogram bins left to right, beeswarm
points row by row, scatter points by x. The tooltip and `aria-valuetext` carry the same numbers.

## Responsive (container width)

Charts only know the width `ChartFrame` measures, never the viewport:

- Tick counts derive from the plot size; crowded category labels are thinned (`thinTicks`), long row labels are
  truncated (`truncateLabel`), and the right margin leaves room for the last tick label.
- Distribution charts give the frame `@container`; their top legend uses `order-last @md:order-none`, so it sits under
  the plot below 448 px. `tooltipFit(width)` flips the tooltip at the middle and caps it to `50cqw` under 480 px.
- Bubble labels outside the bubble, trend-line R² labels and quadrant captions hide or truncate when they do not fit.
- `ChartDataTable` wraps its table in an `sr-only` div: a table ignores `width: 1px`, so a wide one used to overflow.

## Building a new chart (polar, heatmap, candlestick, treemap, ...)

1. Create `src/charts/<name>/<name>.tsx`, `index.ts` and `<name>.stories.tsx`; add the folder to `src/charts/index.ts`.
2. Wrap the output in `ChartFrame` with `labels={resolveLabels(props.labels)}`, `loading`, `empty`, a `ChartLegend`
   fed by `useSeriesState`, and a `ChartDataTable`. Pick a skeleton shape (`"ring"` exists for polar charts).
3. Inside `children(width)`, render a separate plot component so `useMemo` can hold the geometry; keep hover state in
   that component and `memo` the marks.
4. Use `seriesColor(i)` for categorical colors (slices, cells legend) and `TONE_COLORS` for status colors; apply them via
   `style`. Use `resolveFormat` for values and `formatDate` for dates.
5. Geometry helpers: polar code can reuse `linearScale` for radius, `bandScale` for angular slots, and draw arcs with
   its own small `arcPath` next to `path.ts` (add it there so the next chart can share it).
6. Reuse `ChartTooltip` (pass container-relative `x`/`y`) and a focusable overlay with `role="slider"` +
   `aria-valuetext` for keyboard exploration.
7. Animate with `useEntryAnimation`; respect `animate={false}`.
8. Pure helpers get a case in `test/charts-core.test.mjs`.
