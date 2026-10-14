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
- `build-logic` convention plugins: `jcsoftdev.kmp.library` (targets, `explicitApi`, ABI check, publishing, `writeModuleGraph`) and
  `jcsoftdev.kmp.compose-library` (Compose as `api`, stability config, Roborazzi). A module build file only declares its edges.
- Artifact id and Android namespace follow the project name (`:chart-core` -> `ui-compose-chart-core`, `com.jcsoftdev.ui.chart.core`).
- Module-graph guard: every module writes its resolved classpaths (jvm, android release, iOS on macOS) to `build/module-graph.txt`;
  `:chart:jvmTest` reads them and the main sources of all modules. The task declares them, settings and the catalog as inputs, so a
  wrong edge fails on the next run without `--rerun`. Sources are scanned as whole text: imports, wildcards, aliases, qualified names,
  comments, package declarations; any file under a `layout/` directory is pure math. `chart-core` and the geo data modules resolve no
  Compose artifact and name nothing of the kit. Each bypass has a unit test in `ModuleGuardTest`.
- `:size-probe`: Android app, one flavour per artifact, R8 release. The shared `ProbeActivity` is a `ComponentActivity` with
  `setContent { UiTheme { ProbeContent() } }`, so Compose and the kit are in the `none` baseline. Budgets live in
  `charts/<module>/size-budget.json`; the gate is `packages/ui-compose/scripts/check-chart-size.mjs`:
  `dexBytes` (flavour minus `none`), `dexOverChartBytes` (families only, over the `chart` flavour), `aarClassesBytes` and
  `klibBytes` (iosArm64 `linkdata` + `ir`, which exclude the path-bearing metadata so the size does not depend on the checkout).
  Hard caps from the plan (chart-core 25 KB, chart 60 KB, families 40-90 KB over `chart`, export 50 KB, geo data 4 KB) are in the
  script; `--update` rewrites budget files at measured +5% but never above a cap, and the caps change only by editing the script.
- Parity fixtures: each module owns `charts/<module>/fixtures.mjs`, producing `src/commonTest/resources/fixtures/*.json` via
  `pnpm chart:fixtures`; CI runs `pnpm check:chart-fixtures`. Non-finite numbers and -0 are `{"$f": "NaN"|"Infinity"|"-Infinity"|"-0"}`;
  the Kotlin decoder is `chart-testing/common/FixtureJson.kt` (and `chart-testing/jvm/FixtureResources.kt`), compiled as test
  sources into every module, with the round trip pinned by `chart-core`'s `FixtureJsonTest`.
- Catalog: `kotlinx-coroutines-core`, `kotlinx-serialization-json` and `kotlinx-datetime` are pre-added. A batch that needs another
  library adds exactly that one catalog line (and its version), nothing else in shared files.
- Geo data modules (`chart-geo-world`, `chart-geo-peru`) expose primitive data only (arrays, strings, numbers). They carry no Compose
  and no kit types, so `chart-geo` decodes them; the guard enforces it.
- CI: path filters cover `packages/ui/src/charts/**`, `packages/ui-core/src/chart/**` and `.nvmrc`; a `changes` job runs the Gradle
  and macOS jobs only when Compose paths changed (a web chart change runs only the fixture job). `verifyRoborazziJvm` runs
  unqualified, so every module with goldens is verified without a workflow edit. The release publishes `:kit` only until KZ.

## Keeping the size probe representative
The probe measures what ProbeContent reaches, so a stand-in measures nothing. The batch that fills a module, in the same commit:
1. replaces the module's `...Placeholder()` composable (and `...Module` object) with its chart code;
2. rewrites `size-probe/src/<flavour>/.../Probe.kt` to render the heaviest representative chart of the module through its public
   `@Composable` entry, with realistic data and every opt-in that adds code (tooltip, dock, a11y) switched on;
3. runs `./gradlew :size-probe:assembleRelease` and `node scripts/check-chart-size.mjs --dex --update`, then commits the new
   `charts/<module>/size-budget.json` with the reason. A number above the cap in the script is a failed batch, not a budget bump.
Reviewers check that Probe.kt calls the real entry, not a helper.

## Checklist
TDD mode: off. Implement first, then the tests that protect the change in the same work unit. Route: D = delegated direct writer,
I = direct inline. Batches KC3..KC10, KC13, KC14 run in parallel (file-disjoint modules); KC11 needs KC6, KC12 needs KC3a.

- [x] KC0  build-logic, empty modules, BOM, size probe, fixture script, reachability test (route D, ~900 lines)
- [x] KC1  chart-core: scales, ticks, axis, format, path, stack, palette, color-scale, downsample, nearest, time-range, brush/pan-zoom + fixtures (D, ~4200 in two stacked PRs: KC1a scales/format/axes, KC1b geometry/sampling/colour/hit-test/bench)
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
- `./gradlew :size-probe:assembleRelease :<module>:assembleRelease` then `node packages/ui-compose/scripts/check-chart-size.mjs --dex --aar`
- macOS: `:<module>:iosSimulatorArm64Test`, `:<module>:compileKotlinIosArm64` + `check-chart-size.mjs --klib`, and `:kit:compileKotlinIosSimulatorArm64`
- `pnpm check:chart-fixtures` and `node --test scripts/*.test.mjs`

## Progress
- KC0 done on `feat/compose-charts-kc0`; verification evidence is in the pull request.
- KC1 done on `feat/compose-charts-kc1` (KC1a) and `feat/compose-charts-kc1-geometry` (KC1b), both unmerged.
  Evidence: `:chart-core:check` (jvm + android unit tests, 52 tests), `apiCheck`, `spotlessCheck`, iOS arm64/simulator main and test
  compile, `check-chart-size.mjs` (chart-core dex 7196 B of the 25 KB cap, aar classes 145489 B, klib 366753 B), `pnpm check:chart-fixtures`
  (13 fixtures, Node 22), `:chart:jvmTest` module guard, `:chart-core:chartBench` + `check-chart-bench.mjs` within 20%.
  Not run locally: `iosSimulatorArm64Test` (no simulator SDK). Fixtures include NaN/Infinity, empty, single-point and 1e6-point cases.
  Notes for KC2: formatting goes through `ChartLocale` (`ChartLocales.system` / `forTag`; no es-PE default), geometry is emitted through
  `PathCommands` (`toSvg()` byte-matches the web), non-finite input is a gap, selection helpers are keyed. Fixtures that use Intl
  must be regenerated on Node 22 (V8 `10**n` differs on other versions).

## Next step
KC1 (chart-core), then KC2 (foundation). KC3..KC14 start only after KC2 merges.
