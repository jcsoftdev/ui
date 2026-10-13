# Compose Liquid Glass: configuration, optics, motion, merge (ui-compose)

## Objective
Make the Compose Liquid Glass configurable and alive: a `LiquidGlassStyle` (app-wide through the theme, overridable per surface), richer optics in the lens shader, press/drag motion with springs, and a `GlassEffectContainer` that merges neighbouring glass shapes with an SDF smooth union.

## Constraints
- Branch `feat/compose-liquid-glass`, worktree `/Users/jcsoftdev/personal/ui-compose-glass`, gradle root `packages/ui-compose`. No push, PR or tag.
- Public API source-compatible; `apiDump` updated deliberately; new signatures listed in CHANGELOG.
- Parameter set mirrors ybouane's list (names only, no code or constants copied); motion springs/ideas from liquidglass.dev (MIT) and Kyant backdrop (ideas only).
- Defaults keep `GlassContrastTest` green and existing floors unchanged. Custom low-opacity styles drop the contrast guarantee (KDoc).
- Respect reduced motion (`Motion.enabled` false) for every animation.
- TDD disabled (owner override): implement, then tests that protect the change.

## Route
Single delegated writer (this agent); work-unit commits on the feature branch.

## Tasks
- [x] LS1 `LiquidGlassStyle` model, presets, `LocalLiquidGlassStyle`, `UiTheme(liquidGlassStyle)`, tests for defaults/presets/mapping.
- [x] LS2 Shader optics: profile Rim/Full/Dome, fresnel, specular angle, grain, brightness, size-scaled thickness/shadow, shadow offset; uniform mapping; per-profile no-crease tests.
- [x] LS3 Motion: springs, press lift + swell, materialize, Drag velocity squash with jelly settle, touch glow, pointer-follow highlight, reduced-motion gating; tests.
- [x] LS4 `GlassEffectContainer` + `Modifier.glassEffect`: SDF smooth union shader (AGSL/SkSL), capped shapes, separate-shape fallback; tests.
- [x] LS5 Screenshots, CHANGELOG, apiDump, final checks.

## Progress and verification evidence
- Commits: 8163af6 (style model), 0da370c (optics, dynamics, merge shader); container, tests, shots, sample, apiDump and CHANGELOG in the commits that follow on the branch.
- Shadow finding: Skiko layer shadows (Modifier.shadow and GraphicsLayer.shadowElevation) did not render below a translucent glass surface in the pixel tests and cannot be offset, so the Liquid shadow is now a stack of faint silhouettes (same on every target, supports offsetY; default offsetY 3dp).
- Test-scene finding: `Modifier.size` inside the OverlayHost is overridden by tight parent constraints; the new tests use `wrapContentSize(TopStart).size(...)` so the surface really is 120x60.
- Merge shader: gradient measured over a step and not normalized so the neck of merged shapes has no cusp.
- Checks (packages/ui-compose): spotlessCheck, apiCheck OK; :kit:allTests -x iosSimulatorArm64Test OK (jvmTest 245 tests, 11 skipped gated shots, 0 failures; Android unit debug 73, release 73, 0 failures); :kit:compileKotlinIosSimulatorArm64, :kit:compileDebugKotlinAndroid, :sample:assembleRelease OK.
- Device: sample StyleLab section on emulator API (AGSL compiles, merged container, profiles, drag pill) at scratchpad/cg2/android-stylelab.png; desktop shots in scratchpad/cg2.
