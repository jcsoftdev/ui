# Compose charts

Feature: every React chart of `@jcsoftdev/ui` in Compose Multiplatform at full parity, in pay-for-what-you-use artifacts.

## Objective
Port all ~50 React charts to `packages/ui-compose` with 100% parity, desktop hover (floating card) and export included. Hover and
export are opt-in. Performance comes first: a chart body never recomposes on hover, and 100k points stay interactive.

## Scope
- Compose targets stay `jvm`, `android`, `iosArm64`, `iosSimulatorArm64`. No wasm/js.
- The parity target is the React chart math (`packages/ui/src/charts`). `packages/ui-core/src/chart` is itself pinned to React.
- Out of scope: a `ui-compose-theme` split, wasm/js targets, changing the web charts.

## Module graph
One artifact per family, never per chart, never one big artifact. Artifact ids are `com.jcsoftdev:ui-compose-<module>`.

```
bom                       java-platform, every module + the kit, one version
chart-core                pure Kotlin, no Compose: scales, ticks, axis, format, path, stack, palette, downsample, nearest, ...
chart                     api(chart-core) + api(kit): frame, state, hit/pin/hover, dock, tooltip, legend, a11y, Sparkline
chart-cartesian           bar, line, area, scatter, bubble, histogram, ...
chart-race                bar race
chart-distribution        box plot, violin, raincloud
chart-plots               heatmap, beeswarm, candlestick, stream graph, timeline, hbars
chart-polar               donut, pie, gauge, radar, radial bar, polar area, parliament
chart-hierarchy           sunburst, treemap, icicle, tree, sankey, chord, funnel
chart-units               waffle, pictogram, isotype rows, progress units, chart grid
chart-gantt               gantt
chart-stock               stock                    -> chart-plots
chart-crossfilter         provider + linked charts -> chart-cartesian
chart-geo                 projection, topojson; choropleth, bubble map, hex tile, globe
chart-geo-world, -peru    data only (opt-in)
chart-export              PNG, CSV, XLSX; never referenced by a chart
```
Edges: a family depends only on `chart` (and so `chart-core`). The only family-to-family edges are stock -> plots and
crossfilter -> cartesian. `chart-core` has no Compose. Nothing depends on `chart-export`. `ChartModuleGraphTest` enforces this.

## Constraints
- Family math lives in `...<family>.layout`, pure Kotlin with no `androidx.compose` import (test-enforced).
- Two draw layers per chart (cached base, overlay reading `ChartState` in the draw lambda); `FloatArray` buffers, no per-point boxing.
- Non-finite input is handled at the `chart-core` boundary. Colours are typed `Color`. Selection is by key, never index.
- Tests use a manual clock, never sleeps. `format` goldens are per platform.
- Shared Gradle files are touched only in KC0. Later batches edit only their own module and the fixture registry.
- Artifacts, code and comments in English.

## Conventions added by KC0
- `build-logic` convention plugins: `jcsoftdev.kmp.library` (targets, `explicitApi`, ABI check, publishing) and
  `jcsoftdev.kmp.compose-library` (Compose, stability config, Roborazzi). A module build file only declares its edges.
- Artifact id and Android namespace follow the project name (`:chart-core` -> `ui-compose-chart-core`, `com.jcsoftdev.ui.chart.core`).
- `:size-probe`: Android app, one flavour per artifact, R8 release. Budgets in `packages/ui-compose/size-budgets.json`,
  gate `packages/ui-compose/scripts/check-chart-size.mjs` (dex delta over the `none` flavour, AAR `classes.jar`, iosArm64 klib).
- Parity fixtures: `packages/ui-compose/chart-fixtures/registry.mjs` -> `charts/<module>/src/commonTest/resources/fixtures/*.json`
  via `pnpm chart:fixtures`; CI runs `pnpm check:chart-fixtures`.

## Checklist
TDD mode: off. Implement first, then the tests that protect the change in the same work unit. Route: D = delegated direct writer,
I = direct inline. Batches KC3..KC10, KC13, KC14 run in parallel (file-disjoint modules); KC11 needs KC6, KC12 needs KC3a.

- [x] KC0  build-logic, empty modules, BOM, size probe, fixture script, reachability test (route D, ~900 lines)
- [ ] KC1  chart-core: scales, ticks, axis, format, path, stack, palette, color-scale, downsample, nearest, time-range, brush/pan-zoom + fixtures (D, ~2500)
- [ ] KC2  chart foundation, Sparkline, dock/tooltip/legend/table, a11y, bench screen (D, ~2400)
- [ ] KC3a cartesian: first set (D, ~2200)
- [ ] KC3b cartesian: second set (D, ~1800)
- [ ] KC4  race (D, ~700)
- [ ] KC5  distribution (D, ~2000)
- [ ] KC6  plots (D, ~3000)
- [ ] KC7a polar: donut, pie, gauge, fill gauge (D, ~1600)
- [ ] KC7b polar: radar, radial bar, polar area, parliament (D, ~1500)
- [ ] KC8a hierarchy: partition charts, tree, morph (D, ~2400)
- [ ] KC8b hierarchy: sankey, chord, funnel (D, ~2200)
- [ ] KC9  units (D, ~1200)
- [ ] KC10 gantt (D, ~2000)
- [ ] KC11 stock (D, ~2500)
- [ ] KC12 crossfilter (D, ~1500)
- [ ] KC13a geo core, choropleth, hex tile (D, ~2000)
- [ ] KC13b geo bubble map, globe, world and peru data (D, ~1800)
- [ ] KC14 export (D, ~1200)
- [ ] KZ   parity.md, sample galleries, baseline profile, macrobenchmark, CHANGELOG, first BOM release (D, ~800)

## Acceptance criteria
- Per batch: its module compiles for all four targets, `apiCheck` is current, the reachability test passes, the size check passes
  with budgets raised only in a commit that says why, fixtures are in sync, and Roborazzi goldens exist for its charts.
- Per chart: light, dark, 200% font, pinned state and RTL goldens; tap pins and swipe does not; keyboard and TalkBack/VoiceOver
  semantics; a hover sweep causes 0 recompositions of the chart body.
- Final: every React chart has a Compose equivalent, `parity.md` lists the exceptions, the BOM publishes all modules in one release.

## Checks
- `./gradlew spotlessCheck apiCheck :kit:allTests :chart-core:allTests :chart:jvmTest <family>:allTests` (reachability runs in `:chart:jvmTest`)
- `./gradlew :size-probe:assembleRelease :<module>:assembleRelease` then `node packages/ui-compose/scripts/check-chart-size.mjs`
- macOS: `:<module>:compileKotlinIosArm64` + `check-chart-size.mjs --klib`, and `:kit:compileKotlinIosSimulatorArm64`
- `pnpm check:chart-fixtures` and `node --test scripts/*.test.mjs`

## Progress
- KC0 done on `feat/compose-charts-kc0`; verification evidence is in the pull request.

## Next step
KC1 (chart-core), then KC2 (foundation). KC3..KC14 start only after KC2 merges.
