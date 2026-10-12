# Liquid Glass in the Compose kit (ui-compose 0.2.0)

## Objective
Port the web kit's Liquid Glass (PR #32, `odd/tasks/liquid-glass.md`, `site/.../docs/glass.md`) to `packages/ui-compose` (`:kit`): a glass material (regular and clear) for the control/navigation layer, solid content surfaces by default, opt-in per surface through a `material` parameter, no glass on glass, accessibility forcing opaque surfaces, and real backdrop blur where the platform allows it. Zero third-party runtime dependencies (no Haze).

## Apple principles honored
Same list as the web document (HIG Materials; WWDC25 219 and 356): glass is a functional layer for controls and navigation; content stays solid; no glass on glass; regular and clear variants (clear needs a dim layer); specular edge; Reduce Transparency and Increase Contrast give opaque surfaces; concentric shapes (the existing shape tokens already are).

## Mirror of the web decisions
| Web | Compose |
| --- | --- |
| `glass` / `glass-clear` / `surface-solid` utilities | `SurfaceMaterial.Glass` / `GlassClear` / `Solid` |
| `glass` preset | `UiTheme(style = UiStyle.Glass)` |
| chrome glass only in the preset, content solid | `SurfaceRole.Chrome` (Sheet, Dialog, Menu, Toast, TopBar, ActionBar) glass only with `UiStyle.Glass`; `Card` is content |
| `material` prop on surface components | `material: SurfaceMaterial? = null` (null = role default) on Card, Sheet, Dialog, Menu, Toaster, TopBar, ActionBar; `Modifier.material` / `MaterialSurface` for anything else |
| glass-on-glass: near-solid `--glass-nested-tint` | `LocalGlassNested`; nested glass resolves to `colors.float` + hair border |
| `--glass-*` tokens | generated `UiGlass.RegularLight/Dark`, `ClearLight/Dark` (`GlassMaterial`) |
| layering: backdrop blur+saturate, tint, dim, edge, border | same order; sheen, shadow and noise are not ported (see risks) |
| prefers-reduced-transparency, prefers-contrast: more | `UiTheme(reduceTransparency, highContrast)`; defaults read the OS where an API exists |
| no blur tween, blur only on large chrome | constant radius from the token, never on list items |

## Rendering design
1. Tint-only (all platforms): tint + dim + 1px border + top edge highlight, drawn in a `Modifier.Node`.
2. Real blur: `OverlayHost` records the app content into a shared `GraphicsLayer` (`glassSource`) while at least one glass surface is composed. A glass surface records `drawLayer(source)` (offset to its own position) into its own `GraphicsLayer` with `BlurEffect` and a saturation `ColorFilter`, clipped to its shape. Android needs API 31+; Skiko (desktop, iOS) supports it. Below that or without a source it falls back to tint-only.
3. Overlays (Sheet, Dialog, Menu, Toast) are in-tree layers of `OverlayHost` (siblings of the app content), so they sample the host source with no setup. In-content chrome (TopBar) takes an explicit `GlassState` and the app marks the scrolling content with `Modifier.glassSource(state)`.

## Constraints
- CMP 1.8.2, Kotlin 2.1.21, foundation only, explicitApi, BCV, no new runtime dependencies.
- English artifacts, Conventional Commits, no AI attribution. No push, tag or publish.
- Performance: blur only on large chrome, never list items by default, no blur radius animation, capture only while a glass consumer exists.

## TDD mode
Disabled (owner override: implement first, then the tests that protect the change in the same commit). Runner: Gradle (`:kit:jvmTest`, `:kit:allTests`), Roborazzi for goldens.

## Golden policy
Goldens of record are Linux, recorded by `.github/workflows/ui-compose-record.yml`. New glass shots are recorded locally on macOS only as provisional files and are NOT added to the committed golden set; they are covered by `roborazzi` tests that run in record mode only when `-Proborazzi.test.record=true`. See CG6.

## Delivery strategy
`ask-on-risk`; direct work-unit commits on `feat/compose-liquid-glass` in worktree `/Users/jcsoftdev/personal/ui-compose-glass`. No push.

## Tasks
- [x] CG0 ODD document. Route: inline.
- [x] CG1 Spike: confirm `GraphicsLayer.renderEffect`/`BlurEffect`/`ColorFilter` on Compose 1.8.2 (desktop Skiko render, Android emulator), confirm overlays are in-tree. Route: inline.
- [x] CG2 Material model: `SurfaceMaterial`, `UiStyle`, theme flags, nested/accessibility resolution, pure resolver + JVM tests. Route: inline.
- [x] CG3 Rendering: `GlassState`, `glassSource`, `Modifier.material`, `MaterialSurface`, tint + blur paths, `OverlayHost` source. Route: inline.
- [x] CG4 Platform signals: expect/actual for blur support, reduce transparency, high contrast (Android, iOS, JVM). Route: inline.
- [x] CG5 Component integration: Sheet, Dialog, Menu, Toaster, Card `material`; new `TopBar`, `ActionBar`. Route: delegated writer if over 4 non-trivial files, else inline.
- [x] CG6 Tests and goldens: resolver tests, UI tests, provisional shots. Route: inline.
- [x] CG7 Sample "Glass" screen over busy content, emulator screenshots (real blur vs fallback), frame timing. Route: inline.
- [x] CG8 Docs: README "Glass", `docs/parity.md`, CHANGELOG 0.2.0 Unreleased, api dumps. Route: inline.
- [x] CA Phase A corrections (version 0.2.0, opaque base under the backdrop, solid overlays hide the page from glass, dialog observe, contrast listener, mutation-killing tests, README fixes): 956094a, 9b54d09, 99ef62a, 557420c.
- [x] CB Phase B Liquid variant: `Liquid`/`LiquidClear`, `GlassVariant`, lens shader per platform, rim/shadow/press, sample side by side, tests, docs. Route: inline.

## Acceptance
- Defaults: Default style keeps every surface exactly as before; Glass style turns only chrome to glass; Card is solid unless `material` is given.
- Nested glass is solid-ish (float); reduceTransparency/highContrast force opaque with border.
- Blur on Android 31+, desktop, iOS (compile verified); tint fallback otherwise.
- `apiCheck`, `spotlessCheck`, `:kit:allTests -x :kit:iosSimulatorArm64Test`, `:kit:compileKotlinIosSimulatorArm64`, `:sample:assembleRelease` green.

## Progress and verification evidence
- CG1 spike: `GraphicsLayer.renderEffect = BlurEffect` and `ColorFilter` work on Skiko (pixel test) and Android API 35 (emulator). Gotcha: `layer.record(size = ...)` (DrawScope extension) is required to capture `drawContent()`; the member overload with explicit density draws content on the outer canvas and records nothing. Overlays are in-tree siblings of the content in `OverlayHost`; Menu is a platform popup (no sampling, tint only).
- CG2-CG4: commit 83a322f. Resolver tests (11) in commonTest.
- CG5: commit 2714278 (Sheet, Dialog, Menu, Toaster, Card, TopBar, ActionBar). Sheet passes an `observe` lambda so the backdrop follows the drag/enter translation exactly.
- Fix: tint fallback is a 90% float veil (unblurred tint leaked text in the emulator shot); `UiTheme(backdropBlur)` added.
- CG6: 8 pixel tests in `GlassRenderTest`; shots gated behind `GLASS_SHOTS=1` (macOS goldens are not of record).
- CG7: emulator API 35 shots (blur vs tint vs reduce); frame timing: scrolling under glass top bar p50 29ms/p90 53ms with blur vs 16/27ms tint (software-GPU emulator, debug build); sheet open p50 16ms both, p90 29 vs 27ms.
- CG8: README Glass, parity, CHANGELOG 0.2.0 Unreleased, api dumps.
- Checks: spotlessCheck, apiCheck, :kit:allTests (-x iosSimulatorArm64Test) 267 tests 0 failures, :kit:compileKotlinIosSimulatorArm64, :sample:assembleRelease (R8): BUILD SUCCESSFUL. `verifyRoborazziJvm` on macOS: 15 failures, identical to origin/main (glyph rasterization), none from glass.
- Phase B: lens samples inward (Android clips RenderEffect inputs to the surface clip, so outward samples came back transparent and truncated the right/bottom of the card); thickness shading is stacked strokes so no hard inner edge. Resolver variant tests (6), `LiquidRenderTest` (5: edge displacement vs center, frosted ignores the lens switch, liquid differs from frosted, press brightens). Frosted pixels hashed identical between 557420c and the Phase B tree (Glass and GlassClear scenes).
- Perf (emulator API 35, software GPU, debug, 12 swipes under the glass TopBar): frosted p50 17 / p90 31 / p99 65 ms, janky 6.6%; liquid p50 17 / p90 26 / p99 32 ms, janky 3.3% (one first-use shader compile outlier in gpu p99).
