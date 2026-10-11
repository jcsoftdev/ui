# UX defaults in @jcsoftdev/ui (0.1.6)

## Objective
Move the shared UX layer of wappido and Abonoya into `@jcsoftdev/ui` so both consume it directly: touch density, info tone, localized default strings, status-safe Banner/Chip, richer Button/Field/ErrorState, ConfirmAction and ResponsiveList.

## Problem / why
An architecture rule forbids Abonoya importing `@wappido/*`, so the layer that lives in `@wappido/ui` cannot be shared. Target users are non-technical shop owners and cashiers on phones (44px targets, status never color-only, errors beside the field, lists as cards on mobile).

## Scope
- In: `packages/ui` tokens and generator, components below, tests, stories, README and theming docs, release 0.1.6.
- Out: replacing Radix/lucide (belongs to `zero-runtime-deps.md`, 0.2.0), routing the Spanish labels hard-coded in older components (NumberStepper, Carousel, AI set, Table pin labels) through the provider, a DOM test harness.

## Constraints
- Additive and source-compatible; no new runtime dependency; no new Radix usage.
- Released as 0.1.6 from `feat/ux-defaults` (worktree `/Users/jcsoftdev/personal/ui-ux-defaults`), cut from the 0.1.5 release commit `4eb3556` so it does not touch the in-flight `feat/zero-deps` work.
- Status icons live in one module, `src/atoms/internal/status-icons.tsx`, so the lucide swap in zero-deps T6 changes one file.

## TDD mode
Disabled (owner override: implement first, tests that protect the change in the same commit). Runner: `pnpm test` (node) plus renderToStaticMarkup cases bundled with esbuild (`test/components`).

## Delivery strategy
Direct commits on `feat/ux-defaults`, one work unit per commit, each green.

## Tasks
- [x] T1 Touch density, `info`/`info-soft` tokens, `control-height-lg`; density levels may carry absolute `values`. Route: inline. Commit a845b8d.
- [x] T2 `UiStringsProvider` with `en`/`es`; Dialog, Drawer, Skeleton read it. Route: inline. Commit d0b1391.
- [x] T3 Touch hit areas for Checkbox, Switch, radio rows, interactive Chip, Dialog and Drawer close. Route: inline. Commit 6094cb6.
- [x] T4 Additive props: Button `loadingLabel`/`block`/`lg`, Field `optional`/`error={null}`, Banner `title`/default icon/role, Chip `icon`/`statusIcon`/`info`, ErrorState `title`/`description`. Route: inline. Commit 7445996.
- [x] T5 `ConfirmAction`. Route: inline.
- [x] T6 `ResponsiveList` and tree-shake guards. Route: inline.
- [x] T7 README and theming docs. Route: inline.
- [x] T8 Release 0.1.6 (separate commit, `chore(ui): release 0.1.6`).

## Acceptance criteria
- Touch preset values present in generated CSS; nested elements match too.
- `UiStringsProvider` es/en and explicit-prop override covered by tests.
- Banner default icon and role (only danger is an alert); Field optional marker and aria wiring; ResponsiveList table and card markups; ConfirmAction idle markup and outcome logic.
- A Button-only bundle excludes ConfirmAction, ResponsiveList, the strings context and the status icons.

## Behaviour changes to existing components (called out for reviewers)
- Banner `warning` is now `role="status"` (was `alert`); only `danger` is assertive. OfflineBanner inherits it.
- Banner `info` uses the new info tokens instead of the brand accent; every Banner without `icon` now shows a tone glyph (`icon={null}` hides it).
- Banner `title` is now a visible heading prop, no longer the HTML tooltip attribute.
- Skeleton became a client component (reads the strings context).
- Button props now include `ref` (typed through `ComponentPropsWithRef`).

## Progress and verification evidence (run in the worktree)
- `pnpm lint`: Checked 793 files, no fixes applied, 0 errors.
- `pnpm typecheck`: `packages/ui` tsc clean; site `astro check` 0 errors.
- `pnpm test`: packages/ui 430 tests, 430 pass, 0 fail; site 23 pass, 0 fail.
- `pnpm build`: styles + tsup + d.ts succeeded.
- `pnpm check:treeshake`: `atoms/button` 34055 bytes, 8 modules, none of dialog/popover/lucide/checkbox/confirm-action/responsive-list/i18n/status-icons; ConfirmAction bundle excludes table and overlays; all tree-shaking sections OK.
- `pnpm build:site`: 278 pages built.
- Not covered: interactive DOM flow of ConfirmAction (confirm, pending, failure) and the Dialog/Drawer close-button size, because there is no DOM harness on 0.1.x (zero-deps T0 adds one). The outcome logic is tested as a pure function; the touch classes are verified through Tailwind output only for Checkbox/Switch/radio/Chip markup.

## Next step
Owner merges `feat/ux-defaults` into `main`, tags `v0.1.6`, pushes (steps in the hand-off report).
