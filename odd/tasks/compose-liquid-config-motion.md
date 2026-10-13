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
- [ ] LS1 `LiquidGlassStyle` model, presets, `LocalLiquidGlassStyle`, `UiTheme(liquidGlassStyle)`, tests for defaults/presets/mapping.
- [ ] LS2 Shader optics: profile Rim/Full/Dome, fresnel, specular angle, grain, brightness, size-scaled thickness/shadow, shadow offset; uniform mapping; per-profile no-crease tests.
- [ ] LS3 Motion: springs, press lift + swell, materialize, Drag velocity squash with jelly settle, touch glow, pointer-follow highlight, reduced-motion gating; tests.
- [ ] LS4 `GlassEffectContainer` + `Modifier.glassEffect`: SDF smooth union shader (AGSL/SkSL), capped shapes, separate-shape fallback; tests.
- [ ] LS5 Screenshots, CHANGELOG, apiDump, final checks.

## Progress and verification evidence
(filled as work lands)
