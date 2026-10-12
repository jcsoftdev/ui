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

## Correction pass (verifier FAIL on b67bf82)
- [x] H1 `Card` is a server component again: only glass cards (material glass/liquid or a glass utility in className) render the client `CardLens`. Other wired components already had "use client". New `pnpm check:rsc` (test/rsc.mjs): walks the dist import graph of every JSX module, fails on server-side use of client-only React APIs or calling a hook imported from a client module, then imports every server module under `--conditions=react-server` with client modules stubbed. Fails on b67bf82 (card.js calls useGlassLens), passes now. Story/site demos and `showcase/` are excluded (not package entries).
- [x] H2 `useGlassLens` re-evaluates on class/data-glass/data-glass-lens/data-style/data-theme mutations of the element and every ancestor and on preference media changes; starts and stops the engine accordingly. Tests: liquid->glass, data-glass removed, glass->liquid, runtime switch-on, opt-out toggled (all fail on b67bf82).
- [x] M1 area and dispersion budgets are checked in `update()` (resize): over MAX_AREA drops the lens and watches the size; crossing the dispersion area rebuilds. Entrance sizes are handled because every resize re-checks.
- [x] M2 surfaces without a free slot wait in a queue and are woken when a slot frees.
- [x] M3 `useGlassLens` composes the consumer ref with `useComposedRefs` (cleanup + identity change honoured).
- [x] Low: compare stories use the real lens (Pane, GlassButton); ActionBar story wrapped to full width; dispersion 0.08 -> 0.05; popper nested in liquid dialog browser test.

## Closer to Apple (second work unit)
Sources: kube.io/blog/liquid-glass-css-svg, rdev/liquid-glass-react, liquid-glass-js, Kyant0 backdrop, flutter liquid_glass_renderer, WWDC25 #219 (as relayed by the coordinator; not re-fetched).
- Bevel width = corner radius, clamped to [10, 30% of short side, 36]; lens strength = bevel width (12..36 px); the centre is undisplaced.
- Blur 4px regular / 1.5px clear (was 10/3), saturate 1.5 light / 1.45 dark (was 2/1.9).
- Veil: regular dim .6 light / .54 dark (was .7/.66), clear .47 / .38 (was .8/.66). Text halo token `liquid-halo` (text-shadow, inherited) as the content-side scrim. New `liquid-shadow` token (deeper outer shadow; adaptive-to-backdrop shadow is not possible in CSS, so it is a token).
- Contrast floors for liquid relaxed and documented in the test: regular ink 4.5 / ink-2 3.5, clear ink 4.5 / ink-2 2.0 (frosted unchanged at 4.8). Reaching 4.8 needs the old .7+ veil, which is what made it look like frosted plastic.
- Directional specular: second `feImage` (R glint, G contour, B inner shadow) from `computeSpecularField`; glint = lensed backdrop at saturate 6, slope 1.5, plus 0.55 white, masked by a 1.4px light wall facing the upper left (-120 deg), half strength opposite; 0.75px dark contour; 9px faint inner shadow. Cached with the displacement maps (16 entries).
- Dispersion 0.05 (small surfaces only).
- Materialise: refraction scale ramps 0 -> target in 280 ms on the first install of a controller; press lifts it to 1.35x (120 ms in, 220 ms out) on interactive surfaces. Not run under reduced motion (the lens is off there).
- Not done: SDF merging (infeasible in SVG).
- Perf (software Chromium, DPR 2, unthrottled): no lens 0.07 ms; nav 12.0 ms (dispersion), 6.1 (none); dialog 24.8 / 15.9. The extra feImage and layers roughly double the previous cost; still only paid while the backdrop changes.
- Screenshots: scratchpad `liquid2/` (v2b-*: liquid over photo and text, light/dark, plus the frosted reference), next to the earlier ones in `liquid/`.

## Cleaner lens, full-surface coverage (third work unit)
Feedback: the v2b screenshots looked milky, stripes blurred rather than bent, a serrated edge, weak rim; reference is the Compose Liquid pill (cg/u4.png) and the user wants the lens on the whole surface.
- Sawtooth root cause: fold-over. The Snell profile with strength = bevel width made `depth + offset(depth)` non-monotonic (offset falling faster than 1 px per px), so output pixels sampled source pixels in reverse and straight stripes broke into a repeating serration. (The hard, unantialiased gradient stripes of the fixture backdrop also stair-step when magnified; the fixture stripes now have soft edges.) Fix: profiles with slope <= 1.5 and amplitude <= 0.58 of the bevel (rim) or the quadratic dome with amplitude <= 0.4 of the half size (full). Regression test: `the default lens cannot fold` (both coverages, several shapes, DPR 1 and 2) plus profile slope bounds.
- Coverage: default `full`: per-axis dome `-sign(x) A (x/hx)^2`, no diagonal crease (a distance-field normal would have one), zero at the centre without a kink, `A = min(0.4 half size, 24 px)`; `rim` keeps the bevel (1.2 x radius, max 45% of the short side). Token/option: `--glass-lens-coverage: rim` or `coverage`. Veil/blur easing keeps the rim-width soft band.
- Veil: adaptive inside the filter (luminance of the lens blurred 7 px; light veil over dark areas in light theme, dark veil over light areas in dark theme), strength 0.85 x the token alpha; CSS tint dropped while the lens is on (`--glass-lens-tint`). The uniform CSS veil stays for the non-lens fallback and its tests.
- Blur 2 px / 0.6 px; saturate 1.5; glint: lensed backdrop at saturate 2.5 plus white 0.8, 3 px wide with an ambient ring; dispersion off by default (CSS var `--glass-lens-dispersion` or option; budgets kept).
- Contrast floors: no lens: unchanged from unit 2. Lens on: smooth photo ink 4.5 / ink-2 2.0 (measured 5.35 / 2.19), hard stripes ink 2.0 / ink-2 1.0 (halo not counted). Documented.
- Pre-existing: `ActionBar` collapses to ~32 px wide with `w-fit` because `@container/action-bar` size-contains the inline axis; the fixture passes an explicit width, not fixed here.
- Screenshots: scratchpad `liquid3/` (v3-* intermediate, v4-kit-{photo,text}-{light,dark}.png final: card, clear card, action bar, capsule; compare-pill-vs-web.png next to the Compose pill; zoom-left-before/after).

## No facets (fourth work unit)
Feedback v4: "parece un diamante con solo 4 lados".
- Diagnosis: the coordinator's (SDF/edge-distance gradient creases along the diagonals) is right in kind; the v4 field was per-axis (`-sign(x) A (x/hx)^2` on x and y separately), which is also a pyramid-like read: each triangle of the shape is dominated by one axis.
- Fix: superellipse dome. `r = (|u|^3 + |v|^3)^(1/3)`, pull along the gradient of `r` in the normalised (u, v) plane (normalised, not scaled by 1/hx, 1/hy, otherwise the direction rotates too fast at the ends of a wide nav and the map folds), magnitude `A (r / r_corner)^1.5`, `A = min(0.55 x smaller half size, 24 px)`. Continuous gradient except at the exact centre where the pull is zero (C1). Exponent 3 sits between an ellipse (round drop) and a slab.
- Tests: `full coverage has no facets` (direction continuity across the four diagonals at four radii, five aspect ratios), a negative control that the detector flags a hip-roof field, `never folds in 2D` (Jacobian of the sampling map > 0.05 on a grid, four shapes at 2x).
- Yellow circle cut at the right of "Liquid clear": the lens, not the fixture. The pull at the silhouette is about 0.7 A (up to 17 px at 24 px), so a backdrop shape crossing the edge jumps there by that much, like real glass at the rim. Kept; lowering `FULL_CAP` shrinks it.
- Screenshots: scratchpad `liquid4/` (`v5-kit-{photo,text}-{light,dark}.png`, `zoom-card-straight-stripes.png`).
