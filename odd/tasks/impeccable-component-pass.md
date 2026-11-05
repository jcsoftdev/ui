# Impeccable design pass over the component library and the site

## Objective
Apply the Impeccable design workflow to every component family in `packages/ui` and to `site`, in reviewable
slices, preserving the existing visual system (refinement, not redesign).

## Why
User request 2026-11-05: use the impeccable skill on each component. Targets confirmed: `packages/ui` and `site`.
Primary user: developers. Differentiator: defaults plus extension to any color or UI standard through tokens.

## Scope
- In: PRODUCT.md (repo root, shared), DESIGN.md of the incumbent system, then one polish pass per component family.
- Out: `ui-elements` and `ui-compose` unless the user adds them; redesign of the Liquid Glass look; new components.

## Constraints
- Refinement preserves identity, behavior and copy. Token names and public props do not change.
- Worktree `../ui-wt-design`, branch `design/impeccable-pass` from origin/main. One PR per family.
- Size budgets must stay green (`pnpm check:size`); raise a budget only with a measured reason.
- Artifacts in English. Conventional Commits, no AI attribution. No push without the user's confirmation.

## Resolved settings
- TDD: off (user global override). Checks: Storybook browser tests for touched components, lint, typecheck,
  check:size.
- Delivery: ask-on-risk; slices per family keep each PR near the ~400 changed-lines heuristic.

## Tasks
- [x] T1 PRODUCT.md at the repo root (interview: users = developers; positioning = defaults plus
      extension to any color or UI standard). Route: inline, one file.
- [ ] T2 DESIGN.md from the incumbent code (`impeccable document`), covering tokens and component rules.
- [ ] T3 Component families, one slice each (order to confirm with the user after T2): atoms, forms,
      navigation, overlays, containers and data, charts, ai, `site` landing and docs.

## Acceptance criteria
- PRODUCT.md and DESIGN.md exist and match the repo.
- Each slice lists what the pass changed and what it left alone; checks green.

## Verification evidence
T1: PRODUCT.md written; init interview answers recorded; not yet committed.

## Next step
Commit T1, then run `document` for T2.
