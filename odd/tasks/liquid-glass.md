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
