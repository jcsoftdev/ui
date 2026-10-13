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
- [x] LS6 Correction pass after independent review (HEAD 7f8e1b8): C1 container style/material precedence via CompositionLocal; C2 swell/squash backdrop alignment; C3 single touching source + consumed-event filter; C4 per-frame allocations; C5 contrast cap + render contrast test; C6 stronger/reduced-motion tests; C7 slot claim lifecycle; C8 multi-pointer + time decay; C9 merged shadow (fix if cheap, else document). Route: single delegated writer (this agent), inline.
- [x] LS7 Sample playground: full-screen Liquid Glass playground (photo/gradient backdrops with CC0 credits, freely draggable glass panel with Drag squash, a labeled control for every `LiquidGlassStyle` field, Clear/Regular/Thick presets, reset, copy-code snippet, GlassEffectContainer merge tab with draggable pills, adaptive bottom/side panel, accessible sliders). Sample resources only; kit untouched. Route: single delegated writer (this agent), inline.

- [x] LS8 Convex profile + `LiquidGlassStyle.Crystal` (clear thick acrylic lens: whole-surface minify and outward rim bend, no fold; reads past its bounds up to the backdrop source), no-fold Jacobian test, playground default.

## Progress and verification evidence
- Commits: 8163af6 (style model), 0da370c (optics, dynamics, merge shader); container, tests, shots, sample, apiDump and CHANGELOG in the commits that follow on the branch.
- Shadow finding: Skiko layer shadows (Modifier.shadow and GraphicsLayer.shadowElevation) did not render below a translucent glass surface in the pixel tests and cannot be offset, so the Liquid shadow is now a stack of faint silhouettes (same on every target, supports offsetY; default offsetY 3dp).
- Test-scene finding: `Modifier.size` inside the OverlayHost is overridden by tight parent constraints; the new tests use `wrapContentSize(TopStart).size(...)` so the surface really is 120x60.
- Merge shader: gradient measured over a step and not normalized so the neck of merged shapes has no cusp.
- Checks (packages/ui-compose): spotlessCheck, apiCheck OK; :kit:allTests -x iosSimulatorArm64Test OK (jvmTest 245 tests, 11 skipped gated shots, 0 failures; Android unit debug 73, release 73, 0 failures); :kit:compileKotlinIosSimulatorArm64, :kit:compileDebugKotlinAndroid, :sample:assembleRelease OK.
- Device: sample StyleLab section on emulator API (AGSL compiles, merged container, profiles, drag pill) at scratchpad/cg2/android-stylelab.png; desktop shots in scratchpad/cg2.
- LS6 correction (C1-C9): all nine findings addressed except the smooth neck shadow (C9 partly: union of shapes, no doubling, Generic outline shadow, no shadow under tint; shadow under a wide neck documented, not drawn from the merged SDF). Route: inline single writer. Checks: :kit:allTests -x iosSimulatorArm64Test --rerun-tasks OK (jvmTest 271, 11 skipped gated shots; Android unit debug 79, release 79; 0 failures), apiCheck, spotlessCheck, :kit:compileKotlinIosSimulatorArm64, :sample:assembleRelease OK. Commits: see git log after 7f8e1b8.
- LS8 commit cfa9155 (Convex + Crystal, apiDump, tests: no-fold Jacobian at max refraction for pill/rect/rounded rect, preset values). Screenshot scratchpad/cg3/crystal.png.
- LS7 playground: sample-only (Android; the repo has no desktop sample module, so wide layout is untested on desktop). Photos CC0 from Wikimedia Commons (sample/CREDITS.md). Checks: :kit:jvmTest apiCheck spotlessCheck :sample:assembleRelease :sample:testDebugUnitTest OK (jvmTest 274 tests, 0 failures; sample unit 4). Emulator-5554 screenshots in scratchpad/cg3.
