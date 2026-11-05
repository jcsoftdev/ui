# Changelogs for ui-tokens, ui-core and ui-elements

## Objective
Add a `CHANGELOG.md` to each npm package that has none (`packages/ui-tokens`, `packages/ui-core`,
`packages/ui-elements`), in the format of `packages/ui/CHANGELOG.md`.

## Problem
All four npm packages are published in lockstep at 0.9.0 but only `packages/ui` has a changelog.

## Scope
- In: three new `CHANGELOG.md` files; a one-line mention in each package README only if the README already
  has a docs or links section.
- Out: editing `packages/ui/CHANGELOG.md`, release scripts, versions, `ui-compose`.

## Constraints
- Every entry must be derived from `git log` of that package path (and tags/releases if they exist), never
  invented. Group by version when version bumps can be located in history (`git log -p -S'"version"' --
  packages/<pkg>/package.json`); entries that predate the first bump go under the first released version.
- Match the heading style, date format and section names used in `packages/ui/CHANGELOG.md`.
- Keep entries user-facing (feat/fix/perf/breaking), drop chore/docs/test noise. Large packages
  (ui-elements: 270 commits) get summarized by theme per version, not one line per commit.
- Artifacts in English. Conventional Commits, no AI attribution. No push, no PR.

## Resolved settings
- TDD: off (user global override); docs only. Checks: format with the repo's markdown formatter if one is
  configured, verify each version heading exists in package.json history.
- Delivery: ask-on-risk; forecast under 400 changed lines.

## Tasks
- [ ] T1 Three changelogs, one commit `docs: add changelogs for ui-tokens, ui-core and ui-elements`.
      Route: delegated writer (sonnet), reading git history for 3 packages.

## Acceptance criteria
- Each file's versions match the versions that appear in that package's `package.json` history.
- No entry that cannot be traced to a commit.

## Verification evidence
(none yet)

## Next step
Run T1 through the delegated writer.
