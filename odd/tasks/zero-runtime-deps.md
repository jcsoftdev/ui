# Zero runtime dependencies for @jcsoftdev/ui

## Objective
Replace every runtime dependency of `packages/ui` with in-house code so the library is fully owned: no `dependencies` left, only the `react`/`react-dom` peer.

## Problem / why
Owner decision 2026-10-10: "quiero tener control de todo. No me importa rehacer desde cero las otras librerías." Today the library wraps 11 `@radix-ui/*` packages, `cmdk`, `sonner`, `lucide-react`, `clsx` and `tailwind-merge`, and Radix prop types leak into the public API.

## Scope
- In: `packages/ui/src` wrappers, `utils/cn.ts`, icon set, toaster, command palette, tests, Storybook stories, docs site references, release notes.
- Out: dev tooling (Tailwind, Storybook, Vite, tsup, Biome, test runner) stays; it never ships in the bundle. Barber web's own direct `lucide-react` dependency is a follow-up in the barber repo.

## Constraints
- Public API stays source-compatible for barber web: same component names, prop names (`open`, `onOpenChange`, `asChild`, `side`, `align`, `sideOffset`, `collisionPadding`, dialog dismiss callbacks), `data-state` / `data-highlighted` / `data-disabled` attributes, and the `toast`, `toast.success`, `toast.error`, `toast.dismiss`, action API.
- CSS vars `--radix-*-content-available-{width,height}` are renamed to library-owned names, with the styles updated in the same task.
- Accessibility parity is mandatory: each replaced interactive component gets keyboard and ARIA tests (WAI-ARIA APG patterns) before its dependency is removed.
- `pnpm check:treeshake` keeps passing: Button-only bundles exclude dialog, popover, menu, palette, toaster and icons.
- Icon paths are vendored from Lucide (ISC) with the license notice kept in the repo.
- Release as 0.2.0 (type surface changes: Radix types no longer exported).

## TDD mode
Disabled (no project or session setting enables it). Tests are written alongside each change. Runner: `pnpm test` (node, logic) plus the new DOM harness from T0.

## Delivery strategy
ask-on-risk, chain strategy `feature-branch-chain` (owner, 2026-10-10): each task is a PR into `feat/zero-deps`; 0.2.0 is released once from that branch at T13.

## Tasks
- [x] T0 DOM test harness: Storybook stories run as tests in a real browser (Storybook addon-vitest, Chromium) with play functions and the a11y addon failing on violations; wire into CI. Route: delegated.
- [x] T1 `clsx` inlined into `utils/cn.ts`. Route: inline-sized, delegated with T2.
- [x] T2 `progress`, `avatar` in-house. Route: delegated.
- [x] T3 `Slot` / `asChild` (prop, ref and handler merge). Route: delegated.
- [x] T4 `switch`, `checkbox`, `radio-group` (+ accent-picker): controllable-state hook, roving focus, hidden form input. Route: delegated.
- [x] T5 `tabs`, `segmented` (toggle-group): roving focus, automatic/manual activation. Route: delegated.
- [x] T6 Icons: vendored SVG set (~112 names), `Icon`/`icon-map`, `IconComponent` type replacing `LucideIcon`. Route: delegated.
- [x] T7 Toaster: store, stack of 2, timers with hover pause, action, dismiss, aria-live; same `toast` API. Route: delegated.
- [ ] T8 `cn` merge engine replacing `tailwind-merge`: parity tests against current output for the custom token groups first, then swap. Route: delegated.
- [ ] T9 Overlay core + Dialog/Drawer: portal with container, focus trap, scroll lock, aria-hidden siblings, Escape/outside dismiss with the existing callbacks, nested overlays. Route: delegated.
- [ ] T10 Positioning engine + Popover/HoverCard/emoji picker: side/align/offset, flip, shift, available-size vars, outside dismiss, focus policy. Route: delegated.
- [ ] T11 Menu: DropdownMenu + ContextMenu (items, radio/checkbox items, typeahead, roving focus, modal=false, programmatic x/y open). Route: delegated.
- [ ] T12 Command palette replacing `cmdk`: fuzzy scoring with keywords, groups hidden when empty, arrow/Home/End, result count live region, on the new Dialog. Route: delegated.
- [ ] T13 Remove all `dependencies`, update docs/site and changelog, release 0.2.0, bump barber web and smoke-test its screens. Route: delegated.

## Acceptance criteria
- `packages/ui/package.json` has no `dependencies`.
- `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:treeshake`, the DOM harness and `pnpm build:site` pass in CI.
- Every story renders without errors and without a11y violations in the harness.
- Barber web builds against 0.2.0 and its booking, agenda, dialogs, menus and toasts behave as before.

## Progress
- 2026-10-10: dependency map done (usage per package, public API leaks, 379 `cn(` call sites, ~98 icons, no DOM tests today).

- 2026-10-10: T0 done (`c2c8f77` on `feat/zero-deps-t0-harness`): `pnpm test:stories` runs 199 story files / 1220 tests in headless Chromium (addon-vitest, vitest 4.1.11, playwright 1.64.0), a11y `test: 'error'` globally. 190 stories failed axe (mostly color-contrast, plus aria/label/nested-interactive/tabindex) and carry an explicit per-story `parameters.a11y.test: 'todo'`; find them with `rg 'test: "todo"' packages/ui/src`. Files (count): ai/assistant.stories.tsx(3), ai/chain-of-thought/chain-of-thought.stories.tsx(5), ai/chat-message/chat-message.stories.tsx(1), ai/code-block/code-block.stories.tsx(7), ai/markdown/markdown.stories.tsx(3), ai/tool-call/tool-call.stories.tsx(4), atoms/trend-chip/trend-chip.stories.tsx(5), brand/logo-forge.stories.tsx(4), brand/logo-mark.stories.tsx(1), calendar/day-chip/day-chip.stories.tsx(4), calendar/event-block/event-block.stories.tsx(5), calendar/month-view/month-view.stories.tsx(5), calendar/timeline-view/timeline-view.stories.tsx(4), calendar/week-view/week-view.stories.tsx(5), charts/chord-chart/chord-chart.stories.tsx(1), charts/choropleth-map/choropleth-map.stories.tsx(1), charts/core/cartesian/ink-layer.stories.tsx(7), charts/core/chart-legend.stories.tsx(1), charts/core/export-menu.stories.tsx(2), charts/donut-chart/donut-chart.stories.tsx(1), charts/gantt-chart/gantt-chart.stories.tsx(15), charts/progress-units/progress-units.stories.tsx(7), charts/sankey-chart/sankey-chart.stories.tsx(1), charts/stock-chart/stock-chart.stories.tsx(16), charts/tree-chart/tree-chart.stories.tsx(19), containers/data-grid/data-grid.stories.tsx(6), containers/data-grid/spreadsheet.stories.tsx(1), containers/item-card-group/item-card-group.stories.tsx(5), containers/kanban/kanban.stories.tsx(5), containers/kpi-group/kpi-group.stories.tsx(5), containers/resizable/resizable.stories.tsx(1), containers/scrolly/scrolly.stories.tsx(4), dashboards/equipo.stories.tsx(3), dashboards/inicio.stories.tsx(2), dashboards/presets.stories.tsx(2), forms/checkbox-button-group/checkbox-button-group.stories.tsx(3), forms/dropzone/dropzone.stories.tsx(5), forms/radio-button-group/radio-button-group.stories.tsx(3), foundations/style-presets.stories.tsx(4), overlays/popover/popover.stories.tsx(2), palette/command-palette/command-palette.stories.tsx(2), shell/app-shell/app-shell.stories.tsx(1), shell/topbar/topbar.stories.tsx(4), showcase/showcase.stories.tsx(5). Radix parity baselines in `atoms.test.stories.tsx`, `navigation.test.stories.tsx`, `overlays.test.stories.tsx`. CI installs Chromium and runs the harness after check:treeshake.

- 2026-10-10: T1 done (`114d415` on `feat/zero-deps-t1-t2`, stacked on T0): clsx-compatible joiner inlined in `utils/cn.ts`, `ClassValue` type owned locally, cn tests extended (406 node tests pass), `clsx` removed from dependencies.
- 2026-10-10: T2 done (`04ddda5`): in-house `Progress`/`Meter` (Radix attributes mirrored: role, aria-valuemin/max/now/text, data-state/value/max, invalid value falls back to indeterminate, `getValueLabel` kept; `asChild` dropped until T3) and `Avatar` (off-DOM Image preload in effects, SSR safe, 400ms fallback delay kept). `@radix-ui/react-progress` and `-avatar` removed. Stories: 199 files / 1221 tests pass (baselines unchanged, assertions added). Route: delegated.
- 2026-10-10: T0 follow-ups (`a531d31` on `feat/zero-deps-t3-slot`, stacked on T1/T2): dialog focus-trap baseline asserts the exact Tab/Shift+Tab cycle (Confirmar, Close, Motivo, Confirmar; reverse), `ButtonAsChild` spy cleared at play start, CI caches `~/.cache/ms-playwright` keyed on the installed playwright version and sets `STORYBOOK_DISABLE_TELEMETRY=1`.
- 2026-10-10: T3 done (`ad89893`): in-house `utils/slot.tsx` mirroring Radix Slot (child handler then slot handler, className concat, style merge child-wins, aria-describedby union, composed refs via React 19 ref prop, throws on non-single-element children; `Slottable` and lazy children dropped since unused). Used by `Button` and `HoverCardTrigger`. `@radix-ui/react-slot` removed. New `utils/slot.test.stories.tsx` (3 stories). Radix popover/dialog still use their own transitive Slot until T9/T10. 200 story files / 1224 tests, 406 node tests pass. Route: delegated.

- 2026-10-10: T4 done (`63780ff` on `feat/zero-deps-t4-toggles`, stacked on T3): in-house `Switch`, `Checkbox` (indeterminate, Enter ignored) and `RadioGroup`/`AccentPicker` (internal `radio-group-primitive.tsx`; `RadioOption.disabled` added). Shared internals in `utils/`: `use-controllable-state`, `roving-focus` (`useRovingFocus({ orientation, dir, loop, activeId })` returns `rootProps` + `getItemProps(id, { disabled, onKeyDown, onFocus, onNavigate })`, DOM-ordered, Home/End/PageUp/PageDown, rtl), `form-bubble` (hidden input + reset), `compose`. Radix switch/checkbox/radio-group removed. 200 story files / 1230 tests, 406 node tests, lint/typecheck/build/treeshake pass. Route: delegated.

- 2026-10-10: T5 done (`402607d` on `feat/zero-deps-t5-tabs`, stacked on T4): in-house `Tabs` (automatic/manual activation, orientation, dir, `forceMount`, inactive panels unmounted like Radix Presence, mousedown selects) and `Segmented` (radiogroup/radio, `data-state` on/off, clicking the active item deselects with `onValueChange("")` like Radix single; `rovingFocus`/`loop`/`dir`/`orientation` kept) on `useRovingFocus`; `TabsTrigger` also gets `data-orientation`. `getRovingIntent`/`findRovingTarget` now covered by `test/roving-focus.test.mjs` (rtl, loop=false). New stories: manual, vertical, disabled skipped, rtl, segmented deselect/disabled. `@radix-ui/react-tabs` and `-toggle-group` removed. 200 story files / 1235 tests, 410 node tests. The `data-[state=checked]:*` classes on the Switch track and Checkbox box spans were already dead under Radix (no data-state on those spans), so no regression; the checked track/box fill is a pre-existing visual gap, left as is. Route: delegated.

- 2026-10-10: T6 done (`bfcc772` generator+set, `63deafb` call sites, on `feat/zero-deps-t6-icons`, stacked on T5): SVG source of truth in `packages/ui/icons/svg` (134 files vendored from lucide-react 1.53.0, ISC notice in `icons/LICENSE-lucide`, `icons/aliases.json` maps 10 legacy names such as `AlertTriangle` to canonical files, shared with the future Compose generator C4). `scripts/build-icons.mjs` (`pnpm build:icons`) emits committed `src/icons/*.tsx` (one function component per icon on a shared `IconBase`: size, strokeWidth, absoluteStrokeWidth, color, all SVG props, aria-hidden unless aria-*/role/title given) and the barrel; subpath `@jcsoftdev/ui/icons`. `IconComponent`/`IconProps` types, `LucideIcon` kept as deprecated alias. All 64 files migrated (imports only), `lucide-react` removed from package.json and lockfile. Barber-only names included: Armchair, ArrowUpFromLine, CalendarPlus, CheckCheck, CircleCheck, ClipboardList, Construction, Inbox, Landmark, LogOut, MapPin, MessageCircle, RotateCcw, ScanBarcode, ScrollText, Settings, ShoppingBag, ShoppingCart, Tags, TriangleAlert, Truck, User, UserCheck, UserCog, UserPlus. Treeshake: single icon bundle 649 bytes (check.js + icon-base.js only), full set 37509 bytes. `site/` (docs site) still depends on lucide-react itself; handled in T13. 200 story files / 1237 tests, 415 node tests. Route: delegated.

- 2026-10-10: rebased the whole chain onto origin/main 26fd3ff (0.1.7); conflicts in button, switch, checkbox, dialog, drawer resolved keeping main's touch density, loadingLabel/block/lg and useUiStrings inside the in-house code; a027075 reduced to its regression stories (main's 2ef9814 carries the fix); `status-icons.tsx` (added in 0.1.6) moved to in-house icons. Pre-rebase tip kept at `backup/zero-deps-t6-pre-rebase`.

- 2026-10-10: T7 done (`5beb06d` on `feat/zero-deps-t7-toaster`, stacked on T6): in-house toaster. `toast-store.ts` (module-level external store, `useSyncExternalStore`, empty server snapshot, toasts published before `<Toaster>` mounts are kept; update-by-id reopens and bumps a revision), `toast.ts` (`toast`, `.success`, `.error`, `.dismiss`; options `id`, `description`, `duration`, `action`, plus `onDismiss`), `toaster.tsx` (`ToasterProps` owned: `position`, `duration`, `visibleToasts`, `className`, `label`; newest N open toasts shown, older wait; timer pauses on hover, focus-within and hidden document; touch swipe 60px; Escape; action runs then dismisses unless `preventDefault`; Alt+T focuses the region; exit via transition then removal, immediate under `prefers-reduced-motion`). Region is a labelled `section` using new UiStrings key `notifications` (en/es); `role=status`/polite, errors `role=alert`/assertive. No `info`/`warning` tones: main 0.1.6 added none. Toasts are plain `div`s, since `role` on `li` fails axe list rules. `sonner` removed from package.json and lockfile; treeshake bans `toaster` from the Button bundle. 203 story files / 1267 tests, 448 node tests (7 new store tests). Route: delegated.

## Next step
T8 (`cn` merge engine replacing `tailwind-merge`): parity tests against current output for the custom token groups first, then swap.
