# Liquid Glass lensing (feat/liquid-glass-lens)

## Objective
Owner feedback 2026-10-12: "the glass is only a blur, it is not like Apple's". Rework the glass so it reads as Liquid Glass: lensing on by default where supported, a layered specular/thickness look everywhere, interactive flex, with the PR #32 accessibility and contrast guarantees intact.

## Apple principles and sources
- Lensing: "The primary way Liquid Glass visually defines itself is through something called Lensing"; earlier materials scattered light, this one "dynamically bends, shapes, and concentrates light". WWDC25 219 "Meet Liquid Glass": https://developer.apple.com/videos/play/wwdc2025/219/ (transcript fetched).
- Specular highlights that respond to geometry (and move with interaction/device motion), shadows that grow over text, per-layer light/dark adaptation, Regular (adaptive) vs Clear (permanently more transparent, needs dimming), press "illuminates from within", "flexing and energizing with light", larger glass is "thicker": deeper shadows, stronger lensing (same session).
- "reflects and refracts its surroundings", "specular highlights": Apple Newsroom https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- HIG Materials https://developer.apple.com/design/human-interface-guidelines/materials : JS-rendered, not readable by fetch; session 356 not retrieved (unverified).
- Web recreation: kube.io, Snell's law (n 1.5), convex squircle height profile y=(1-(1-x)^4)^(1/4), normal by finite difference, displacement along one radius normalised by its max, encoded r=128+x*127, g=128+y*127, `feDisplacementMap` scale = max displacement, sRGB interpolation, Chromium-only `backdrop-filter:url()`: https://kube.io/blog/liquid-glass-css-svg/
- Other demos (not verified line by line): https://github.com/shuding/liquid-glass, https://github.com/rdev/liquid-glass-react (aberration, displacement scale, partial Safari/Firefox support).
- Dispersion via per-channel displacement scales is the common technique but was not confirmed in a source; we measure our own.

## Scope update (2026-10-12, owner)
Keep both looks as variants. Frosted (`glass`, `glass-clear`, `material="glass"|"glass-clear"`) is unchanged and pinned by a golden CSS test. New liquid variant: `liquid`, `liquid-clear`, `material="liquid"|"liquid-clear"`. Global switch: `data-glass="liquid"` on `<html>` or a scope (affects `glass`, `glass-clear` and, in the glass preset, `surface-overlay/nav/side`; never `surface-card`). Limitation: no nested `data-glass="frosted"` override.

## Constraints
Zero runtime deps. Token changes limited to shared glass tokens (another branch moves tokens). English, Conventional Commits, no AI attribution, no push. TDD: disabled (implement, then protect with tests). Runner: node --test, vitest projects stories/glass.

## Tasks
- [x] LG0 This document + sources.
- [x] LG1 CSS liquid look, cross-browser base (rim, depth, saturation/blur, tokens `glass-rim`, `glass-depth`), contrast retuned.
- [x] LG2 Press/hover flex (reduced motion safe, no blur animation).
- [x] LG3 Lens engine: SDF + Snell displacement map, dispersion, DPR, budgets.
- [x] LG4 Auto opt-in (lazy hook in glass components, opt-out), tree-shaking preserved.
- [x] LG5 Stories (before/after, photo, text, light/dark) and tests.
- [x] LG6 Visual iteration (Chromium + WebKit) and performance numbers.
- [x] LG7 Docs, CHANGELOG, final checks.

## Acceptance
Lens active by default on glass components in Chromium; plain layered look elsewhere; ink and ink-2 >= 4.8 on all backdrops (lens on and off); fallbacks for reduced transparency/contrast/forced colors/motion unchanged; non-glass presets unchanged; filters bounded; all checks green.

## Checks
lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, test:stories, test:glass, root build:site.

## Progress
- Tokens: only new shared `liquid-*` tokens (12) in `tokens/default.json`; utilities generated into theme.css (`liquid`, `liquid-clear`, gated liquid blocks inside the frosted utilities). No change to existing tokens.
- Rim and thickness are inset box-shadows, not pseudo-elements: pseudo rims scroll away inside overflow containers (Dialog, Drawer) and collide with component pseudos.
- Lens: SDF rounded rect + Snell squircle profile PNG map (R,G offsets, B = softness); blur and veil live inside the SVG filter so the rim stays sharp and the middle frosted; the CSS veil is switched off through `--glass-veil` while a lens is active. Veil floor 0.5 at the very edge.
- Auto opt-in: `useGlassLens` (tiny, static) dynamic-imports `refraction.js` only if computed `--glass-lens` is 1. Button bundle has 0 glass modules; Dialog gets a 7.5 KB lazy chunk with splitting (inlined without).
- Budgets: 8 lenses, 640k px2, dispersion <= 100k px2 by default (measured +50..100% cost), rebuild throttle 90 ms, map cache 8, one rAF pass.
- Contrast: liquid veils retuned (regular .2 tint + .7 dim light, .36 + .66 dark; clear dim .8/.66); ink/ink-2 >= 4.8 for liquid and liquid-clear, with and without lens (inner 60% of the surface).
- Perf (headless Chromium, software, DPR 2, unthrottled loop, backdrop scrolling): no lens 0.1 ms/frame; nav 1280x56 lens+dispersion 6.2 ms, no dispersion 4.0; dialog 520x320 18.9 / 8.9. Map build 1-7 ms at 2x.
- WebKit: Playwright WebKit 27.2 does not paint backdrop-filter blur at all (frosted either), so only the rim/depth layers could be verified there.
- Checks: lint (10 pre-existing warnings), typecheck, test 531, build, check:treeshake, check:dist-imports, check:docs-examples, test:stories 1407, test:glass 164, root build:site 435 pages.
