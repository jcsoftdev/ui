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
  - [x] T3.3 navigation + overlays + states. Route: delegated writer. Headless Playwright audit of 148 stories
        (light/dark, 900 and 320px): contrast scan clean except disabled text (exempt), no horizontal scroll at
        320, dialog/drawer/alert-dialog/popover/menu verified at 320 (focus moves in, Escape closes, focus returns to
        trigger, body scroll lock, no overflow), Banner/LiveStatusBar/Toaster/Skeleton carry status/alert roles,
        reduced motion covered by base.css. Fixed: no disabled cue on TabsTrigger and SegmentedItem, Breadcrumbs
        link hit area 18px to 30px. Left: story-composed small targets (HoverCard trigger link, ErrorState action
        link, menu trigger in a story), FloatingToc narrow story links 22px wide (story container), tooltip
        open/close left to its existing tests.
  - [x] T3.4 containers. Route: delegated writer. Headless Playwright audit of 304 stories (light/dark, 900 and
        320px, real Tab presses for focus): fixed Carousel dot, Table sort/pin button and Resizable handle hit
        areas (24px), ActionBar clear button shrinking to 16px, Pagination pages row overflowing at 320, HBars
        sr-only table adding horizontal scroll, Scrolly inactive step contrast (0.6 to 0.8), disabled cues
        (0.5 + not-allowed) on Pagination, DataGrid toolbar/step/tool buttons, formula bar, Carousel arrows,
        SelectableCard. Left: DataGrid dense checkbox (16px) and tree toggle (20px) (pointer shortcuts, keyboard is
        the cell), FloorPlan tables 23px tall, story-fixed widths overflowing at 320 (ListDetail, Page, Feed,
        DescriptionList, DataGrid narrow), story markup targets (KPI actions, Aside link), "Paso" label contrast
        in the Scrolly story. Evidence: typecheck ok, lint 10 pre-existing warnings, containers stories 304/304,
        `pnpm build` + check:size ok.
  - [x] T3.5 charts. Route: delegated writer. Headless Playwright audit of 632 chart stories (light/dark, 900 and
        320px, real Tab presses, reduced motion): no unnamed charts, no missing focus rings, no running animations
        under reduced motion. Fixed R² label contrast on ScatterChart, hit areas (chart breadcrumb, map data table
        sort, Crossfilter clear, BarRace slider, TreeChart badge, Gantt row toggle), ring skeleton overflow. Left:
        story-fixed widths overflowing at 320 (all `narrow`/`fill-parent` stories), palette-token contrast
        (BubbleMap cluster counts, ComboChart colored axis labels), Gantt splitter 10px.


## Acceptance criteria
- PRODUCT.md and DESIGN.md exist and match the repo.
- Each slice lists what the pass changed and what it left alone; checks green.

## Verification evidence
T1: PRODUCT.md written; init interview answers recorded; not yet committed.
T2: DESIGN.md + .impeccable/design.json (2cc2f3cb). 28 hex values and 26 CSS variables cited were found in
the token files via rg. North Star and color character left open for the user.

## Next step
Confirm component family order (T3) and the DESIGN.md North Star.
