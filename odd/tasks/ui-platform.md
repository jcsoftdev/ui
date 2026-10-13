# ui-platform: package split, tokens, theme engine (P0-P2)

## Objective
Evolve jcsoftdev/ui from one React package into a lockstep-versioned platform
(`@jcsoftdev/ui-tokens`, `ui-core`, `ui-elements`, `ui`) without breaking 0.2.x consumers.
This document covers phases P0-P2 only. P3+ (ui-core, ui-elements) are follow-ups.

## Approved decisions (user, 2026-10-12)
- Option A split, lockstep versions: ui-tokens, ui-core, ui-elements; `@jcsoftdev/ui` (React) rebuilt
  incrementally on core and re-exports tokens so 0.2.x consumers keep working.
- Shadow DOM for leaf controls, light DOM for composites.
- Phase-1 elements: button, input, checkbox, switch, radio-group, dialog, popover, tooltip, tabs, toast.
- `ui-` tag prefix with `define(customTag)`.
- Theme API v1 = brand + accent + neutral seeds (+ optional danger override), WCAG AA guarantees, no APCA.
- Ship per-component precompiled CSS for vanilla users.
- CI size budget gate (`check:size`).
- Prefer native platform features (`<dialog>.showModal`, Popover API, `inert`), JS fallback otherwise.
- Zero runtime dependencies in every package.

## Constraints
- English artifacts, Conventional Commits, no AI attribution. No push/tag/publish/PR.
- Tests where they buy safety, same commit as the change. Real-render checks over regex audits.
- Compose (`packages/ui-compose`) keeps generating Theme.kt from the tokens source.

## Route
Delegated direct: platform-fact research delegated to a read-only worker (sonnet); everything else
written inline by the orchestrating worker in this worktree (`/Users/jcsoftdev/personal/ui-platform`,
branch `feat/ui-tokens-theme`).

## Tasks
- [x] P0.1 ADR `docs/adr/0001-package-split.md` (decisions, rationale, alternatives).
- [x] P0.2 Verify platform facts with primary sources (cross-root ARIA; DSD, delegatesfocus, Popover, :state()); record URLs in the ADR.
- [x] P0.3 Release workflow for lockstep multi-package publish, inert until trusted publishing is configured; current `@jcsoftdev/ui` publish keeps working.
- [x] P1.1 `packages/ui-tokens`: move tokens JSON, CSS outputs, build-theme script, `ui-theme` CLI; add `tailwind.css`.
- [x] P1.2 `@jcsoftdev/ui` consumes ui-tokens (workspace) and ships byte-identical `styles/*`, `tokens/*`, `bin`; pack + consumer install test.
- [x] P1.3 Compose generator + CI path filters follow the move; `generateUiTokens` verified.
- [x] P1.4 Site: stable CSS variable contract page + component-level var convention (`--ui-<component>-<prop>`).
- [x] P2.1 `createTheme` (OKLCH, gamut mapping, contrast solver, same JSON shape as default.json), `toCss`, `applyTheme`, CLI `ui-theme generate`.
- [x] P2.2 Golden + property tests (random seeds, determinism, no-DOM import, SSR import); verify data-accent presets against createTheme.
- [x] P2.3 Playground `examples/vanilla-theme` verified in Chromium (screenshots outside the repo). Site "Theme builder" page: not done (follow-up); the site documents the API instead.
- [x] P2.4 `check:size` gzip budgets wired into CI.

## Acceptance
- All existing `packages/ui` checks pass unchanged: lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, test:stories, test:glass; root build:site.
- Packed `@jcsoftdev/ui` exposes the same `styles/*`, `tokens/*`, `ui-theme` bin as 0.2.0 (byte-identical outputs).
- Every createTheme fg/bg pair meets 4.5:1 (text) or 3:1 (UI) for 1000+ random seeds, light and dark.
- Compose `:kit:generateUiTokens` still works.

## Checks
`pnpm lint && pnpm test && pnpm build && pnpm typecheck && pnpm check:treeshake && pnpm check:dist-imports && pnpm check:docs-examples && pnpm --filter @jcsoftdev/ui test:stories && pnpm --filter @jcsoftdev/ui test:glass && pnpm build:site && pnpm check:size`.
TDD: disabled (project policy: implement first, then protective tests).

## Progress / evidence
- P0: a2d6090 (ADR + release plan, inert: publish-packages.json lists only packages/ui). Route: research delegated (sonnet), rest inline.
- P1: 68c48db (ui-tokens extraction, sync-tokens, pack check, Compose paths), site contract page (docs(site) commit).
- P2: 01c8953 (createTheme, toCss, applyTheme, ui-theme generate, tests), playground commit, size gate commit.
- Checks observed: lint, test (ui-tokens 44, ui 492, site 23, root 3), build, typecheck, check:treeshake, check:dist-imports, check:docs-examples, check:size, check:pack, test:stories (209 files, 1402 tests), test:glass (116), build:site, playground e2e, Compose `:kit:generateUiTokens apiCheck`: all exit 0.
- Finding: existing menta preset's accent-word is 2.88:1 on the light page bg (3:1 on surface); pinned in a test, visuals unchanged.
- Correction pass (verifier PASS-WITH-FOLLOWUPS), route: inline: (1) toCss uses :where() so generated rules weigh as `selector` and `:root[data-accent]` presets win in dark; nested `[data-theme]` light/dark descendants re-declared (also fixes limitation 4); (2) CONTRAST_PAIRS + solver cover accent-ink/surface-2, line-control/surface-2+float, accent-word/float; (3) applyTheme: per-call style, random id, re-apply replaces, dispose removes only its own; (5) solver targets 4.55/3.05, docs still say AA; (6) prestorybook, prebuild-storybook, site predev/prebuild sync tokens; (7) CHANGELOG notes; (8) size budgets for all 19 ui dist entries at ~8% headroom, dom.js raised 550 to 650; (9) ui-tokens README, `generate --brand <bad>` clean error exit 1, release plan no misleading tag error. Regression tests verified to fail on the old code (9 ui-tokens tests + release-plan). Commits: fix(tokens) and chore commits after 769c547.
- Checks observed after the pass: lint, test (ui-tokens 53, ui 492, site 23, root 3), build, typecheck, check:treeshake, check:dist-imports, check:docs-examples, check:size, check:pack, build:site: all exit 0. test:stories and test:glass not re-run (no kit source changed).
- Next: user configures npm trusted publishers for new package names, then adds them to .github/publish-packages.json; P3 ui-core.
