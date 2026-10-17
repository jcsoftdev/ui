# edumodules gaps in @jcsoftdev/ui

## Objective
Add to `@jcsoftdev/ui` every component that edumodules uses today from its in-house kit (`@edumodules/ui`) and that this library lacks, so edumodules can drop its kit and import everything from `@jcsoftdev/ui`.

## Problem / why
edumodules is migrating all UI to `@jcsoftdev/ui` (owner decision 2026-10-17: "todo va dentro de UI y hay que importarlos"). A mapping of the kit against 0.3.0 found no equivalent for the components below. Building them inside the app was rejected: they belong in the library.

## Scope
- In: `packages/ui` components below, generic names and APIs (nothing edumodules-specific), tests, stories, README/docs entries, changelog.
- Out: publishing to npm (owner), edumodules code (tracked in edumodules `odd/tasks/jcsoftdev-ui-migration.md`).

## Constraints
- Additive and source-compatible. No new runtime dependency, no Radix (see `odd/tasks/zero-runtime-deps.md`); build on `src/primitives` and existing utils (roving focus, controllable state, i18n strings).
- Default strings through `UiStringsProvider` (en/es).
- Container queries for responsive layout, never viewport media queries, matching the existing containers.
- Accessibility: WAI-ARIA patterns (listbox/combobox, dialog with alertdialog role, tooltip), keyboard support, 44px touch targets under touch density.
- Branch `feat/edumodules-gaps` from origin/main 34ca0b7, worktree `.claude/worktrees/edumodules-gaps`.

## TDD mode
Disabled (owner override: implement first, tests that protect the change in the same commit). Runner: `pnpm test` in `packages/ui` (plus root `pnpm typecheck`, `pnpm lint`, `pnpm check:treeshake`).

## Delivery strategy
Direct commits on `feat/edumodules-gaps`, one work unit per commit, each green. Release commit last; the owner publishes.

## Reference
Source of the behaviour to cover: `/Users/jcsoftdev/personal/edumodules/.claude/worktrees/jui-migration/packages/ui/src` (the edumodules kit). Match its capabilities, not its markup or names when a more generic name fits.

## Tasks
- [x] G1 atoms: `Spinner`, `Kbd`. Route: delegated (writer). Commit: G1_SHA.
- [ ] G2 overlays: `Tooltip` (hover/focus, delay, placement), `AlertDialog` (role alertdialog, cancel/confirm, danger tone, async confirm with pending state). Route: delegated.
- [ ] G3 containers: `Callout` (or Banner extension if the kit's Callout is a subset; decide from the kit API and record why). Route: delegated.
- [ ] G4 forms: options-based `Select` mode or `Listbox` select (custom listbox with `options`, `value`, `onValueChange`, placeholder, disabled options) alongside the native Select; `Combobox` (filterable, async options, empty state, clearable). Route: delegated.
- [ ] G5 forms/calendar: `DatePicker`, `DateTimePicker` (ISO date values, min/max, locale es-PE week start, keyboard grid; reuse `calendar`). Route: delegated.
- [ ] G6 navigation: `Wizard` on top of `Stepper` (steps, next/back, per-step validation hook). Route: delegated.
- [ ] G7 containers/atoms from the kit's blocks: `Section` (header + body + actions), key-value list (extend `DescriptionList` if it covers it), `Note`, `Seal` (official stamp mark), due-date chip, `ListDetail` (master-detail with container-query collapse), chip group multi-select, `Aside`, `Feed`, `Shortcuts`, link-mode `Tabs` for a sub-navigation strip. Route: delegated.
- [ ] G8 Docs, changelog, size budgets, tree-shake guards; release commit for the next minor. Route: delegated.

## Acceptance criteria
- Every task's component exported from its subpath, typed, tested, with a story.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check:treeshake` green at each commit.
- No new runtime dependency in `packages/ui/package.json`.

## Progress
- 2026-10-17: document created; nothing implemented yet.
- 2026-10-17: G1 done (G1_SHA). `Spinner` (`size` xs|sm|md|lg or px number, `label` defaults to the `loading` UI string, `label={false}` is decorative, `motion-safe:animate-spin` so reduced motion leaves a static ring) and `Kbd` (`<kbd>`, tokens only). Exported from `@jcsoftdev/ui/atoms`, `/atoms/spinner`, `/atoms/kbd`. Tests: `test/edumodules-gaps.test.mjs` (4 tests: strings en/es/override, label, decorative, sizes, kbd), stories with play functions (8 story tests pass in Chromium incl. axe), treeshake guard for both. Verification: `pnpm -C packages/ui test`: 588 pass, 0 fail; `pnpm typecheck`: pass; `pnpm lint`: 0 errors (pre-existing warnings only); `pnpm check:treeshake`: pass; `pnpm test:stories src/atoms/spinner src/atoms/kbd`: 2 files / 8 tests pass; `node scripts/check-size.mjs`: ui/atoms 19499 B / budget 19600 B. Note: `pnpm build` is needed before typecheck/treeshake in a fresh worktree (dist and ui-core types).
