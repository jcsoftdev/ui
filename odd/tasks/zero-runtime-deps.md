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
- [ ] T0 DOM test harness: Storybook stories run as tests in a real browser (Storybook addon-vitest, Chromium) with play functions and the a11y addon failing on violations; wire into CI. Route: delegated.
- [ ] T1 `clsx` inlined into `utils/cn.ts`. Route: inline-sized, delegated with T2.
- [ ] T2 `progress`, `avatar` in-house. Route: delegated.
- [ ] T3 `Slot` / `asChild` (prop, ref and handler merge). Route: delegated.
- [ ] T4 `switch`, `checkbox`, `radio-group` (+ accent-picker): controllable-state hook, roving focus, hidden form input. Route: delegated.
- [ ] T5 `tabs`, `segmented` (toggle-group): roving focus, automatic/manual activation. Route: delegated.
- [ ] T6 Icons: vendored SVG set (~112 names), `Icon`/`icon-map`, `IconComponent` type replacing `LucideIcon`. Route: delegated.
- [ ] T7 Toaster: store, stack of 2, timers with hover pause, action, dismiss, aria-live; same `toast` API. Route: delegated.
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

## Next step
T0 on `feat/zero-deps`.
