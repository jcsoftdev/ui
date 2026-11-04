# demo kit gaps in @jcsoftdev/ui

## Objective
Fix five gaps in `@jcsoftdev/ui` found while reviewing the wappido demo.

## Scope
- In: `packages/ui` source, tests, README and CHANGELOG. Additive; two documented behaviour changes (NumberStepper button names follow the locale, DialogHeader stacks).
- Out: publishing, version bump, the demo app.

## Constraints
- No code comments, English code, strings through `UiStringsProvider`. Branch `feat/demo-kit-gaps` (worktree `ui-demo-kit-gaps`), no push.

## TDD mode
Disabled (owner override). Tests in the same commit. Runners: `node --test` (`pnpm test`), vitest browser (`pnpm test:glass`) in `packages/ui`.

## Verification of each gap in source (before editing)
1. Focus restoration: not solved. Toaster action unmounts its button; ListDetail only refocuses on back; no rescue in ResponsiveList or Kanban.
2. NumberStepper: not solved. Fixed `h-input`, hard-coded "Aumentar"/"Disminuir".
3. DialogHeader: not solved. `flex items-center` row.
4. Skeleton: not solved. Every instance is `role="status"`.
5. Avatar: `aria-hidden` and other ARIA props already forward (props spread after role/label), but the role/label stayed on the element. Added `decorative` and dropped role/label when hidden.

## Tasks
- [x] D1 focus restoration (toast, ListDetail, ResponsiveList, Kanban). Route: inline. Commit: 994809cd.
- [x] D2 NumberStepper size and labels. Route: inline. Commit: 46139cac.
- [x] D3 DialogHeader stacks. Route: inline. Commit: d4ebf675.
- [x] D4 Skeleton announce and SkeletonGroup. Route: inline. Commit: f98e66d9.
- [x] D5 Avatar decorative. Route: inline. Commit: ff6681b0.
- [x] D6 checks (typecheck, lint, tests, build, treeshake, size) and docs commit.

Tests: `test/demo-kit-gaps.test.mjs` (5 static) in 38f39607, `src/utils/focus-rescue.browser.test.tsx` (8 browser) in 994809cd.
