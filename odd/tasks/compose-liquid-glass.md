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
- [ ] CG0 ODD document. Route: inline.
- [ ] CG1 Spike: confirm `GraphicsLayer.renderEffect`/`BlurEffect`/`ColorFilter` on Compose 1.8.2 (desktop Skiko render, Android emulator), confirm overlays are in-tree. Route: inline.
- [ ] CG2 Material model: `SurfaceMaterial`, `UiStyle`, theme flags, nested/accessibility resolution, pure resolver + JVM tests. Route: inline.
- [ ] CG3 Rendering: `GlassState`, `glassSource`, `Modifier.material`, `MaterialSurface`, tint + blur paths, `OverlayHost` source. Route: inline.
- [ ] CG4 Platform signals: expect/actual for blur support, reduce transparency, high contrast (Android, iOS, JVM). Route: inline.
- [ ] CG5 Component integration: Sheet, Dialog, Menu, Toaster, Card `material`; new `TopBar`, `ActionBar`. Route: delegated writer if over 4 non-trivial files, else inline.
- [ ] CG6 Tests and goldens: resolver tests, UI tests, provisional shots. Route: inline.
- [ ] CG7 Sample "Glass" screen over busy content, emulator screenshots (real blur vs fallback), frame timing. Route: inline.
- [ ] CG8 Docs: README "Glass", `docs/parity.md`, CHANGELOG 0.2.0 Unreleased, api dumps. Route: inline.

## Acceptance
- Defaults: Default style keeps every surface exactly as before; Glass style turns only chrome to glass; Card is solid unless `material` is given.
- Nested glass is solid-ish (float); reduceTransparency/highContrast force opaque with border.
- Blur on Android 31+, desktop, iOS (compile verified); tint fallback otherwise.
- `apiCheck`, `spotlessCheck`, `:kit:allTests -x :kit:iosSimulatorArm64Test`, `:kit:compileKotlinIosSimulatorArm64`, `:sample:assembleRelease` green.

## Progress and verification evidence
(filled per task)
