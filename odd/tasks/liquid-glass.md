# Liquid Glass in @jcsoftdev/ui (0.3.0)

## Objective
Follow Apple's Liquid Glass model in the web kit: a first-class glass material (regular and clear) for the control/navigation layer, solid content surfaces by default, correct accessibility fallbacks, and an opt-in refraction enhancement. Every surface component can opt into glass, none does it by default except the chrome layer when the glass preset is active.

## Apple principles honored (sources)
User decision 2026-10-12: "todo como la de apple".
- Materials (HIG): https://developer.apple.com/design/human-interface-guidelines/materials
- WWDC25 "Meet Liquid Glass": https://developer.apple.com/videos/play/wwdc2025/219/
- WWDC25 "Get to know the new design system": https://developer.apple.com/videos/play/wwdc2025/356/
- Applying Liquid Glass to custom views (SwiftUI): https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

Note: the Apple pages are JavaScript-rendered; an automated fetch returned only the page title, so the principles below come from the owner's brief and could not be re-verified line by line in this run.

1. Glass is a functional layer for controls and navigation floating above content (toolbars, tab bars, nav, dock, menus, popovers, sheets, dialogs, floating buttons).
2. Not on the content layer: cards, lists, tables, chat bodies stay solid.
3. Avoid glass on glass: a glass element inside glass falls back to a more solid tint.
4. Two variants: regular (adaptive, legible) and clear (more transparent, needs a dimming layer over bright content).
5. Lensing/refraction at the edges, specular highlights, adaptive shadow.
6. Adapts to Reduce Transparency (opaque), Increase Contrast (solid + border), Reduce Motion, forced colors.
7. Concentric shapes and capsule/rounded geometry (the existing radius tokens already do this).

## Scope
- In: `packages/ui` tokens, generator (`scripts/build-theme.mjs`), generated CSS/JSON/Kotlin, components, stories, tests, site docs guide, CHANGELOG.
- Out: publishing, tagging, pushing, PRs. The Compose side consumes the generated Kotlin later.

## Constraints
- Zero runtime dependencies (no new `dependencies` in `packages/ui/package.json`).
- Perf: blur radius 8-20px, never on repeated list items, no nested backdrop-filters, never tween blur radius.
- Refraction is opt-in, Chromium only, never default.
- English artifacts, Conventional Commits, no AI attribution. Do not push.

## TDD mode
Disabled (owner override: implement first, tests that protect the change in the same commit). Runner: `node --test` (`pnpm test`), `vitest --project stories` (`pnpm test:stories`), esbuild-bundled render cases in `test/components`.

## Delivery strategy
`ask-on-risk` default; direct commits on `feat/liquid-glass` in worktree `/Users/jcsoftdev/personal/ui-glass`, one work unit per commit. No push.

## Tasks
- [ ] G0 Research + this document. Route: inline.
- [ ] G1 Tokens and materials (`--glass-regular-*`, `--glass-clear-*`, all presets, backward-compatible `--surface-*` aliases, JSON + Theme.kt generation). Route: inline (generator + JSON are one coherent unit).
- [ ] G2 Utilities (`glass`, `glass-clear`) and fallbacks (@supports, reduced transparency, more contrast, forced colors, reduced motion), specular layer, noise token default off. Route: inline.
- [ ] G3 Component mapping: chrome keeps glass, content surfaces solid, glass-on-glass protection, scrims, opt-in `material` prop on surface components, no blur tween. Route: delegated if more than 4 non-trivial files, else inline.
- [ ] G4 Refraction opt-in (SVG displacement filter, runtime feature detect). Route: inline.
- [ ] G5 Stories and tests (busy imagery, variants, fallbacks, contrast; style-presets and token-generation tests). Route: inline.
- [ ] G6 Docs (site "Glass" guide, CHANGELOG, migration notes). Route: inline.

## Acceptance criteria
- G1: every preset declares the glass tokens; the glass preset only tunes them; `--surface-*` still resolve; generated JSON/CSS/Kotlin in sync.
- G2: `glass` and `glass-clear` render blur + tint + specular in Chromium; with `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` or no backdrop-filter support they are opaque with a border.
- G3: defaults stay Apple-like (chrome glass when the glass preset is active, content solid, no backdrop-filter on `surface-card`). Opt-in: every surface component (Card, ItemCardGroup, KpiGroup, ResponsiveList, Dialog, Drawer, Popover, ...) can be switched to `solid` | `glass` | `glass-clear` via a `material` prop or the utility through `className`, a Card opted into glass renders blur + fallbacks, and glass-on-glass protection and fallbacks keep working when opted in. Theme-level default per family only if cheap (recorded below if skipped).
- G4: refraction applies only with the opt-in attribute and a positive runtime probe; plain blur otherwise.
- G5/G6: stories, tests, docs, changelog and migration notes present; full checks green.

## Checks
In `packages/ui`: `pnpm lint`, `typecheck`, `test`, `build`, `check:treeshake`, `check:dist-imports`, `check:docs-examples`, `test:stories`; root `pnpm build:site`; browser visual check and a performance trace.

## Progress and verification evidence
(updated per task)
