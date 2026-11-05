# Site docs: pages for ui-core, ui-elements and ui-compose

## Objective
Give the three packages that only have a README a page each in the docs site, linked from the sidebar, so the
site documents every package in the repository.

## Problem (mapped from origin/main, 2026-11-04)
`site/src/content/docs/docs/` has no page for `ui-core`, `ui-elements` or `ui-compose`; only `ui-tokens` has
one, inside `theming/theme-generator`. Their READMEs (`packages/*/README.md`) are the only documentation.

## Scope
- In: three hand-written pages under `site/src/content/docs/docs/` (a `packages/` folder or flat names; follow
  how existing pages are organized), the sidebar entry in `site/astro.config.mjs`, the `section:` frontmatter
  required by `site/src/content.config.ts`, a link to each page from `site/README.md` if it lists pages.
- Out: changelogs for packages without one (needs release history, separate task), renaming the doubled
  `docs/docs` path, generated pages (`components/*`, `reference/exports`, `subpaths`, `theming/tokens`),
  changing package READMEs.

## Constraints
- Pages summarize and link to the package README; no second source of truth for API lists. Prefer a short
  how-to-install, what-it-is, one usage example copied from the README, and a link out.
- Every code example must come from the README or source on this branch.
- Check how `llms.txt` is built from page `section:` so the new pages show up there too.
- Artifacts in English. Conventional Commits, no AI attribution. No push, no PR.

## Resolved settings
- TDD: off (user global override). Checks: site typecheck/build if it runs offline, else frontmatter schema
  and link verification.
- Delivery: ask-on-risk; forecast under 400 changed lines.

## Tasks
- [x] T1 (a0c16657) Three pages + sidebar + frontmatter + site/README mention. One `docs(site): ...` commit.
      Route: delegated writer (sonnet), 4+ non-trivial files.

## Acceptance criteria
- Sidebar shows the new pages; frontmatter validates against the content schema.
- `llms.txt` generation includes them (verified from the code or a build).
- Links in the new pages resolve.

## Verification evidence
- T1 a0c16657: pages under docs/packages/, `Packages` sidebar group, `section: Packages` (llms.txt picks it up via getDocPages/sectionOf, appended after SECTION_ORDER). Link targets checked on disk. Site build/typecheck not run (no node_modules; needs ui build). Prettier not run.

## Next step
Run T1 through the delegated writer.
