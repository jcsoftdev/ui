# In-house Compose Multiplatform component kit

## Objective
Build `@jcsoftdev/ui`'s Kotlin counterpart: an in-house Compose Multiplatform component kit (Android first, iOS ready) with the same component names, props, states and accessibility contract as the web library, generated from the same design tokens, and tuned for size and runtime performance.

## Problem / why
Owner decision 2026-10-10: "lo puedes ir trabajando en paralelo, así tenemos un kit de componentes propio en kotlin. Aplica optimizaciones de performance como el tree shaking de web." Today the barber Android app has about 24 hand-written components inside `app/ui` that drift from the web library (UX evaluation 2026-10-10: non-scrolling sheet, low-contrast primary action, numeric keyboards for formatted values, no offline state).

## Scope
- In: a KMP library at `packages/ui-compose` in this repo (targets android, iosArm64, iosSimulatorArm64, jvm), generated tokens, theme, foundations, icons, a mobile component subset, screenshot tests, baseline profile, publishing, and a parity matrix with the web library.
- Out: charts, data grid, AI set, dashboards and calendar views (web-only for now). Migrating the barber app to the kit is the last task and touches the barber repo.

## Constraints
- Runs in parallel with `odd/tasks/zero-runtime-deps.md` on its own branch and worktree (`feat/ui-compose`, `../ui-compose`). Overlay, menu and popover behaviour follows the web in-house contract once T9-T11 land; until then follow WAI-ARIA APG semantics mapped to Compose semantics.
- Dependencies: compose runtime, foundation, ui and components-resources only. No material3, no material-icons.
- Versions match the barber app: Kotlin 2.1.21, Compose Multiplatform 1.8.2, AGP 8.10.1, minSdk 26, compileSdk 36.
- Performance rules (research 2026-10-10, sources in the session report):
  - Size: R8 is whole-program at app build time, so one library module is enough; ship a minimal `consumer-rules.pro` (no package-wide keeps, no global options, no reflection).
  - Verify with a sample app built with `isMinifyEnabled` and `isShrinkResources`.
  - Public API is deliberate: `explicitApi()`, everything else `internal` (also shrinks iOS binaries), KGP `abiValidation` with a committed dump.
  - Runtime: strong skipping stays on; token and style classes are `@Immutable`; list props use immutable types or a stability configuration file; Compose compiler reports are checked for unstable public composables.
  - Custom modifiers use `Modifier.Node`, never `composed {}`; animated values are read in lambda modifiers (`graphicsLayer`, `offset {}`, `drawBehind`).
  - Icons are top-level `ImageVector` properties with a nullable backing field (no `by lazy`, no big object), so R8 drops unused icons; names match the web icon set.
  - A baseline profile for the kit's first-render paths, filtered to the kit package.
- Accessibility: 48dp minimum targets, semantics roles and state descriptions, font scaling to 200% without clipping, reduced motion via the system animator scale.
- Copy in Spanish is never hard-coded in the kit; strings come from parameters.

## TDD mode
Disabled (no project or session setting enables it). Runner: Gradle `:ui-compose:allTests` plus Roborazzi screenshot verification once C9 lands.

## Delivery strategy
ask-on-risk, chain strategy `feature-branch-chain` (same as zero-deps): each task is a PR into `feat/ui-compose`.

## Tasks
- [x] C0 Gradle KMP library scaffold: targets, `explicitApi()`, `abiValidation`, Compose compiler reports and stability config, empty `consumer-rules.pro`, a minimal sample Android app with R8 + resource shrinking, CI job (build, tests, ABI check, sample release build). Route: delegated.
- [x] C1 Tokens: `ui-theme` emits the kit's `Theme.kt` (package `com.jcsoftdev.ui.theme`) with `@Immutable` token classes; wired into the build so tokens never drift. Route: delegated.
- [x] C2 Theme provider: generic `UiTheme(colors, typography, dark, motion, content)`, Figtree via compose resources, injectable font and brand accent. Route: delegated.
- [x] C3 Foundations: `Motion` + reduced motion, `Modifier.Node` press feedback, back-handling contract (`LocalBackDispatcher`) usable outside the barber app. Route: delegated.
- [ ] C4 Icons: generated `ImageVector` set from the same SVG source as the web icons (zero-deps T6), nullable backing fields, same names. Route: delegated.
- [x] C5 Atoms (done before C4, reordered: C4 waits for the web icon source, zero-deps T6): Text, Button (variants, sizes, loading), IconButton, Chip/StatusPill, Avatar, Progress, Switch, Checkbox, RadioGroup, Divider. Route: delegated.
- [ ] C6 Forms: Field, Input (formatted time/date inputs with suitable keyboards), Select (sheet-based), Segmented, Tabs, PinInput. Route: delegated.
- [ ] C7 Overlays: Sheet (scrollable body, pinned actions), Dialog, Toaster with the web `toast` API shape, Menu. Route: delegated.
- [ ] C8 States and containers: EmptyState, ErrorState, OfflineBanner, Skeleton, Card, Cell/ListRow, PageHeader, Banner. Route: delegated.
- [ ] C9 Screenshot tests (Roborazzi, Android + JVM) for every component in light, dark and 200% font, plus `docs/parity.md` web-to-Compose matrix. Route: delegated.
- [ ] C10 Baseline profile module + Macrobenchmark on the sample app. Route: delegated.
- [ ] C11 Publish 0.1.0 to a Maven repository and migrate the barber app `app/ui` components to the kit (barber repo). Route: delegated.

## Acceptance criteria
- Kit builds for all targets; `explicitApi` and ABI check pass; sample app release build with R8 passes and contains no unused icons.
- Compose compiler reports show every public component skippable.
- Screenshot tests pass in light, dark and 200% font.
- Barber Android app runs on the kit with its UX evaluation regressions fixed (sheet scroll, contrast, keyboards, offline state).

## Progress
- 2026-10-10: research (R8/consumer rules, strong skipping, stability, Modifier.Node, icon backing fields, baseline profiles for libraries, ABI validation, Roborazzi) and Android mapping done.
- 2026-10-10: C0 done on `feat/ui-compose-c0-scaffold` (cfc11b5). Standalone Gradle build at `packages/ui-compose` (`:kit` + `:sample`); spotlessCheck, apiCheck, :kit:allTests (no tests), iOS sim/JVM/Android release compile and :sample:assembleRelease (R8 + shrinkResources, 592170-byte APK) all pass; compose compiler reports generated under `kit/build/compose_compiler`.
  - Decisions: KGP built-in `abiValidation` is JVM-only in Kotlin 2.1.21 (KMP support arrived in 2.2), so the `binary-compatibility-validator` 0.18.1 plugin with KLib validation is used (`apiCheck`/`apiDump`). jvmTarget 17 for jvm and android (BCV's ASM cannot read JDK 23 class files; CI uses JDK 17). `generateResClass = never` until resources land (C2) because the generated Res leaked `$stableprop` symbols into the klib dump. `compose-stability.conf` empty (strong skipping on). Wrapper lives at `packages/ui-compose/gradlew`, so commands are `packages/ui-compose/gradlew -p packages/ui-compose ...` from the repo root. CI: ubuntu job (spotless, apiCheck, tests, kit and sample release) plus a macOS job limited to `compileKotlinIosSimulatorArm64`, to avoid paying macOS minutes for everything.
- 2026-10-10: C1 done on `feat/ui-compose-c1-tokens` (a4196f8), stacked on C0. `ui-theme build --kotlin-library [--no-css]` emits explicit-`public`, `@Immutable` Theme.kt; default (barber) output byte-identical (diffed). Kit task `generateUiTokens` (Exec, cacheable, inputs = tokens.json + generator) feeds commonMain from `build/generated`; nothing committed. Compose reports: ThemeColors, AccentPalette, UiColors, UiPalettes, UiShapes, UiSizes, UiTypography all stable.
  - Decisions: `UiPalettes` drops the exposed `Map` for per-theme `when` lookups (`UiPalettes.light(id)`) plus `ids: List<String>`; the object is annotated `@Immutable` because List is otherwise inferred unstable. CI jobs gained `actions/setup-node@v4` (Node 22) and the workflow path filters include the generator inputs. Worktree needed `pnpm install --offline` for the full node suite (405 pass).
- 2026-10-10: C2 and C3 done on `feat/ui-compose-c2-c3-foundations` (C3 foundations 433e264, C2 theme 549fa91; foundations first because UiTheme consumes Motion), stacked on C1. spotlessCheck, apiCheck, :kit:allTests (13 jvm+android tests: accent nearest-hex, withPalette/copy, min line height, Motion reduced motion, BackDispatcher ordering), iOS sim compile, kit and sample release builds pass; sample APK 815859 bytes (C0: 592170; +Figtree 180K and activity-compose).
  - Decisions: `UiTheme(dark, colors = Light/Dark by dark, accent, fontFamily, motion)`; `dark` comes first so the colors default can read it; ink3-style patches go through public `ThemeColors.copy(...)`. Accent accepts a palette id or `#rrggbb` (nearest light-palette accent, or the base accent when it is closest). `Motion` has `FAST` 100, `STANDARD` 180 (web `motion-duration`), `SLOW` 300 and the web easing; system scale via `rememberSystemMotion` expect/actual (Android ContentObserver on ANIMATOR_DURATION_SCALE, iOS reduce-motion flag read once, JVM full motion). Press feedback is a `LayoutModifierNode` + `CompositionLocalConsumerModifierNode` using `placeWithLayer`. Android hosts call `ProvideAndroidBack { ... }` once. Res is internal (`publicResClass = false`, `generateResClass = always`) and `com.jcsoftdev.ui.resources` is excluded from the ABI dump via `ignoredPackages`; compiler-generated `$stableprop` symbols of other public classes still appear in the klib dump (pre-existing since C1, not removable without hiding the classes). consumer-rules.pro stays empty.
  - Not run locally: `:kit:iosSimulatorArm64Test` (no simulator runtime on this machine); the Press node and BackHandler composable lifecycle have no UI test yet (compose ui-test not wired; candidate for C9).
  - Compose reports: UiTheme and BackHandler restartable skippable; ProvideAndroidBack restartable skippable; Motion, BackDispatcher, BackPriority, UiTheme stable; Theme accessors readonly; rememberSystemMotion and rememberFigtree are internal non-restartable.

- 2026-10-10: C5 done on `feat/ui-compose-c5-atoms (7c9371f)`, stacked on C2/C3, executed before C4 (reorder: C4 depends on zero-deps T6 icon source). Package `com.jcsoftdev.ui.atoms`, one file per atom: Text (+ public `LocalContentColor`), Button/ButtonVariant/ButtonSize, IconButton (required contentDescription), Chip/ChipTone, StatusPill/LedStatus, Avatar (image slot drawn over initials), Progress (determinate and indeterminate overloads), Switch, Checkbox (Boolean and ToggleableState overloads), RadioGroup/RadioOption, Divider/VerticalDivider.
  - Verification: spotlessCheck, apiCheck, :kit:allTests (iOS sim excluded) green; jvm tests 19 (2 logic: initials, progress clamp; 4 Compose UI tests on desktop: switch toggle, tri-state checkbox, radio selection, disabled/loading button ignores clicks); iOS sim compile, kit and sample release builds pass. Sample APK 959035 bytes (was 815859; +143K from foundation text/selection and atoms). Composables report: all 14 public atom composables `restartable skippable`. Screenshot of the sample in light and dark on the emulator at scratchpad `ux/compose/c5-atoms.png`.
  - Decisions: compose ui-test wired for jvm only (`compose.uiTest` + desktop currentOs in jvmTest; Android unit tests would need Robolectric, left to C9). `kotlin.collections.List` added to compose-stability.conf for `RadioGroup(options)`. 48dp target is an in-house `Modifier.Node` (`minimumTouchTarget`), clicks via `clickable`/`toggleable` with `pressScale`. Visual heights use min height so 200% font does not clip. Loading does not dim (web does, via disabled); `loadingDescription` is the state description. Glyphs (check, minus) and spinner are internal draw helpers pending C4. Switch/Checkbox take optional `contentDescription` because the web atoms have no label either. Focus ring and Meter not ported.

## Next step
C4 icons once zero-deps T6 lands; otherwise C6 forms.
