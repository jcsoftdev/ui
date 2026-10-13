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
| `BarChart` | `bar-chart/` | `CartesianChart` (`kind: "column"`): ranges, stack groups, patterns, reversed axis, group labels |
| `DrilldownBarChart` | `bar-chart/` | `BarChart` + `useDrill` + `ChartBreadcrumb` |
| `BarRaceChart` | `bar-chart/` | `bar-race.ts` rank interpolation, play / pause / scrub |
| `LollipopChart` | `lollipop-chart/` | stick + dot per category, horizontal or vertical, negatives |
| `BulletChart` | `bullet-chart/` | `bullet-layout.ts` bands, actual bar, target tick, per-row or shared scale |
| `ComboChart` | `combo-chart/` | `CartesianChart` (mixed kinds, right axis) |
| `DonutChart` / `PieChart` | `donut-chart/`, `pie-chart/` | `ChartFrame` + `polar.ts` (rounded arcs, gaps, explode, outside labels, semi variant) |
| `RadialBarChart` | `radial-bar-chart/` | stroked `arcLine` rings, track, gradient, ring labels |
| `GaugeChart` | `gauge-chart/` | `arcLine` bands + progress or needle, `useAnimatedNumber` |
| `RadarChart` | `radar-chart/` | polygon/circle grid, angular hit-testing with `slotAt` |
| `PolarAreaChart` | `polar-area-chart/` | `arcPath` sectors, radius or area scale |
| `FunnelChart` | `funnel-chart/` | `funnelStages` geometry (funnel / pyramid, vertical / horizontal) |
| `Sparkline` | `sparkline/` | scales + paths directly (no frame) |
| `RangeAreaChart` | `range-area-chart/` | `ChartFrame` + `buildCategoryAxis`: min-max bands with an average line |
| `StreamGraph` | `stream-graph/` | `streamLayout` (wiggle / silhouette / zero / expand offsets), hover a stream to isolate it |
| `WaterfallChart` | `waterfall-chart/` | `waterfallLayout` running totals, connectors, up/down/total tokens |
| `DumbbellChart` | `dumbbell-chart/` | two or more values per row, horizontal or vertical, sortable, change column |
| `TimelineChart` | `timeline-chart/` | Gantt rows, `assignLanes` stacks overlapping bars, now marker, clock ticks |
| `CandlestickChart` | `candlestick-chart/` | OHLC candles + volume panel + `ChartBrush` zoom |
| `StockChart` | `stock-chart/` | candle / OHLC / line / area, range presets (`time-range.ts`), `ChartBrush` navigator, `indicators.ts` overlays and RSI/MACD pane, % comparisons, flags |
| `GanttChart` | `gantt-chart/` | `gantt.ts` (zoom scale, two-tier header, rows with rollups, orthogonal dependency routes), task tree + timeline in one sticky scroller |
| `SlopeChart` | `slope-chart/` | two columns, `spreadSlopeLabels` collision avoidance on both sides |
| `HeatmapChart`, `CalendarHeatmap` | `heatmap-chart/` | `color-scale.ts` + an internal `HeatmapGrid` (`shape="hex"`, `renderer="canvas"`, `Date` columns) |
| `DrilldownHeatmap` | `heatmap-chart/` | `HeatmapChart` + `ChartBreadcrumb`; each `HeatmapLevel` returns the matrix behind a cell |
| `ChartGrid` | `chart-grid/` | small multiples (trellis): shared value/x domains, shared legend, columns from the container width |
| `TreemapChart` | `treemap-chart/` | `hierarchy.ts` (`treemapLayout`, squarified) + `hierarchy-chart.tsx` |
| `SunburstChart` | `sunburst-chart/` | `hierarchy.ts` (`partitionLayout`, `sectorPath`) + `use-drill.ts`; `half` for a 180 degree fan |
| `HierarchyMorph` | `hierarchy-morph/` | treemap and sunburst layouts sampled as polygons (`shape-morph.ts`) and blended |
| `IcicleChart` | `icicle-chart/` | same partition as the sunburst, rectangular |
| `BoxPlot` | `box-plot/` | `distribution/` (`categoryLayout`, `BoxGlyph`) |
| `ViolinChart` | `violin-chart/` | `distribution/` (`gaussianKde`, `violinPath`) |
| `RaincloudChart` | `raincloud-chart/` | `distribution/` (half violin + `BoxGlyph` + jittered rain) |
| `Histogram` | `histogram/` | `distribution/` (`binEdges`, `binCounts`, `xyLayout`) |
| `BeeswarmChart` | `beeswarm-chart/` | `distribution/` (`beeswarm` collision layout) |
| `ScatterChart` | `scatter-chart/` | `XYPointChart` (trend lines, quadrants, time axis, jitter, image markers, canvas renderer) |
| `BubbleChart` | `bubble-chart/` | `XYPointChart` (`sized`, area-proportional radius, `shading="shaded"` spheres) |
| `ChoroplethMap` | `choropleth-map/` | `maps/geo/` (`MapViewport`, `useMapGeometry`, `useMapView`) + `heatmapScale` (sequential / diverging / thresholds) |
| `BubbleMap` | `bubble-map/` | same stage + `clusterPoints`; bubbles and clusters are drawn in screen space |
| `HexTileMap` | `hex-tile-map/` | own SVG grid (`hex-layout.ts`) + `heatmapScale`, `MapLegend`; no geometry needed |
| `PictogramChart` | `pictogram-chart/` | unit charts core (`units.ts`, `UnitGlyph`, `useCategoryExplorer`) |
| `WaffleChart` | `waffle-chart/` | unit charts core (`waffleCounts`, `gridCell`) |
| `ParliamentChart` | `parliament-chart/` | unit charts core (`parliamentLayout`) |
| `FillGaugeChart` | `fill-gauge-chart/` | `UNIT_ICONS` shapes as clip paths |
| `IsotypeRows` | `isotype-rows/` | unit charts core (`unitFractions`, `UnitGlyph`) |
| `ProgressUnits` | `progress-units/` | unit charts core (`progressFractions`, `UnitGlyph`) |
| `TreeChart` | `tree-chart/` | `tree-layout.ts` (tidy tree, 4 directions, edge paths), `tree-radial.ts` (radial, dendrogram) + `use-pan-zoom.ts`; HTML card templates, search, lazy children |
| `ChordChart` | `chord-chart/` | `chord.ts` (groups, ribbons) + `polar.ts` `arcPath`, `useIndexNavigation`, export buttons |
| `AlluvialChart` | `sankey-chart/` | `SankeyChart` with fixed stage columns (`alluvialGraph`) |
| `SankeyChart` | `sankey-chart/` | `sankey.ts` (columns by longest path, relaxation, link ordering, cycle breaking) |

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
| `use-chart-size.ts` | `useChartSize()` / `useChartWidth()` (ResizeObserver, SSR fallback 640 x 300), `resolveDrawingHeight`, `useIsomorphicLayoutEffect`. |
| `motion.ts` | `useReducedMotion`, `useEntryAnimation(ref, play, { disabled, replayKey })`, `revealClip`, `fadeIn`, `EASE_OUT`. Web Animations API, skipped under `prefers-reduced-motion`. |
| `polar.ts` | Angles are radians, 0 at 12 o'clock, clockwise. `polarPoint`, `angleOf`, `normalizeAngle`, `slotAt` (equal slots), `sliceAngles` (proportional slices with a gap), `arcPath` (annular sector, rounded corners clamped to fit), `arcLine` (stroked centre-line arc), `spreadLabels` (vertical label collision avoidance), `funnelStages` (stage geometry and conversion). Unit tested in `test/charts-polar.test.mjs`. |
| `use-index-navigation.ts` | `useIndexNavigation(count, { wrap })`: hover and keyboard (arrows, Home/End, Escape) share one `active` index, plus the pointer position for the tooltip. Spread `sliderProps` on a `role="slider"` overlay (`pointer-events-none` is fine for polar charts). |
| `a11y.ts` | `DECORATIVE` (`aria-hidden`) spread for visual-only SVG text and groups. |
| `motion.ts` (extra) | `useAnimatedNumber(target, { from, duration, disabled })` eases a displayed value; instant under reduced motion. |
| `use-series-state.ts` | `useSeriesState(initialHidden)`: hidden set, legend highlight, `toggle`. |
| `chart-frame.tsx` | `ChartFrame`: measures its slot (width and, with `height="fill"`, height), swaps in loading/empty states, places legend / drawing / footer / hidden table (`legendAside` for polar). Render prop `children(width, height)`. |
| `chart-states.tsx` | `ChartSkeleton` (`shape: "bars" \| "line" \| "ring"`), `ChartEmpty`. |
| `legend.tsx` | `ChartLegend`: toggle buttons with `aria-pressed`, hover/focus highlight, swatch shapes `line \| dashed \| square \| dot`. The last visible series cannot be hidden. |
| `tooltip.tsx` | `ChartTooltip`: positioned card with rows (color, name, value, note, emphasis); measures itself and stays inside the container (prefers the left side past 60%, clamps to the edges when neither side fits); moves with a transform. `tooltipLeft` is the pure placement. |
| `data-table.tsx` | `ChartDataTable`: visually hidden table for screen readers. |
| `axes.tsx` | `GridLines`, `AxisBottom`, `AxisLeft`, `AxisRight`, `thinTicks`, `estimateTextWidth`. |
| `category-axis.ts` | `buildCategoryAxis(categories, width, { mode: "point" \| "band" \| "time" })`: positions, ticks, `indexAt`, bandwidth for charts that share a horizontal category/time axis (range area, stream, candlestick). |
| `plot-overlay.tsx` | `PlotOverlay`: the focusable `role="slider"` layer + pointer hit-testing used by the non-cartesian charts. Props: `indexAt(pointer)`, `keys`, optional `onKey`. |
| `palette.ts` (direction) | `DIRECTION_COLORS` (`chart-up`, `chart-down`, `chart-total` tokens) and `directionOf(delta)`. |
| `types.ts` | `XValue`, `ChartSeries`, `ChartAnnotation`, `ValueAxisOptions`, `ChartLabels` + `DEFAULT_LABELS` + `resolveLabels`. |
| `color-scale.ts` | Token-only color scales as `color-mix()`: `tint(color, %)`, `inkOn(%)` (readable text on a tint), `sequentialColor`, `divergingColor`, `ColorRange` + `rangeIndex` / `rangeColor` (stepped, `tone` aware), `scaleGradient` for legend bars. |
| `hierarchy.ts` | `buildHierarchy` (sums, drops empty branches, sorts, `branch` index), `ancestors`, `descendants`, `findNode`, `heightOf`; `squarify` and nested `treemapLayout`; `partitionLayout` (spans 0-1), `PartitionView` + `projectSpan` + `interpolateView` (zoom window), `sectorPath` (annular sector, 0 at twelve o'clock). |
| `use-drill.ts` | `useDrill(data)`: hierarchy + focused node + `drill(id)` / `up()`; `useAnimatedView(view)`: rAF zoom transition, instant under reduced motion. |
| `hierarchy-chart.tsx` | Shared pieces of the hierarchy charts: `HierarchyLabels` (+ `breadcrumb`, `share`, `drillHint`), `branchColor`, `levelStrength`, `HierarchyHeader` (breadcrumb), `HierarchyLegend`, `HierarchyTable`, `hierarchyKey` (keyboard model), `HIERARCHY_FRAME_CLASS`. |
| `breadcrumb.tsx` | `ChartBreadcrumb`: drill path, ancestors are buttons, current item has `aria-current`. |
| `distribution/` | Statistics and geometry for the distribution family; see below. |
| `units.ts` | Pure unit geometry: `unitCount`/`unitFractions` (23 at 5 per icon = 4 icons + 0.6), `progressFractions` (4.5 of 5 stars), `largestRemainder`/`waffleCounts` (integer cells that add up), `gridCell`, `fitUnitGrid` (largest icons that fit a box), `parliamentRows`/`parliamentLayout` (hemicycle seats, left to right), `assignUnits`. |
| `shape-morph.ts` | `rectRing`, `sectorRing`, `blendRings`, `ringPath`, `ringCenter`: rectangles and annular sectors as polygons with the same point count, so any blend between them is a point-wise lerp. |
| `unit-icons.ts` | `UNIT_ICONS` (person, woman, child, heart, tree, house, car, star, drop, clock, pin, scissors, comb, mustache, pole, chair, calendar, bottle, battery, droplet, target, shield; 24 x 24 solid silhouettes), `PICTOGRAM_SILHOUETTES` and `BARBER_SILHOUETTES` (gallery order), `UnitIcon` (a name, a raw path or a `UnitShape` with its own box), `resolveUnitShape`, `UnitCategory`. |
| `unit-glyph.tsx` | `UnitGlyph` (one icon in a square cell, partial fill clipped, track behind), `popUnits` (staggered entry), `UNIT_FRAME_CLASS` / `UNIT_LEGEND_CLASS` (frame as `@container/units`, legend below under `@sm`). |
| `category-explorer.tsx` | `useCategoryExplorer` + `CategorySlider`: hover finds the category through `[data-category]`, a pointer-transparent `role="slider"` overlay moves between categories with the keyboard. |
| `indicators.ts` | Pure, aligned with the input (`null` while warming up), tested in `test/charts-gantt-stock.test.mjs`: `sma`, `ema` (seeded with the SMA, skips leading nulls), `bollinger` (population deviation), `vwap(bars, from)` (anchored), `rsi` (Wilder), `macd` (line, signal, histogram), `rebase` (% change from a base point). |
| `time-range.ts` | `TimeRangePreset` (`unit: "day" \| "week" \| "month" \| "year" \| "all"`, `count`), `rangeWindow(dates, preset)` (inclusive index window ending at the last date), `shiftDate` (months clamp to the month end). |
| `gantt.ts` | `GANTT_ZOOMS` (hour / day / week / month / quarter: px per day, header units, snap), `startOf` / `addUnits` (local calendar, weeks start Monday), `ganttDomain`, `ganttScale(domain, zoom, minWidth)` (stretches to fill the pane), `ganttHeader` / `headerCells`, `nonWorkingSpans(domain, workingDays, holidays)`, `snapTime`, `routeDependency` (finish-to-start, right angles, wraps back through the row gutter when the successor starts too early), `roundedPolyline`, `ganttRows(tasks, collapsed)` (depth-first rows, parents roll up dates and duration-weighted progress). Tested in `test/charts-gantt-stock.test.mjs`. |
| `tree-layout.ts` | Pure, tested in `test/charts-graph.test.mjs`: `treeLayout(root, { direction, siblingGap, levelGap })` (contour packing in the Reingold–Tilford / Walker family: parents centred over children, siblings packed from both ends and averaged so small subtrees spread evenly, one depth band per level), `treeEdgePath` (`curved` / `step` with rounded elbows / `straight`), `treePathToRoot`, `treeKeyMove` (arrow key to parent/child/sibling for each direction), `treeNeighbor`. |
| `sankey.ts` | Pure, tested in `test/charts-graph.test.mjs`: `sankeyLayout(nodes, links, { width, height, nodeWidth, nodePadding, iterations, align })` (columns by longest path, `justify` sinks, shared scale `ky`, relaxation sweeps with collision resolution, links ordered by the other end), `breakCycles` (weighted Eades–Lin–Smyth order; backward links are reported in `removed` with a reason), `sankeyLinkPath`, `sankeyFlowOf` (everything upstream and downstream of a node). |
| `tree-radial.ts` | `radialTreeLayout`, `dendrogramLayout`, `radialEdgePath`, `toPolar`: extra layouts returning the same `TreeLayout` (radial nodes carry `angle`, the layout a `center`). Tested in `test/graph-flow-parity.test.mjs`. |
| `export.ts` / `export-menu.tsx` | `serializeSvg(svg \| svg[])` clones the drawing(s), bakes computed paint (CSS variables, Tailwind classes) into inline style and stacks them vertically; `downloadSvg`, `downloadPng` (canvas, 2x), `exportFileName`, `stackLayout`; `ExportMenu` is the two-button group used by Gantt and Sankey. Browser only, no dependencies. |
| `chord.ts` | `chordLayout(matrix, { padAngle, startAngle, sortGroups, sortSubgroups })` (groups + chords), `ribbonPath`, `chordsOf`, `groupAt`. Angles follow `polar.ts`. |
| `sankey.ts` (extra) | `sankeyTraceOf(link)` (whole path through a link), `sankeyDiff(before, after)`, `alluvialGraph({ stages, categories, flows })`; layout options `relax: false` and per-node `column`. |
| `use-pan-zoom.ts` | `usePanZoom({ minZoom, maxZoom, wheel })`: drag to pan (capture starts after a few pixels so clicks still work), two-pointer pinch, wheel zoom with Ctrl/⌘ by default, `zoomBy`, `wasDrag()`; pure `zoomAround` and `fitView`. |
| `cartesian/` | `CartesianChart` (the engine), `computeLayout` (pure geometry), `ChartBrush`, marks and annotations. |

## Theming

Colors only come from CSS variables, applied through `style` (`fill`, `stroke`, `stopColor`) so `var()` resolves; never
as SVG presentation attributes. Text uses Tailwind token utilities (`fill-ink-3`, `text-fs-110`).

- Series 1 is always `var(--accent-word)`, so it follows `data-accent`. Series 2-8 use `--chart-cat-1` ... `--chart-cat-7`.
- `--chart-up`, `--chart-down`, `--chart-total` are the semantic direction tokens (candles, waterfall, slopes, change columns).
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

### Semi-circle sunburst and the treemap/sunburst morph

- `<SunburstChart half />` draws the partition on a 180 degree fan; the center label sits above the baseline and the
  pointer and keyboard behave as in the full disc.
- `<HierarchyMorph data={tree} />` shows one hierarchy as treemap rectangles or sunburst rings and morphs between them
  (`mode` / `defaultMode` / `onModeChange`, `showSwitch={false}` to drive it from outside). It draws the first
  `levels` (1 or 2) levels; shapes that have no rectangle in the treemap grow out of their parent.
- Treemap, sunburst and icicle have `Drilldown` stories that report the open node through `onFocusChange`;
  `Nested` (treemap, `depth={3}`) is the market-map layout.

## Node-link charts: tree and sankey

```tsx
<TreeChart title="Equipo de la barbería" data={{ name: "Carlos", subtitle: "Dueño", children: [...] }}
  direction="left" edgeStyle="step" initialDepth={2} height="fill" />
<TreeChart ... renderNode={(node, state) => <MyCard node={node} highlighted={state.highlighted} />} />
<SankeyChart title="Origen de clientes" nodes={[{ id: "ig", name: "Instagram" }, ...]}
  links={[{ source: "ig", target: "corte", value: 142 }, ...]} columns={["Origen", "Servicio", "Pago"]} />
```

- `TreeChart` draws edges in SVG and nodes as absolutely positioned HTML boxes (`nodeWidth` x `nodeHeight`)
  inside one transformed stage, so templates are ordinary React + Tailwind. The default `TreeCard` has a color
  rail, avatar (image or initials), name, subtitle and badge. Expand/collapse animates with `useTreeTransition`
  (nodes grow out of and fold back into their closest visible ancestor). The view fits the tree and follows the
  container until the user pans or zooms; the fit button (or `0`) returns to following. Keyboard: the explorer
  slider moves by arrows relative to the direction (towards the leaves = first child, across = siblings), Enter
  toggles, `+`/`-` zoom, Home goes to the root; the active node is panned into view.
- Tree extras: `layout="radial"` (`radialTreeLayout`: root in the centre, one ring per level, leaves share the
  angle, rings pushed out until a ring's boxes fit; edges via `radialEdgePath`) and `layout="dendrogram"`
  (`dendrogramLayout`: every leaf on the last level, parents centred over their first and last child, honours
  `direction`); both default to compact `TreeChip` nodes and the same transitions. `searchable` adds a search box
  (`searchTree` folds accents, every word must match name, subtitle or badge): matches are ringed, Enter / Shift+Enter
  or the arrows step through them, opening closed ancestors, selecting the node and centring it. `selectable` /
  `selectedId` keep the path to the root lit. `showCounts` shows descendants (`TreeNodeState.descendants` for custom
  templates). `groupLeaves={n}` folds runs of `n`+ leaf siblings into a dashed group node (`groupLeaves()` is
  pure). `lazy: true` data plus `loadChildren(node)` fetches children on first expand with a spinner on the toggle
  (`buildTreeModel(data, loaded)`); a rejected promise marks the node and calls `onLoadError`. `edgeColor` is
  `neutral | depth | branch`; with a lit path the other edges fade.
- `SankeyChart`: hover a node to light its whole flow upstream and downstream, a link to isolate it; the tooltip
  gives the value, share of its source and share of the total. Keyboard: up/down within a column, left/right to
  the nearest node of the next column, Enter steps through the node's flows. Links that close a cycle are left
  out, reported through `onRemovedLinks`, and logged with `console.warn` outside production.
- Sankey extras: `compare={previousLinks}` turns it into a diff view (`sankeyDiff` merges the periods by pair; the
  layout reserves the larger width, the band is drawn at the current width colored by `--chart-up` /
  `--chart-down`, the previous width stays as a grey ghost, a flow that disappeared is dashed; tooltip and table
  give before, after and change). `pathTracing` makes a link light everything upstream of its source and
  downstream of its target (`sankeyTraceOf`) and lets a click pin the path. `particles` animates dots along the
  bands with SMIL (`animateMotion`), off under `prefers-reduced-motion` and marked `data-export-skip` so exports
  stay static. `exportable` adds SVG / PNG buttons. `relax={false}` and `SankeyNodeInput.column` pin nodes to
  fixed columns in input order, which is what `AlluvialChart` (`stages`, `categories`, `flows[s]` from stage `s`
  to `s + 1`; `alluvialGraph` is the pure conversion) uses.
- `ChordChart`: `chordLayout(matrix)` (`matrix[i][j]` = flow from `i` to `j`, a group's arc is its row sum, a
  ribbon is `matrix[i][j]` wide at `i` and `matrix[j][i]` at `j`), `ribbonPath`, `chordsOf`, `groupAt`. Hover a
  group to light its ribbons, a ribbon to isolate it; arrows walk the groups (`PlotOverlay`-style hidden slider).
  Names sit around the ring from 420 px, the legend carries them below.
- Narrow containers: the tree is fitted (and can be zoomed); sankey labels shorten, then hide when the gap
  between columns is under 40 px, and a node legend shows below the drawing until `@lg/chart`.

## Responsive: hierarchy and heatmap charts

Charts receive the measured width of their container from `ChartFrame`, never the viewport. The hierarchy
and heatmap charts make the frame a size container (`@container/chart`) so the HTML around the drawing
reacts with container variants: the legend sits below the drawing in narrow containers and moves above it
from `@md/chart`. Inside the SVG: labels only render where they fit, column labels thin out, the sunburst and
icicle drop outer levels before they get too thin, the calendar keeps only the most recent weeks that fit,
and the tooltip never leaves the frame. Every chart has a `Narrow` story at 320 px.

## Fitting the parent: `height="fill"` and `aspectRatio`

Every chart adapts to its exact parent, width and height, from the container and never the viewport.

```tsx
<div style={{ width: 560, height: 360 }}>
  <LineChart height="fill" ... />      {/* takes the whole box, legend and brush included */}
</div>
<DonutChart aspectRatio={16 / 9} ... /> {/* height follows the measured width */}
```

- `height`: a number (pixels, the default of each chart), `"fill"` (the frame measures its slot with a
  `ResizeObserver` and the legend, footer and brush are subtracted by the layout, so the drawing gets what is left),
  or, inside `ChartFrame`, a function of the width (`CalendarHeatmap` uses it: square cells decide the height).
- `aspectRatio` (width / height) wins over a pixel `height` and is ignored with `"fill"`.
- `"fill"` needs a parent with a definite height (fixed, flex or grid sized). With none, the drawing falls back to a
  120 px minimum instead of collapsing.
- `ChartFrame` is `@container/chart` with no padding or margin; `children(width, height)` gets the drawing size
  (the second argument is optional, older charts keep working). The pure rules live in `core/drawing-height.ts`.
- Row-based charts (`TimelineChart`, `DumbbellChart`, `IsotypeRows`) accept `height="fill"` only: rows stretch to the
  box. `ProgressUnits` is a single row and keeps its `size`.
- No chart has outer padding: the plot touches the container edges except for axis gutters measured from the actual
  tick labels (plus half of the last x label). Polar charts take `min(width, height)` for the radius; with
  `legendAside` the legend moves beside the drawing from `@lg/chart` (512 px) and sits under it when narrower.
- Only container variants (`@lg/chart:`, `@md/chart:`, `@sm/units:`) are used in charts. Geometry thresholds in JS
  (`width < 440`, ...) read the measured width. Check the `FillParent` stories (resizable box) and `Narrow` ones.

## Gantt and stock charts

```tsx
<GanttChart
  title="Remodelación de la sede San Isidro"
  tasks={[{ id, name, start, end, progress, parentId, milestone, dependencies: ["id"], color, assignee }]}
  defaultZoom="day"            // or zoom + onZoomChange
  today={new Date()}           // "auto" (default) or false
  editable onTaskChange={(change) => update(change)} // { id, start, end, progress, source }
  holidays={[new Date(2026, 9, 8)]}
/>
<StockChart
  title="Precio de la caja de navajas (S/)"
  data={[{ date, open, high, low, close, volume }]}
  ranges={presets} defaultRange="6m"
  overlays={[{ type: "sma", period: 20 }, { type: "bollinger" }, { type: "vwap" }]}
  oscillator={{ type: "rsi" }} // or { type: "macd", fast, slow, signal }
  comparisons={[{ id, name, values }]} flags={[{ date, label: "P", text, tone }]}
/>
```

- Gantt: the task tree (`role="tree"`, roving focus) and the timeline share one scroller, so vertical scroll is always in
  sync; the header row and the list are `position: sticky` (the Table pinning idea). The divider between them is a
  focusable `role="separator"` (drag or arrows). Ends are instants: a task from Monday to Friday ends on Saturday 00:00
  and is shown ending on Friday. Keyboard: Up/Down rows, Left/Right collapse/expand, Enter toggles; when `editable`,
  Alt+arrows move by the zoom snap, Shift+arrows change the end, `+`/`-` change progress by 10%. Edits are controlled:
  the chart reports them and shows the dragged draft until `tasks` changes. Late links (successor starts before the
  predecessor ends) use the danger token. Default height follows the rows (220-560 px); `"fill"` scrolls rows inside.
- Gantt extras: `showCriticalPath` runs `criticalPath(tasks)` (forward/backward pass over finish-to-start
  dependencies; tasks without predecessors start at their own date, the rest when their predecessors end, so waiting gaps are ignored; a dependency on a parent
  means all its leaves; cycles are left out) and draws zero-slack tasks and their tight links in the danger tone,
  with the slack of the others in the tooltip. `showBaselines` draws `task.baseline` as a thin bar under the
  actual one and adds baseline and variance to the tooltip. `annotations` are dated lines or bands (`to`) with a
  label, stacked into lanes so labels never overlap. `zoom="year"` shows a whole year (quarters in the header).
  `exportable` adds SVG and PNG buttons that export the header and the timeline (`core/export.ts`).
- Stock: indicators run on the whole series and are sliced to the window, so the warm-up never shows inside the view;
  VWAP is anchored at the first visible bar. Visible comparisons switch the chart to % change from the first visible
  bar (the main series becomes a line, overlays hide, the type switch is disabled). The price and oscillator panes
  share one crosshair and one keyboard slider; the navigator is `ChartBrush`. `height` covers price and oscillator; the
  navigator is extra, as with the candlestick brush (`"fill"` includes it).
- Stock types: `seriesType` also takes `"column"`, `"heikin-ashi"` and `"renko"`. The last two transform the data
  (`heikinAshi(data)`, `renko(data, brickSize)` in `stock-transforms.ts`, `renkoBrickSize` defaults to the ATR(14));
  overlays and the oscillator then run on the transformed bars, the hidden data table keeps the raw prices.
- Streaming: `useStockStream(initial, { maxBars })` returns `{ data, appendData }`; `appendBars` replaces a bar with the
  same date (the forming candle) and appends newer ones. A window that ends at the last bar follows new bars, any other
  window keeps its dates; a different series type or an unrelated dataset resets to `defaultRange`.
- Drawing tools: `drawingTools={DEFAULT_STOCK_TOOLS}` shows select, trend line, horizontal line, range box, Fibonacci and
  measure. Drawings are `{ id, type, a, b }` with `{ time, price }` anchors, so they survive zoom and new data; the list is
  controlled with `drawings` or `defaultDrawings` and every change reaches `onDrawingsChange(all)`. Select one by clicking it
  and delete it with Supr or the toolbar button. Measure is transient: it shows % change, bars and days between two points.
  Drawings are hidden in % comparison mode.
- `pinnable` pins a bar's tooltip on click or Enter (several at once, `defaultPinned` / `onPinnedChange` carry times in ms).
- `stockStats(bars)` is headless: returns, annualized volatility, high/low, best/worst day and maximum drawdown; pair it
  with `onWindowChange({ from, to })` to summarize the visible window.

## Bars and relatives

```tsx
<BarChart                                   // floating bars: [start, end] per category
  series={[{ id: "turno", name: "Turno", ranges: [[9, 17], [10, 18]] }]} />
<BarChart stack="normal" series={[         // grouped stacked: one pile per stackGroup
  { id: "cortes", name: "Cortes", stackGroup: "ingresos", data },
  { id: "sueldos", name: "Sueldos", stackGroup: "costos", data },
]} />
<BarChart categoryGroups={[{ label: "1.er trimestre", count: 3 }]} categories={months} />
<BarChart yAxis={{ reversed: true }} />    // bars hang from the top (left-to-right axis flips for horizontal)
<BarChart series={[{ id: "a", name: "A", data, pattern: "stripes" }]} />
<BarChart distributed /> // or series[].colors = ["var(--chart-up)", undefined, ...]
<BarChart categoryLabelRotation={-45} />
<BarChart categoryTickEvery={(i, label) => i % 5 === 0 || i === last} yAxis={{ max: (m) => Math.ceil(m / 400) * 400 }} />
<LineChart markers={[3, 5]} tooltipRows={({ index, rows }) => ({ rows: [...rows, extraRow], footer: "Nota" })} />
<HeatmapChart cellDetail={(row, column, value) => [{ id: "n", name: "Pagos", value: "12", color: "transparent" }]} />
<DonutChart sliceLabels="percent" />
<DrilldownBarChart data={tree} breadcrumbLabel="Ruta" />   // HierarchyDatum; click a bar with a `›`
<BarRaceChart entities={[{ id, name }]} frames={[{ label: "Sem 1", values: [..] }]} topN={6} />
<WaterfallChart orientation="horizontal" />
<DumbbellChart orientation="vertical" measures={[{ name: "Sep" }, { name: "Oct" }, { name: "Meta" }]}
  items={[{ label: "Mateo", values: [42, 38, 35] }]} />
<LollipopChart items={[{ label, value }]} orientation="vertical" sort="desc" />
<BulletChart items={[{ label, actual: 78, target: 85, ranges: [60, 80, 100] }]} rangeLabels={["Bajo", "Medio", "Alto"]} />
```

- `CartesianSeries` gained `from` (floating start), `stackGroup` and `pointColors`; `ChartSeries` gained `pattern`;
  `ValueAxisOptions` gained `reversed`; `CartesianChartProps` gained `categoryGroups`, `categoryLabelRotation` and
  `onCategoryClick(index)` (click or Enter on the focused plot). Floating series never stack and are rounded at both ends.
- Group labels (`CategoryGroupAxis`, `categoryGroupSpans` in `core/cartesian/`) are a second tier under vertical category
  axes; they hide while the plot is zoomed.
- Patterns (`core/patterns.ts`, `core/pattern-defs.tsx`): `PATTERN_NAMES` (stripes, stripes-reverse, dots, crosshatch,
  grid, zigzag, checks, diamonds, waves) or your own `PatternTile { size, shapes }`. Tiles are drawn in the series color
  over a soft backdrop of the same token, so themes still decide the hue. `ChartPatternDefs` + `patternId` / `patternFill`
  are exported so other charts (donut, area) can use them: render the defs in your `<defs>` and fill with `url(#id)`.
- Bar race: values move linearly and ranks follow a smoothstep (`raceItems`), so bars glide into place; bars pass over each
  other while swapping. Reduced motion steps frame to frame. The hidden table lists every frame.
- Bullet: `scale="row"` (default) gives every row its own 0-to-max scale, for mixed units; `"shared"` draws one axis.
- Dumbbell with `values`: the change compares the first measure with the last; two measures keep the gradient bar, more
  use a neutral bar. Vertical dumbbells put the change above each column.

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

Marks anchored at a data coordinate (category `x`, value `y`), with an optional `tooltip` sentence shown when the
pointer is within 14 px (any annotation type accepts `tooltip`, only `point` and `text` are hoverable):

```ts
{ type: "point", x: new Date(2026, 9, 4), y: 2280, label: "Récord", tooltip: "Mejor día del periodo", tone: "success" },
{ type: "text", x: "dom", y: 900, label: "Domingo corto" },
```

## Cartesian extras

| Prop | Where | What |
| --- | --- | --- |
| `curve="step" \| "step-before" \| "step-after"` | Line, Area, Combo | Values that hold until they change. `step` switches halfway between samples, `step-after` holds the value until the next sample, `step-before` jumps early. Stacked areas mirror the lower edge. |
| `syncId` | every cartesian chart | Charts with the same id share the hovered category (crosshair, dots and tooltip) and the brush window. Matching is by category value (dates by time; nearest date when the other chart is sampled differently). Wrap a group in `ChartSyncProvider` to scope it so two groups with the same id never mix. |
| `onPointClick` | every cartesian chart | `{ index, category, seriesId, value }` for a click, or Enter on the focused plot. `index` is in your original `categories`, whatever the zoom or downsampling. |
| `transition` | every cartesian chart | Eases line and area paths between updates with the CSS `d` property (live feeds with a fixed point count; browsers without it jump). |
| `maxPoints` | every cartesian chart | LTTB threshold, 2000 by default, `false` to draw everything. Applies to line and area plots (never bars or horizontal charts): `sharedSampleIndices` picks the union of each series' LTTB points plus the neighbours of every gap, so series stay aligned. Zooming resamples the window; the hidden data table and the brush overview use the reduced data. |
| `gradient` (LineChart) | Line | Strokes each line from its color towards the next palette color. (On Area/Combo `gradient` is still the fill under the area.) |

`downsample(points, threshold)`, `lttbIndices` and `sharedSampleIndices` (core `downsample.ts`) are pure and tested in
`test/cartesian-parity.test.mjs`, together with the step paths and the sync store.

`LineDrilldown` (`line-chart/`) walks a `HierarchyDatum`: the children of the focused node are the points, a node's
value is its own or the sum of its children, clicking a point with children drills in (`useDrill`) and `ChartBreadcrumb`
climbs out. It keeps `useDrill`'s rule that only positive values are shown.

Value axes: `yAxis` and `rightAxis` are shorthand for the axes with id `"left"` and `"right"`. `axes` declares any number
of them (`{ id, side?: "left" | "right", color?, ...ValueAxisOptions }`; extra ones default to the right), series pick one
with `axis: "<id>"` and annotations with `yAxis: "<id>"`. Axes stack outward from the plot on their side, each taking
the width of its widest tick label (`stackAxes`, tested); an axis no series uses is dropped. `color` tints the labels
and draws a thin axis line so a reader can tell which scale belongs to which series. The first axis is the primary one
(gridlines, zero line, bar baseline). Charts with a `syncId` also share the widest left and right margin of the group, so
their plot areas line up.

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
| `points.ts`, `observations.tsx` | `jitterValues(values, seed, reach)` (deterministic jitter, `reach` may follow a density), `groupSeed`, and `ObservationDots` (raw dots of a box or violin, `coloring: "series" \| "value"`). |
| `dot-stack.ts` | `packDots`, `fitRadius`, `explodeBins`: row-by-row dot stacks that fit a bin, one shared radius (histogram explode). |
| `point-index.ts` | `createPointIndex(points, cell)`: uniform-grid index, `nearest(x, y, radius)` in microseconds for 50 000 marks; ties go to the smaller mark. |
| `../use-canvas.ts` | `useCanvasPaint` (device-pixel-ratio canvas, repaint on deps and theme change), `resolveCssColors` (token / `color-mix()` colors to something a canvas understands). |
| `labels.ts` | `StatLabels` (median, Q1, mean, outliers, ...) merged with `ChartLabels`; pass Spanish through `labels`. |

### Parity features (distribution, scatter, heatmap, trellis)

Pure parts are tested in `test/distribution-parity.test.mjs`.

- `BoxPlot` / `ViolinChart`: `showPoints` draws every raw sample with seeded `jitter` (0-1, the share of the box or local
  violin width) and `seed`; `pointColor="value"` grades each dot from a pale tint of the series colour to the full colour.
  Violin dots spread by the local density, so they follow the shape. Outlier dots are the same dots when `showPoints` is on.
- `Histogram`: `exploded` / `defaultExploded` / `onExplodedChange` turn every bin into one dot per observation (dot plot
  on the same bins, one column per bin, staggered pop-in); dot k fills the k-th unit cell of the y axis, so a stack is as
  tall as its count, and the axis stretches when dots would otherwise be taller than the bin is wide.
  `explodeToggle` shows the button (`labels.explode`, `labels.bars` while exploded; `aria-pressed`).
- `ScatterChart` / `BubbleChart`: `xType="time"` (x in epoch ms, calendar ticks, `formatDate` tooltips), `jitter`
  (pixels, number or `{ x, y }`, tooltips keep the true values), `XYPoint.image` (URL or data URI, clipped to the
  marker, ringed in the series colour), `shading="shaded"` (bubbles only: off-centre radial gradient, a lit sphere).
- `renderer="canvas"` (scatter, bubble, heatmap): marks are painted on a canvas; axes, tooltip, focus ring and
  keyboard stay SVG/HTML. Scatter hit-testing is a grid index (`createPointIndex`); heatmap hit-testing is cell
  arithmetic (`hexLayout.cellAt` for honeycombs). The hidden data table is capped (500 points, 60 x 40 cells), and the
  heatmap crosshair dimming is skipped. Scatter falls back to SVG when points have images or bubbles are shaded.
- `HeatmapChart`: `shape="hex"` honeycomb (`hexLayout`, `hexPath`: pointy-top, odd rows shifted half a cell),
  `columns` may be `Date[]`: the header is labelled only at calendar boundaries (`datetimeColumnLabels`).
  `DrilldownHeatmap` takes a root `HeatmapLevel` whose `drill({ row, column, value })` returns the sub-matrix.
- `ChartGrid`: `panels` (`id`, `title`, `subtitle`, `extent`, `xExtent`) and a render prop `(panel, ctx)`;
  `ctx.valueDomain` / `ctx.xDomain` are the shared domains (`sharedDomain`: union of extents, niced, `includeZero`),
  `ctx.height` (default: about 1.4:1 from the panel width, at least 180), `ctx.tickCount` (the shared domain is niced for it, pass it as `yAxis.tickCount`), `ctx.compact`. Columns come from the measured container width (`gridColumns`, `minPanelWidth`,
  `maxColumns`), never the viewport. `legend` is one shared `ChartLegend`; `syncHover` wraps the grid in a
  `ChartSyncProvider` and exposes `ctx.syncId`: pass it to each chart's `syncId` and every panel shows the real crosshair
  and tooltip of the hovered category.

Exploration order is the reading order: boxes/violins category by category, histogram bins left to right, beeswarm
points row by row, scatter points by x. The tooltip and `aria-valuetext` carry the same numbers.

## Responsive: all charts and the distribution family

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
3. Inside `children(width, height)` (accept `height: number | "fill"` and `aspectRatio` and pass them to the frame), render a separate plot component so `useMemo` can hold the geometry; keep hover state in
   that component and `memo` the marks.
4. Use `seriesColor(i)` for categorical colors (slices, cells legend) and `TONE_COLORS` for status colors; apply them via
   `style`. Use `resolveFormat` for values and `formatDate` for dates.
5. Geometry helpers: polar code can reuse `linearScale` for radius, `bandScale` for angular slots, and draw arcs with
   its own small `arcPath` next to `path.ts` (add it there so the next chart can share it).
6. Reuse `ChartTooltip` (pass container-relative `x`/`y`) and a focusable overlay with `role="slider"` +
   `aria-valuetext` for keyboard exploration.
7. Animate with `useEntryAnimation`; respect `animate={false}`.
8. Pure helpers get a case in `test/charts-core.test.mjs`.

## Polar charts and narrow containers

Polar charts measure the container through `ChartFrame` and degrade by width, with no viewport queries:
outside labels (donut/pie) and rim labels (polar area) give way to the legend below 420-440 px, radial ring labels
hide below 360 px, radar axis names shorten, funnel label columns shrink and truncate, and the tooltip flips inside
the frame. Every polar chart ships a `Narrow` story rendered in a 320 px container.
8. Pure helpers get a case in `test/charts-core.test.mjs` (hierarchy and matrix layouts: `test/charts-hierarchy.test.mjs`).

### Radial charts: shades, fills, updates, drilldown

- `monochrome` (`PieChart`, `DonutChart`, `PolarAreaChart`): one hue in shades, darkest on the largest value
  (`monochromeByValue` in `palette.ts`). `true` uses the accent, a string sets the base color.
- `DonutChart` `fill`: `"gradient"` fades each slice from the hole to the rim; `"pattern"` adds a texture per slice
  (stripes, dots, grid, wide stripes, checks) so color is not the only cue. Image fills are not supported.
- Data changes ease: slices grow, shrink and appear, and the centre total counts along (not under reduced motion).
- `DonutChart` drilldown: a datum with `children` opens in the same ring on click or Enter; a breadcrumb (and Escape or
  Backspace) goes back; children default to shades of the parent color. `rootLabel` names the first crumb.
- `GaugeChart`: `tickMarks` + `minorTicks` draw a dial; `centerContent` replaces the value/caption with your own
  HTML. `FunnelChart`: `tapered` (default) or straight bars, and `neck` for how far the last stage narrows.

## Maps

```tsx
import { ChoroplethMap } from "@jcsoftdev/ui/charts/choropleth-map";
import { peruMap } from "@jcsoftdev/ui/charts/maps/data/peru"; // geometry is a separate module

<ChoroplethMap title="Clientes por departamento" map={peruMap} valueName="Clientes"
  data={[{ id: "PE-CUS", value: 520 }, { id: "Arequipa", value: 760 }]} />
<BubbleMap title="Sedes" map={selectRegions(peruMap, ["PE-LMA", "PE-CAL"])} cluster
  points={[{ id: "mir", name: "Miraflores", lat: -12.12, lon: -77.03, value: 1840, category: "propia" }]} />
```

- Data joins by region id or name (accents and case ignored). `value: null` or a missing region has no data.
- Geometry is TopoJSON decoded by our own `topologyFeatures`; `maps/data/README.md` has sources, licenses and how it was
  simplified. `selectRegions(map, ids)` restricts a map (the projection re-fits, so it also zooms to those regions).
- Projections (`maps/geo/projection.ts`): `equirectangular`, `mercator` (clamped to 85.05 deg), `equalEarth`, and `fitted`
  (equirectangular with the standard parallel at the middle of the area, for a country). `fitProjection` scales any of
  them to the exact box of the chart, so a map fills its parent like every other chart (`height="fill"`, `aspectRatio`).
- Zoom and pan: buttons, wheel (by default `wheelZoom="modifier"` needs Ctrl/Cmd so page scrolling is never trapped), drag,
  two-finger pinch, keys `+` `-` `0` and Shift+arrows. The view is clamped to the map and resets when the box resizes.
- Keyboard: one focusable `role="slider"` layer; arrows walk the regions (or visible bubbles), Enter fires the click
  callback, the tooltip follows the keyboard selection and the view pans to keep it visible. A hidden data table
  repeats every value.
- Touch: the map takes the gestures (`touch-action: none`), so on phones scroll the page from outside the map or pass
  `zoomable={false}`.
- Region labels (`regionLabels`) sit at a point inside each region, only where they fit and do not collide. Bubble and
  cluster sizes are in screen pixels, area proportional between `minRadius` and `maxRadius`.
- Data table: `dataTable="visible"` swaps the map for a sortable table (name, value, a magnitude bar) and `"toggle"`
  adds a button to switch; the default keeps the table for screen readers only. `MapDataTable` is exported for reuse.
- Drilldown: `ChoroplethDrilldown` takes a `root` level (`{ id, name, map, data }`) and `resolve(region, path)` returning
  the level to open (or nothing); a breadcrumb goes back up. Only Peru and the world ship geometry, and Peru has
  departments but no provinces, so the story drills world -> Peru.
- `HexTileMap`: every region is one equal hexagon (`tiles` = `{ id, name, code, row, col }` on an odd-r grid; Peru's 25
  regions are `PERU_HEX_TILES`). Same data joins, scales, legend, tooltip, keyboard and table as `ChoroplethMap`;
  labels show the code and the value where the tile is big enough. The layout math is in `hex-tile-map/hex-layout.ts`.
- Routes: `BubbleMap routes={[{ id, from, to, value }]}` (`from` / `to` are point ids or `{ lon, lat }`) draws arcs under
  the bubbles; `routeStyle="curve"` is a quadratic arch in screen space (`routeBend`), `"great-circle"` follows the
  shortest path on the globe and splits at the antimeridian (`maps/geo/routes.ts`). Width follows `value`, the dashes
  march from origin to destination unless `animateRoutes={false}` or the user prefers reduced motion, and routes get
  their own hidden table.
- Pure helpers (`projection.ts`, `topojson.ts`, `simplify.ts`, `build-topology.ts`, `cluster.ts`, `view.ts`) are tested
  in `test/charts-maps.test.mjs`; `check:treeshake` asserts that a chart or one dataset never pulls in the other dataset.

## Globe, crossfilter, ruler/ink and scrollytelling

- `GlobeChart` (`globe-chart/`): the world as an orthographic globe. Props: `map` (`worldMap`), `data` (choropleth by id or
  name, same scales and legend as `ChoroplethMap`), `points` (`MapPoint`, area-proportional), `routes` (`MapRoute`,
  great-circle arcs lifted over the surface), `graticule`, `initialRotation` or controlled `rotation` +
  `onRotationChange`, `autoRotate` (pauses on hover/focus, off under reduced motion, with a pause button). Drag or use
  the arrow keys (Shift turns more), `0` resets, space pauses the spin. It is a disc that fits the container
  (`height="fill"` too). All math (rotation, horizon clipping of rings and lines, great arcs, invert) is in
  `maps/geo/globe.ts` and tested in `test/globe-parity.test.mjs`. Limits: no zoom, and a polygon that covers the whole
  visible hemisphere without crossing the horizon (e.g. Antarctica, not shipped) is not filled.
- Crossfilter (`crossfilter/`): `CrossfilterProvider data dimensions` shares one dataset and its filters;
  `useCrossfilter()` exposes `filtered` (feed it to a `DataGrid`), `group`, `bins`, `toggle`, `setRange`, `clear`.
  `CrossfilterBarChart` (click to filter), `CrossfilterHistogram` (drag or click bins) and `CrossfilterScatter`
  (filtered dots in accent, the rest faint; a rectangular brush filters both dimensions: drag a rectangle, click to clear, or focus the brush after the plot: arrows move it, Shift + arrows resize it, Enter applies, Escape clears; a Clear button appears; on touch the plot keeps `touch-action: pan-x pan-y`, so swipes scroll the page and the brush starts only after resting a finger ~350 ms, with a short vibration where supported: `touchDelay` on `CrossfilterScatter` / the `XYBrush`, `0` brushes at once and blocks scroll; mouse and pen drag immediately) each show "filtered of total" and draw the totals as a ghost
  series. A chart's own filter is excluded from its own counts (crossfilter semantics), so it stays stable while you
  brush it. The engine (`crossfilter-engine.ts`) is pure and tested in `test/crossfilter-parity.test.mjs`. The
  histogram brush uses the new cartesian prop `rangeSelect={{ value, onChange }}` (vertical charts, band of category
  indices; no zoom).
- Ruler and ink: `const ink = useChartInk()`; `<ChartInkToolbar ink={ink} />` and `<LineChart overlay={ink.overlay} />`
  (any vertical `CartesianChart` preset). The ruler reports Δx (time axes in d/h/min, category axes in steps) and Δy
  (value and %); the pen draws a thinned, smoothed, spline path. Marks are stored in data units and drawn inside the
  chart SVG, so `ExportMenu` exports them. Undo, redo and clear are in the toolbar. `CartesianChartProps.overlay` is
  `{ svg(plot), html(plot) }` with `CartesianPlotInfo` (pixel/data conversions) so other tools can reuse it. Pointer
  or keyboard: with the ruler or pen active the plot is focusable (`role="slider"`); arrows move a crosshair (one
  category or a fiftieth of the time window; Shift five times as far), Space or Enter sets a point (ruler: two
  points; pen: Space adds vertices, Enter finishes), Escape cancels. The position is the slider's value text and the
  last measurement is announced in a live region. Downsampled series map x through the original sample indices (and
  real times), so measures are in data units, not samples. Horizontal bars (`orientation="horizontal"`) work too: the
  plot info carries `horizontal: true` (`toX`/`fromX` stay the category axis, now along y; `toY`/`fromY` the value axis,
  now along x), the ruler reports Δ value in value units plus the distance in categories (`deltaValue`,
  `deltaCategory` labels), and the arrows move the value left/right and the category up/down. `plotToPixel`,
  `pixelToPlot` and `plotDomain` in `core/ink.ts` convert for either layout. Math in `core/ink.ts`,
  tests in `test/ink-parity.test.mjs` and `test/ink-keyboard.test.mjs`.
- `Scrolly` / `ScrollyStep` (`containers/scrolly/`): steps scroll while a sticky `graphic({ step, previous,
  reducedMotion })` follows the one crossing the trigger line (`offset`, default the middle; `root` for an inner scroll
  container). Wide containers (`@3xl`) put the graphic beside the text, narrow ones pin it on top. Steps are plain
  content (`aria-current="step"` on the active one). Pure picking logic in `scrolly-logic.ts`, tested in
  `test/scrolly-parity.test.mjs`.
