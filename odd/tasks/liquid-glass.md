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
- [x] G0 Research + this document. Route: inline. Commit docs(odd).
- [x] G1 Tokens and materials (`--glass-regular-*`, `--glass-clear-*`, all presets, backward-compatible `--surface-*` aliases, JSON + Theme.kt generation). Route: inline (generator + JSON are one coherent unit).
- [x] G2 Utilities (`glass`, `glass-clear`) and fallbacks (@supports, reduced transparency, more contrast, forced colors, reduced motion), specular layer, noise token default off. Route: inline.
- [x] G3 Component mapping: chrome keeps glass, content surfaces solid, glass-on-glass protection, scrims, opt-in `material` prop on surface components, no blur tween. Route: delegated if more than 4 non-trivial files, else inline.
- [x] G4 Refraction opt-in (SVG displacement filter, runtime feature detect). Route: inline.
- [x] G5 Stories and tests (busy imagery, variants, fallbacks, contrast; style-presets and token-generation tests). Route: inline.
- [x] G6 Docs (site "Glass" guide, CHANGELOG, migration notes). Route: inline.

## Acceptance criteria
- G1: every preset declares the glass tokens; the glass preset only tunes them; `--surface-*` still resolve; generated JSON/CSS/Kotlin in sync.
- G2: `glass` and `glass-clear` render blur + tint + specular in Chromium; with `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` or no backdrop-filter support they are opaque with a border.
- G3: defaults stay Apple-like (chrome glass when the glass preset is active, content solid, no backdrop-filter on `surface-card`). Opt-in: every surface component (Card, ItemCardGroup, KpiGroup, ResponsiveList, Dialog, Drawer, Popover, ...) can be switched to `solid` | `glass` | `glass-clear` via a `material` prop or the utility through `className`, a Card opted into glass renders blur + fallbacks, and glass-on-glass protection and fallbacks keep working when opted in. Theme-level default per family only if cheap (recorded below if skipped).
- G4: refraction applies only with the opt-in attribute and a positive runtime probe; plain blur otherwise.
- G5/G6: stories, tests, docs, changelog and migration notes present; full checks green.

## Checks
In `packages/ui`: `pnpm lint`, `typecheck`, `test`, `build`, `check:treeshake`, `check:dist-imports`, `check:docs-examples`, `test:stories`; root `pnpm build:site`; browser visual check and a performance trace.

## Progress and verification evidence
- G1 (inline: one generator + JSON unit): 21 `glass-*` tokens (regular/clear x tint, blur, saturate, filter, border, edge, shadow, dim, fallback, plus sheen, noise, nested-tint) added to `styles.tokens`, so every preset declares them; the glass preset tunes blur/saturate and maps `surface-filter`/`surface-overlay` to them, `surface-card`/`surface-control` are opaque. `surface-alpha/blur/filter` kept as aliases. `UiGlass`/`GlassMaterial` emitted in both Theme.kt flavours (only when glass tokens exist). `pnpm test`: 512 pass, 0 fail (new `test/glass-tokens.test.mjs`).

- G2 (inline): `@utility glass` and `glass-clear` (decision: utilities, matching `surface-card`/`surface-overlay`; no attribute for the material). Opaque `--glass-*-fallback` is the base; blur/tint/sheen/noise/dim only inside `@supports (backdrop-filter)`; `prefers-reduced-transparency`, `prefers-contrast: more` (solid + line-strong ring) and `forced-colors` (Canvas + CanvasText outline) override; nested inside `.glass`/`.glass-clear`/`.surface-overlay` they use `--glass-nested-tint` with no filter. Specular highlight = inset top shadow + diagonal sheen gradient (no pseudo-elements). `surface-card` lost its backdrop-filter; `surface-overlay` gained the same fallbacks. Verified compiled by Tailwind 4.3.3 (`@tailwindcss/node`). Reduced motion: the material has no motion of its own; refraction (G4) and entrance animations honor it.
- G3 (inline: mechanical plumbing across 12 small files, no research): chrome (Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, CommandPalette, ActionBar, chart/sparkline tooltips, source/emoji/map/attachment/conversation overlays) keeps `surface-overlay`; stray `bg-surface-overlay` (translucent without blur) replaced by the utility. New `surface-nav`/`surface-side` tokens + utilities: Topbar and Sidebar are glass in the glass preset, opaque otherwise. Content (`surface-card` users) never blurs. Opt-in: `material?: "solid" | "glass" | "glass-clear"` on Card, Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, CommandPalette, ActionBar, Topbar, Sidebar; every other surface (ItemCardGroup, KpiGroup, ResponsiveList, DataGrid, Kanban ...) opts in with `className`/`classNames` (`glass`, `glass-clear`), because `cn` now treats `surface-card|overlay|nav|side|solid|glass|glass-clear` as one merge group (last wins). `surface-solid` utility forces opaque. Glass-on-glass: `.glass`, `.glass-clear`, `.surface-overlay` ancestors force nested glass to the near-solid `--glass-nested-tint` (DOM nesting only; portaled menus opened from a glass dialog are not DOM descendants, documented limitation; use `material="solid"` there). Clear glass carries its own dimming layer, so no extra scrim is needed. The kit ships no enter/exit animation on blur; docs forbid tweening `backdrop-filter`. SKIPPED: theme-level default material per component family (needs a runtime attribute channel, not cheap); recipe is overriding `--surface-*` tokens in a scope, or `className`. Tests: `test/material.test.mjs` (cn merge, materialClass, Card/ActionBar/Topbar markup), 4 pass.
- G4 (inline): new entry `@jcsoftdev/ui/glass` (`src/glass`): `applyGlassRefraction(el, opts)` / `useGlassRefraction()` build an SVG `feImage` + `feDisplacementMap` filter (displacement map generated as an SVG data URI by `createDisplacementMap`, sized from the element via ResizeObserver) and set `backdrop-filter: <base blur> url(#id)` plus `data-glass-refraction="on"`. Detection (`supportsBackdropRefraction`): feature allow-list, not UA sniffing: `CSS.supports('backdrop-filter','url(#x) blur(1px)')` AND `SVGFEDisplacementMapElement` AND the Blink-only property `-webkit-app-region` (Safari parses url() backdrop filters and paints nothing, so CSS.supports alone cannot gate it; a pixel probe is impossible from script); `refraction: "force"` overrides the engine check. Never applied under `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` or `prefers-reduced-motion`. Opt-in only, zero deps. Specular highlight = existing inset edge + sheen layers (unchanged by the filter). Tests: `test/glass-refraction.test.mjs`.
- G5 (inline): Storybook `Foundations/Liquid Glass` (variants over busy CSS imagery, glass on glass, content solid vs card `material`, refraction, glass dialog; each with a play assertion). New vitest browser project `glass` (`pnpm test:glass`, `src/glass/glass.browser.test.tsx`, real Chromium, CDP media emulation): glass/clear blur + veil, card never blurs, overlay solid vs glass preset, Card `material`, nested glass, reduced transparency / more contrast / forced colors fall back to opaque, refraction applies and cleans up, and a screenshot-based contrast measurement of ink against the worst-case stripe backdrop (4.5:1, light/dark, regular/clear). The measurement found that clear glass in the light theme failed with a black veil (4.30, then 3.43 when darkened); the light veil is now white (`rgba(255,255,255,.4)`) so it pushes the backdrop away from the dark ink. Node tests: `test/glass-tokens.test.mjs`, `test/style-presets.test.mjs` updated.
- G6 (inline): site guide `docs/glass` (Theming sidebar), theming.md updated, site landing nav and Starlight header use the glass tokens with `@supports` and reduced-transparency/contrast fallbacks, CHANGELOG `0.3.0 (unreleased)` with migration notes. `pnpm build:site` builds 435 pages.
- Visual and perf check (Playwright chromium; the chrome-devtools MCP is not installed in this session): screenshots of regular/clear/solid over busy imagery (light, dark), glass dialog in the glass preset (light, dark), reduced-transparency and more-contrast fallbacks, card opt-in, glass on glass, refraction. Refraction check found the first displacement map was asymmetric and non-neutral; rebuilt with neutral middle and opposite-edge ramps, verified on a plain striped backdrop at 1x and 2x DPR. Note: Chromium ignores filter functions placed after `url()` in `backdrop-filter`, so the blur stays first and the lens last. Frame timing (headless, rAF deltas, 180 scroll frames over a fixed glass nav and 40 frames of a glass dialog fade/scale in): glass avg 16.67 ms, p95 16.7, max 16.8, 0 frames over 20 ms; solid baseline identical. Headless software compositing; real GPUs are not measured.

## Correction pass (verifier FAIL on c2a3864)
- F1 (text legibility on glass) and F2 (non-glass presets must be untouched): c27084d. Contrast is now measured against solid white, solid black, split, stripes and photo-like backdrops with ink and ink-2; the non-glass equivalence matrix (default/dark/glass/flat/elevated x normal/reduced-transparency/more-contrast/forced-colors) is covered by the browser project. Verifier rerun: contrast min 8.18 (ink), contrast2 min 4.55 (ink-2); matrix shows non-glass presets resolve to the same opaque surfaces as before.
- F3 (glass nesting) and F4 (portaled overlays opened from glass): 4d8edf4. Popper marks content with `data-glass-nested` when its anchor sits inside a glass ancestor; nest.mjs shows nested glass with `backdrop-filter: none` and near-solid fill.
- F5/F6 (refraction idempotent and live): bf639ec. One controller per element, live matchMedia/MutationObserver sync, cleanup of leaked filters; refr.mjs: double apply yields one filter, cleanup leaves none, reduced motion/transparency toggled live, simulated non-Blink and Firefox report unsupported.
- F7/F8 (docs type-checked, claims corrected): 1e2380b. `check:docs-examples` compiles the glass guide examples (7 primitives and 2 glass blocks).
- Follow-up: the live-preference browser test used fixed 30 ms sleeps and flaked about 1 run in 5; it now polls with `vi.waitFor` (6 consecutive green runs).
- Final checks (packages/ui): lint 0 errors (10 pre-existing warnings, none in glass code), typecheck clean, test 523 pass, build ok, check:treeshake ok, check:dist-imports ok, check:docs-examples ok, test:stories 1402 pass (209 files), test:glass 115 pass; root build:site 435 pages. Verifier scripts matrix, contrast, contrast2, nest, refr, nosupport, ssr rerun against a rebuilt fixture with the results above.

## Follow-ups after verifier PASS-WITH-FOLLOWUPS (0e0aff2)
- Menu outline: the inline `outline: none` on the menu surface is gone (it beat every stylesheet rule). `styles/base.css` now drops the surface outline on focus-visible only outside `prefers-contrast: more` and `forced-colors`, so the glass preset outline (or the base focus ring) shows there. Browser test: glass + dark + focused menu has `outline-style: none` normally and a solid outline under more contrast and forced colors; it fails against the inline style.
- Dark regular veil raised from `rgba(0,0,0,.45)` to `.52`. Verifier contrast2.mjs: dark ink-2 on regular glass over white 4.55 -> 5.15; every other case unchanged or higher (ink min 8.99 in dark). The browser contrast test now requires 4.8 for ink and ink-2 in every case.
