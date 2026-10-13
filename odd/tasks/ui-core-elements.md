# ui-core-elements: framework-agnostic behaviour (P3) and custom elements (P4)

## Objective
Ship `@jcsoftdev/ui-core` (zero-dependency, framework-agnostic behaviour and a granular Liquid Glass
engine) and `@jcsoftdev/ui-elements` (the ten phase-1 `ui-*` custom elements with precompiled CSS),
so vanilla users get the kit without React or Tailwind and pay only for the features they use.

## Problem / why
P0-P2 (`ui-platform.md`) split tokens out. Behaviour (focus, roving, popper, dismiss) and the glass
engine only exist inside the React kit. Vanilla users need them as plain JS, and the liquid engine
must be granular: a consumer pays only for the liquid features it uses.

## Scope
- `packages/ui-core`: focus scope/trap, roving focus, popper geometry + auto positioning, dismiss
  layers with stacking, typeahead, controllable state; liquid engine split per feature: options,
  presets (one module each), support probe, lens (refraction core), specular, dispersion, crystal,
  motion (spring), `attachLiquid`.
- `packages/ui-elements`: button, input, checkbox, switch, radio-group (+ radio), dialog, popover,
  tooltip, tabs (+ tab-list, tab, tab-panel), toast (toaster + `toast()`); `define*()` with a
  custom prefix; per-component CSS compiled from ui-tokens; `material="liquid"` via ui-core.
- Plumbing: workspace, root scripts, `check:size` entries, `check:treeshake` per package and per
  liquid tier, `check:pack`, CI path filters, `examples/vanilla-elements`.

Out of scope: rebuilding `@jcsoftdev/ui` (React) on ui-core (later phase); any change under
`packages/ui` (another agent edits it on `perf/lazy-liquid-material`); publishing.

## Constraints
- Zero third-party runtime deps; ESM; `sideEffects: false` (core); no DOM access at import time.
- Do not modify `packages/ui`. Port logic; keep the liquid math and parameters identical.
- Conventional Commits, no AI attribution. No merge, tag or publish.
- English artifacts. Tests where they buy safety, same commit.
- TDD: disabled (user policy: implement first, then protective tests). Runner: vitest 4.1.11
  (node project for pure logic, Chromium browser project via @vitest/browser-playwright for DOM).

## Design decisions (this feature)
- **Liquid tiers.** `attachLiquid(element, options)` writes the `--liquid-*` vars (sync, tiny),
  then resolves the effective configuration from computed style (options + theme + scope, like
  the React engine) and lazily imports only what it needs:
  - base frosted material: CSS only (`material="liquid"` styles + vars). No engine. This is all a
    non-Chromium engine, a reduced-transparency/contrast/motion user or `lens="off"` downloads.
  - `lens` (refraction core: rim/full/dome maps, frost mix, adaptive veil): when the surface is
    eligible for backdrop refraction.
  - `specular`: when the resolved specular intensity is > 0 (default 1, as in React).
  - `dispersion`: when the resolved dispersion is > 0 and the area is under the budget.
  - `crystal`: when the resolved profile is `crystal`.
  - `motion` (+ `spring`): unless `motion: false` / `--liquid-motion: off`.
  The engine also loads a missing feature on demand when CSS turns it on later.
- **Presets** are data-only modules (`liquid/presets/crystal` etc.); the features they need are
  pulled by `attachLiquid` from the resolved values, never by a static import.
- **Shadow DOM leaves** (button, input, checkbox, switch, radio) put role/ARIA on the host via
  `ElementInternals` where the host is the control (button, checkbox, switch, radio), or keep a
  native `<input>` inside (input). Light-DOM composites: radio-group, dialog, popover, tooltip,
  tabs, toaster.
- **CSS**: per-component CSS sources in `src/**/**.css`, compiled by `scripts/build-css.mjs` into
  string modules (`*.css.js`, adopted into shadow roots or the root node of light-DOM composites)
  and plain `.css` files. Every non-`--ui-*` `var()` must exist in ui-tokens `tokens.css` (build
  fails otherwise). The liquid CSS is generated from ui-tokens' `@utility liquid|liquid-clear`.

## Tasks
Route legend: inline = written by this worker in the worktree; no further delegation.

- [x] T1 ui-core scaffold + behaviours (focus, roving, popper, dismiss, typeahead, state). Route: inline.
  - Acceptance: subpath exports; SSR import of every entry in Node; unit tests for geometry,
    typeahead, roving intent, tab wrap, controllable; Chromium tests for focus trap, dismiss
    stacking (Escape + outside pointer), roving tabindex, autoPosition flip.
- [x] T2 ui-core liquid (options, presets, support, spring, lens, specular, dispersion, crystal,
  motion, attach). Route: inline.
  - Acceptance: pure-math golden parity with the React kit (fields, vars, springs) by importing
    both sources in tests; attach loads only the features its resolved options need (Chromium
    test with module spies); treeshake check per tier; cleanup restores the element.
- [x] T3 ui-elements scaffold (define, CSS build, base classes, material hook) + button, input,
  checkbox, switch, radio-group. Route: inline.
  - Acceptance: form association (FormData, reset, disabled, required validity), ARIA roles and
    states, keyboard (Space/Enter/arrows), custom prefix; Chromium tests.
- [x] T4 dialog, popover, tooltip, tabs, toast. Route: inline.
  - Acceptance: native `<dialog>.showModal`/Popover API with JS fallback; Escape/outside dismiss;
    focus in/out; tabs roving + activation modes + ARIA wiring; toast live region, timers, pause.
- [ ] T5 plumbing: size budgets (+5%, rounded to 50) for every entry and tier, treeshake checks,
  pack checks, CI path filters. Route: inline.
- [ ] T6 `examples/vanilla-elements` (Vite) + Chromium e2e; docs page(s) if cheap. Route: inline.

## Checks
Per package: `pnpm --filter <pkg> lint typecheck test build`, root `pnpm check:size`,
`pnpm check:treeshake`, `pnpm check:pack`. Example: `pnpm --filter @jcsoftdev/example-vanilla-elements test:e2e`.

## Delivery
Stacked PRs: (a) `feat/ui-core-elements-a` core behaviours -> main; (b) core liquid -> a;
(c) elements scaffold + leaves -> b; (d) composites -> c; (e) examples/docs -> d.
Strategy: auto-chain, stacked (requested by the user). Running authored-line count below.

Release note: the new package names (`@jcsoftdev/ui-core`, `@jcsoftdev/ui-elements`) need npm
trusted-publisher setup by the maintainer before they are added to `.github/publish-packages.json`.

## Open questions (conservative choice taken)
1. Base tier semantics: React applies the lens whenever the material is liquid. Here the base tier
   (CSS only) is what non-Chromium engines, users with reduced transparency/contrast/motion and
   `lens: false` get; there is no "refraction: 0 means no engine" shortcut (React runs a flat
   lens). Conservative: kept React's semantics; the tier switch is `lens: false` / `lens="off"`.
2. ui-core tests import `packages/ui/src/glass/*` and `primitives/popper/geometry.ts` read-only to
   pin parity. If `perf/lazy-liquid-material` moves those files, the parity imports need updating.

3. Toasts under an open modal `ui-dialog` are inert (native `showModal()` makes everything outside
   the dialog inert; the React kit exempts its toaster through `data-ui-layer-branch`). Moving the
   toaster into the top layer above the modal needs more work (popover-in-top-layer hit testing
   failed in a probe). Conservative: documented; a page that toasts from a modal can place a
   `<ui-toaster>` inside the dialog.
4. `ui-tooltip` has no React counterpart; it uses the kit's toast colours (`--toast-bg/ink`) and a
   700 ms hover delay with a 300 ms skip window (the common Radix defaults).
5. Element entries are discovered from the source tree (`src/<name>/<name>.ts`), exported through
   the `./*` pattern (`./dist/*/*.js`), budgeted by `src/<name>/size.json` and aggregated by a
   generated `src/index.ts`, so parallel batches never edit shared lists. The "define all" root
   entry is no longer size-gated (it is the sum of all elements).

## Progress / evidence
- T1 (slice a): ui-core behaviours. Checks observed: lint, typecheck, unit 11 + SSR 7 (node),
  browser 6 (Chromium), check:treeshake (6 entries independent), check:pack (6 entries import in
  Node), check:size ui-core entries ok. Route: inline (single package, mechanical port).
- T2 (slice b): ui-core liquid, split per feature. Checks observed: lint, typecheck, unit 18 (incl.
  value-for-value parity with the React sources: presets, liquidVars x300, displacement/specular/
  crystal fields byte-equal, springs), SSR 22, browser 15 (filter graph + backdrop + vars identical
  to React's applyGlassRefraction for 4 tiers; lazy fetch per tier from the resource timeline),
  check:treeshake (8 tier entries, 5 lazy chunks), check:pack 20 entries. Gzip per tier: base 2768,
  + refraction 7811, default look 10851, Crystal 12197. Route: inline.
  Note: core filter ids are `ui-liquid-lens-N` in `#ui-liquid-defs` (React uses `ui-glass-*`) so
  both engines can share a page.
- T3 (slice c): ui-elements scaffold + button, input, checkbox, switch, radio-group. Checks
  observed: lint (4 specificity warnings, no errors), typecheck, SSR 6 (node), browser 13
  (Chromium: AX tree roles/states via CDP, FormData/reset/disabled/required, Space/Enter/arrows,
  custom prefix; material: solid button fetches nothing, liquid loads lens+specular only, crystal
  layer in the shadow root, `lens="off"` keeps the frosted blur), check:treeshake (each element
  loads only itself; no liquid module eagerly), check:pack (ui-tokens 3, ui-core 20, ui-elements 6
  entries). Gzip (eager): define-all 6032, button 2327, input 1796, checkbox 2108, switch 2046,
  radio-group 2757; lazy `material="liquid"` chunk 4399 (+ the core tiers it pulls).
  Fix: treeshake/size scripts picked the first output with `entryPoint`, which can be a
  dynamic-import chunk; they now match the entry file. Re-measured core: unchanged (+-5 B).
  Route: inline.
- T4 (slice d): dialog, popover, tooltip, tabs, toast, plus entry discovery (`scripts/entries.mjs`,
  `scripts/gen-index.mjs`, per-element `size.json`, `./*` exports, pack-check expanding multi-`*`
  targets). Checks observed: lint, typecheck, SSR 11, browser 23 (dialog: invoker open, AX name,
  describedby, scroll lock, Escape, focus return, close parts, cancel veto, blocking, backdrop vs
  inside press; popover: popovertarget open below trigger, focus in, `expanded`, Escape and outside
  dismiss, focus return; tooltip: describedby, focus-visible show, top side, Escape, hover delay,
  skip window, cleanup; tabs: ARIA wiring, roving, automatic/manual, disabled; toast: region,
  status/alert, auto dismiss, visible 2, hover pause, action, Alt+T), check:treeshake (10 entries,
  each loads only itself and no liquid), check:pack (11 entries). Gzip (eager): dialog 3123,
  popover 4506, tooltip 5023, tabs 2605, toast 3070. Route: inline.
