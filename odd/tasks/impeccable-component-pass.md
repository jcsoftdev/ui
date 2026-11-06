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
- [x] T2 DESIGN.md from the incumbent code (`impeccable document`), covering tokens and component rules.
      Commit 2cc2f3cb. Route: delegated writer.
- [ ] T3 Component families, one slice each. Order: atoms (25), forms (31), navigation (6), overlays (11),
      states (6), containers (48), charts (52), ai (15), auth (10), calendar (7), shell (4), primitives (5),
      then `site` landing and docs. Each slice: critique + polish, rendered check in Storybook, one commit,
      one PR.
  - [x] T3.1 atoms. Commit 055c46b1. Route: delegated writer. Rendered check in Storybook (light/dark, focus,
        disabled); contrast scan clean on 34 stories; fixed focus ring on Checkbox/Switch, disabled cues on
        Switch/RadioGroup/StatusPill, Chip remove hit area. Evidence: typecheck ok, lint 10 pre-existing
        warnings, atoms stories 168/168, `pnpm build` + check-size all ok.
  - [x] T3.2 forms. Route: delegated writer. Rendered check of 140+ forms stories (light/dark, 900px and 320px)
        with a headless Playwright audit (chrome-devtools MCP hung): contrast scan clean, no horizontal scroll at
        320, focus rings hug the control (adornment wrappers draw the ring by design). Fixed missing disabled cues
        on Input, Textarea, Select, TimeInput, AccentPicker, NumberStepper opacity/cursor, Slider track hit area
        24px. Left: Rating stars 16-20px (pointer shortcut; keyboard path is the slider).
  - [ ] T3.3 navigation + overlays + states

## Acceptance criteria
- PRODUCT.md and DESIGN.md exist and match the repo.
- Each slice lists what the pass changed and what it left alone; checks green.

## Verification evidence
T1: PRODUCT.md written; init interview answers recorded; not yet committed.
T2: DESIGN.md + .impeccable/design.json (2cc2f3cb). 28 hex values and 26 CSS variables cited were found in
the token files via rg. North Star and color character left open for the user.

## Next step
Confirm component family order (T3) and the DESIGN.md North Star.
