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
| `HeatmapChart`, `CalendarHeatmap` | `heatmap-chart/` | `color-scale.ts` + an internal `HeatmapGrid` |
| `TreemapChart` | `treemap-chart/` | `hierarchy.ts` (`treemapLayout`, squarified) + `hierarchy-chart.tsx` |
| `SunburstChart` | `sunburst-chart/` | `hierarchy.ts` (`partitionLayout`, `sectorPath`) + `use-drill.ts` |
| `IcicleChart` | `icicle-chart/` | same partition as the sunburst, rectangular |

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
| `tooltip.tsx` | `ChartTooltip`: positioned card with rows (color, name, value, note, emphasis); measures itself and stays inside the container (prefers the left side past 60%, clamps to the edges when neither side fits); moves with a transform. `tooltipLeft` is the pure placement. |
| `data-table.tsx` | `ChartDataTable`: visually hidden table for screen readers. |
| `axes.tsx` | `GridLines`, `AxisBottom`, `AxisLeft`, `AxisRight`, `thinTicks`, `estimateTextWidth`. |
| `types.ts` | `XValue`, `ChartSeries`, `ChartAnnotation`, `ValueAxisOptions`, `ChartLabels` + `DEFAULT_LABELS` + `resolveLabels`. |
| `color-scale.ts` | Token-only color scales as `color-mix()`: `tint(color, %)`, `inkOn(%)` (readable text on a tint), `sequentialColor`, `divergingColor`, `ColorRange` + `rangeIndex` / `rangeColor` (stepped, `tone` aware), `scaleGradient` for legend bars. |
| `hierarchy.ts` | `buildHierarchy` (sums, drops empty branches, sorts, `branch` index), `ancestors`, `descendants`, `findNode`, `heightOf`; `squarify` and nested `treemapLayout`; `partitionLayout` (spans 0-1), `PartitionView` + `projectSpan` + `interpolateView` (zoom window), `sectorPath` (annular sector, 0 at twelve o'clock). |
| `use-drill.ts` | `useDrill(data)`: hierarchy + focused node + `drill(id)` / `up()`; `useAnimatedView(view)`: rAF zoom transition, instant under reduced motion. |
| `hierarchy-chart.tsx` | Shared pieces of the hierarchy charts: `HierarchyLabels` (+ `breadcrumb`, `share`, `drillHint`), `branchColor`, `levelStrength`, `HierarchyHeader` (breadcrumb), `HierarchyLegend`, `HierarchyTable`, `hierarchyKey` (keyboard model), `HIERARCHY_FRAME_CLASS`. |
| `breadcrumb.tsx` | `ChartBreadcrumb`: drill path, ancestors are buttons, current item has `aria-current`. |
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

## Hierarchy and matrix charts

```tsx
<TreemapChart title="Ventas por categoría" data={{ name: "Octubre", children: [...] }} valueFormat="currency" />
<SunburstChart title="Servicios" data={tree} levels={3} />
<IcicleChart title="Ingresos" data={tree} orientation="vertical" />
<HeatmapChart title="Ocupación" rows={days} columns={hours} values={matrix} scale="diverging" />
<CalendarHeatmap title="Citas por día" days={[{ date, value }]} ranges={[{ to: 5, label: "0-4" }]} />
```

- Data is a `HierarchyDatum` tree (`name`, `value` on leaves, optional `color`, `children`).
- Keyboard: arrows move between the children of the open node, Enter opens one, Escape goes up
  (heatmaps: arrows move by row/column, Enter calls `onCellClick`, Escape clears).
- Drill-down keeps a breadcrumb; sunburst and icicle animate the zoom window with `useAnimatedView`.
- Colors: each top-level branch of the open node takes a palette slot; depth and sibling rank vary the
  tint. Heatmaps use `color-scale.ts`, so they follow the theme and `data-accent`.

## Responsive (container width)

Charts receive the measured width of their container from `ChartFrame`, never the viewport. The hierarchy
and heatmap charts make the frame a size container (`@container/chart`) so the HTML around the drawing
reacts with container variants: the legend sits below the drawing in narrow containers and moves above it
from `@md/chart`. Inside the SVG: labels only render where they fit, column labels thin out, the sunburst and
icicle drop outer levels before they get too thin, the calendar keeps only the most recent weeks that fit,
and the tooltip never leaves the frame. Every chart has a `Narrow` story at 320 px.

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
8. Pure helpers get a case in `test/charts-core.test.mjs` (hierarchy and matrix layouts: `test/charts-hierarchy.test.mjs`).
