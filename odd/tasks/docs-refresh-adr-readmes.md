# Docs refresh: ADR 0001 status, root README, site README

## Objective
Bring the top-level documentation in line with the repository as it is on `main` (all packages at 0.9.0).

## Problems (mapped from origin/main, 2026-11-04)
- `docs/adr/0001-package-split.md` still says `ui-core` and `ui-elements` are "later", omits `ui-compose`,
  lists 10 elements (there are dozens) and says `publish-packages.json` contains only `packages/ui`.
- Root `README.md` layout lists only `packages/ui`, `site`, `deploy`; "Releasing" mentions only `packages/ui`
  although releases are lockstep; no links to the other package READMEs, `docs/`, the ADR or `odd/`.
- `site/README.md` says six hand-written pages exist; the sidebar (`site/astro.config.mjs`) has 15.

## Scope
- In: the three files above, plus an `docs/README.md` index (contributing guides, ADRs, compose parity).
- Out: moving or renaming site docs (the doubled `docs/docs` path stays, URLs), new site pages for
  ui-core/ui-elements/ui-compose (PR 2), CHANGELOGs, `ui-compose` version mismatch, anything under `odd/`.

## Constraints
- Every statement must be checked against the files on this branch (versions, package list, publish list,
  sidebar). Do not copy numbers from this document.
- Keep the ADR's decision history: add a dated "Status update" section instead of rewriting the original
  decision text, and fix only facts that are now false.
- Artifacts in English. Conventional Commits, no AI attribution. No push, no PR.

## Resolved settings
- TDD: off (user global override); docs only, so checks are link and fact verification.
- Delivery: ask-on-risk; forecast well under 400 changed lines.

## Tasks
- [x] T1 ADR 0001 status update + root README + site/README + docs/README.md index. One commit
      `docs: ...`. Route: delegated writer (sonnet), 4 non-trivial files.

## Acceptance criteria
- Each relative link in the touched files resolves to an existing file on the branch.
- Package list, versions and publish list in the docs match `packages/*/package.json` and
  `.github/publish-packages.json`.
- Sidebar page count in `site/README.md` matches `site/astro.config.mjs`.

## Verification evidence
T1 commit 7a72745a: `docs: refresh the ADR status, the root README and the site README`.
- Relative link check over README.md, site/README.md, docs/README.md, docs/adr/0001-package-split.md: all targets exist.
- `git diff --stat` (pre-commit): 4 files (3 modified, docs/README.md new), 34 insertions, 9 deletions plus the new index.
- Versions quoted: ui, ui-tokens, ui-core, ui-elements 0.9.0 (package.json); ui-compose 0.2.0 (gradle.properties, no package.json, outside pnpm-workspace and release-plan).
- publish-packages.json quoted as `{ "packages": ["packages/ui"] }`, matches the file.
- Sidebar: 15 hand-written entries counted from astro.config.mjs and the docs directory.

## Next step
T1 done; review the diff.
