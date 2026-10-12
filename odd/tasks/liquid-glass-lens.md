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

## Constraints
Zero runtime deps. Token changes limited to shared glass tokens (another branch moves tokens). English, Conventional Commits, no AI attribution, no push. TDD: disabled (implement, then protect with tests). Runner: node --test, vitest projects stories/glass.

## Tasks
- [ ] LG0 This document + sources.
- [ ] LG1 CSS liquid look, cross-browser base (rim, depth, saturation/blur, tokens `glass-rim`, `glass-depth`), contrast retuned.
- [ ] LG2 Press/hover flex (reduced motion safe, no blur animation).
- [ ] LG3 Lens engine: SDF + Snell displacement map, dispersion, DPR, budgets.
- [ ] LG4 Auto opt-in (lazy hook in glass components, opt-out), tree-shaking preserved.
- [ ] LG5 Stories (before/after, photo, text, light/dark) and tests.
- [ ] LG6 Visual iteration (Chromium + WebKit) and performance numbers.
- [ ] LG7 Docs, CHANGELOG, final checks.

## Acceptance
Lens active by default on glass components in Chromium; plain layered look elsewhere; ink and ink-2 >= 4.8 on all backdrops (lens on and off); fallbacks for reduced transparency/contrast/forced colors/motion unchanged; non-glass presets unchanged; filters bounded; all checks green.

## Checks
lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, test:stories, test:glass, root build:site.

## Progress
(updated per task)
