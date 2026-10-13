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
- [x] T5 plumbing: size budgets (+5%, rounded to 50) for every entry and tier, treeshake checks,
  pack checks, CI path filters. Route: inline.
- [x] T6 `examples/vanilla-elements` (Vite) + Chromium e2e; docs page(s) if cheap. Route: inline.

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

- T5/T6 (slice e): scaling tooling and example.
  - Tooling:
    - `pnpm --filter @jcsoftdev/ui-elements new <name> [--light] [--form] [--material]` scaffolds the
      element, its CSS, `size.json` and a test. All five flag combinations were generated, then
      typechecked, linted and tested (10 browser tests) before they were removed.
    - The `FormElement` base is covered by a browser test: FormData, required, reset and a disabled
      fieldset.
    - ui-core exports `./*`, and its checks discover behaviours: a top-level `src/<name>.ts` with
      `<name>.size.json`.
    - `docs/contributing-elements.md` is the recipe batch agents follow.
  - Example: `examples/vanilla-elements`. Its Chromium e2e drives every element (FormData, dialog,
    popover, tabs, toast, on-demand liquid). It also builds with Vite and asserts that the entry
    chunk has no refraction engine (14 chunks). The e2e step is in CI (`ui-web-components`).
  - Docs-site pages were not added; they are deferred to batch Z.

## Parity roadmap (full React kit, charts included)

Scope (user, 2026-10-13): ui-core + ui-elements must reach parity with every component of
`@jcsoftdev/ui`, each its own tree-shakable entry, with every optional feature pay-for-what-you-use.
This run delivers the foundation (T1-T6). The batches below are built later by parallel agents, one
worktree per batch, following `docs/contributing-elements.md`.

Inventory source: `packages/ui/src/<category>/index.ts` barrels and story folders. The site's
sidebar is generated from the stories, so it lists the same set.
- About 168 component tags: atoms 17, forms 21, navigation 4, overlays 8, palette 1, shell 3,
  states 5, containers 28, calendar 5, ai 14, rich-text 2, brand 2, i18n 1, icon 1, charts 50 plus
  about 6 chart infra parts.
- 146 icon glyphs, shipped as data for one `ui-icon`.
- Phase 1 (done here): button, input, checkbox, switch, radio-group, dialog, popover, tooltip, tabs,
  toast.

### Batch rules (why batches can run in parallel)

- An element batch only adds `packages/ui-elements/src/<name>/` folders and
  `test/<name>*.browser.test.ts`. The following are all discovered, so no batch edits a shared list:
  - the entry, export pattern, index and `define()`;
  - the size budget (`size.json`);
  - the tree-shake, SSR and pack checks.
- A core batch only adds `packages/ui-core/src/<behaviour>.ts`, plus its `<behaviour>.size.json`
  and tests. The `./*` export pattern and the check discovery pick it up.
- Shared code inside a batch goes in `src/internal/<batch-topic>.ts`, named after the batch to avoid
  collisions. Never edit another batch's internal file. Cross-batch reuse waits for the dependency
  to merge.
- README tables, the docs site and the example page are refreshed by the final batch Z, not per
  batch.
- A behaviour two batches need lives in a core batch that both depend on.

### Core behaviour batches (no tags; land first)

| ID | Behaviours (`@jcsoftdev/ui-core/<name>`) | Unlocks | Est. |
| --- | --- | --- | --- |
| C1 | `presence` (exit animation before unmount), `scroll-lock` + `hide-others` (inert siblings, pointer lock; move the elements' `lockScroll` here), `hover-intent` (open/close delays, skip window, grace) | drawer, hover-card, menus, palette, tooltip refactor | M (~500) |
| C2 | `pointer-drag` (capture, clamp, step snap, keyboard parity), `press-repeat`, `segmented-input` (time/date fields), `file-drop`, `otp` (paste/advance) | slider, resizable, stepper, time-input, pin-input, dropzone, drawer/carousel/toast swipe | M (~700) |
| C3 | `listbox` (selection model, active descendant, filtering), `menu` (submenus, grace area, checkbox/radio items; port of the 1129-line MenuPrimitive), `command-score` (fuzzy ranking) | select, inline-select, dropdown/context menu, command palette, emoji picker | L (~1500) |
| C4 | `tree` (keyboard model), `virtual-list` (fixed + measured rows), `sortable` (pointer + keyboard reorder), `disclosure` | file-tree, sidebar, kanban, emoji picker, chat list, chain-of-thought, tool-call | L (~1200) |
| C5 | `observe` (scroll-spy, resize, stick-to-bottom, online), `clipboard`, `number` (format + animate), `date` (calendar grid, week/month math, locale, overlap packing), `context` (provider/consumer events for i18n strings) | number-value, big-date, floating-toc, scrolly, conversation, calendar views | L (~1100) |
| C6a | chart `scale` (linear/log/time/band), `axis` ticks, `format`, `path` (line/area/curves), `stack`, `color-scale`, `downsample`; port of charts/core math, golden parity tests vs React | every chart | XL (~4000) |
| C6b | `polar`, `hierarchy` (treemap/partition/tree layouts), `sankey`, `chord` | polar + hierarchy charts | XL (~3000) |
| C6c | `pan-zoom`, `brush`, `shape-morph` | stock, gantt, crossfilter, hierarchy-morph | L (~1200) |
| C7 | `geo` (projections, hex tiles, globe math) + topology data as lazy JSON | maps, globe | XL (~2500) |
| C8 | `sanitize-html`, `markdown` (parser to safe DOM), `rich-text` (contenteditable commands), `xlsx` (zip + crc32 writer) | markdown, code/chat, rich text, data/chart export | L (~1800) |

C1-C5 are independent of each other and can run in parallel. C6b and C6c need C6a. C7 needs C6a.
C8 is independent.

### Element batches

Sizes are midpoints of the React sources (S ~100, M ~275, L ~700, XL ~1500 lines). DOM: S =
shadow leaf, L = light composite. Core behaviours are listed per batch.

| ID | Tags (`ui-*`) | DOM | Core | Depends on | Est. |
| --- | --- | --- | --- | --- | --- |
| E1 | avatar, avatar-group, chip, led, status-dot, status-pill, progress, meter, trend-chip | S (group L) | none | - | M (~800) |
| E2 | icon (146-glyph lazy registry), number-value, big-date, pressable, kpi, highlight-line | S | number, date | C5 | M (~900) |
| E3 | empty-state, error-state, forbidden-state, offline-banner, banner, skeleton, loader, text-shimmer | S | observe | C5 | M (~600) |
| E4 | label, field, form-grid, input-icon, textarea, native-select, radio-button-group, checkbox-button-group, accent-picker | S/L | roving, FormElement | - | M (~900) |
| E5 | slider, number-stepper, pin-input, rating, time-input, dropzone | S/L | pointer-drag, press-repeat, otp, segmented-input, file-drop, roving | C2 | L (~1400) |
| E6 | dropdown-menu (+ item/sub/radio/checkbox parts), context-menu, select, inline-select, command-palette | L | menu, listbox, command-score, popper, dismiss, presence, hover-intent | C1, C3 | L (~2000) |
| E7 | drawer, hover-card, emoji-reaction, emoji-reaction-bar, emoji-picker | L | presence, scroll-lock, hover-intent, pointer-drag, virtual-list, listbox | C1, C2, C3, C4 | L (~1300) |
| E8 | segmented, stepper, floating-toc, app-shell, sidebar, topbar | L | roving, tree, observe | C4, C5 | M (~1000) |
| E9 | card, cell, cols, comment, description-list, facts, generic-row, page-header, settings-row, settings-layout | L | roving, liquid (card) | - | M (~800) |
| E10 | action-bar, toolbar, confirm-action, item-card-group, kpi-group, responsive-list, timeline, table | L | roving, observe | C5 | L (~1400) |
| E11 | carousel, resizable, file-tree, kanban, scrolly | L | pointer-drag, tree, sortable, observe | C2, C4, C5 | L (~1900) |
| E12 | day-chip, event-block, month-view, week-view, timeline-view | S/L | date, roving | C5 | M (~1000) |
| E13 | attachment, chat-message, chat-list, conversation, message-actions, prompt-input, prompt-suggestion, prompt-suggestion-list, source | L | observe, clipboard, roving, virtual-list | C4, C5 | L (~1300) |
| E14 | chain-of-thought, tool-call, code-block, markdown, rich-text-view | L/S | disclosure, sanitize-html, markdown, clipboard | C4, C5, C8 | L (~1300) |
| E15 | rich-text-editor, logo-mark, logo-forge, strings (i18n registry, not a tag) | L/S | rich-text, context | C5, C8 | L (~1900) |
| E16 | chart-frame, chart-legend, chart-tooltip, chart-data-table, chart-breadcrumb, chart-export-menu, sparkline | S/L | scale, axis, popper, menu, xlsx | C3, C6a, C8 | L (~1800) |
| E17 | bar, line, area, scatter, bubble, combo, histogram, lollipop | S | scale, axis, path, stack | E16 | L (~2000) |
| E18 | dumbbell, slope, range-area, waterfall, bullet, box-plot, violin, raincloud | S | as E17 | E16 | XL (~4500) |
| E19 | stream-graph, beeswarm, candlestick, timeline-chart, hbars, heatmap | S | as E17, downsample | E16 | XL (~4300) |
| E20 | donut, pie, gauge, fill-gauge, radar, radial-bar, polar-area, parliament | S | polar | C6b, E16 | XL (~4100) |
| E21 | sunburst, treemap, icicle, hierarchy-morph, tree-chart, sankey, chord, funnel | S | hierarchy, sankey, chord, shape-morph | C6b, C6c, E16 | XL (~5700) |
| E22 | waffle, pictogram, isotype-rows, progress-units, chart-grid | S | scale | E16 | L (~1600) |
| E23 | gantt, stock, crossfilter (provider + bar, histogram, scatter, summary) | L | pan-zoom, brush, downsample | C6c, E16, E17 | XL (~5700) |
| E24 | choropleth, bubble-map, hex-tile-map, globe | S | geo | C7, E16 | XL (~2500 + data) |
| D1-D3 | data-grid: D1 grid core (virtual rows/cols, grid keyboard, column pin/resize/reorder), D2 editing (formula, history, ranges, tree rows), D3 pivot, filter builder, xlsx export | L | virtual-list, sortable, xlsx | C4, C8 | XL (~11,000; consider its own package `@jcsoftdev/ui-grid`) |
| Z | docs site pages, README tables, `examples/vanilla-elements` showcase, final parity audit against the inventory | - | - | all | M |

Suggested order (waves):
1. C1 through C5 and C8, in parallel, plus E1, E4 and E9 (no core dependency).
2. E2, E3, E5, E6, E8, E10, E12 and C6a.
3. E7, E11, E13, E14, E15, plus C6b, C6c and C7.
4. E16, then E17 through E24 in parallel.
5. D1 through D3, then Z.

Total: about 70k lines of React source to port. About 40k are charts, mostly pure geometry that
moves into ui-core once (C6), which leaves thin SVG renderers in the elements.

Before building a batch, read the React component and the primitives it uses. The core-behaviour
calls above come from folder structure and imports, so a batch that finds a missing behaviour
records it as an open question and adds it to its own `src/internal/<topic>.ts`. It does not reach
into another batch.
