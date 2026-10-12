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
- [ ] P0.1 ADR `docs/adr/0001-package-split.md` (decisions, rationale, alternatives).
- [ ] P0.2 Verify platform facts with primary sources (cross-root ARIA; DSD, delegatesfocus, Popover, :state()); record URLs in the ADR.
- [ ] P0.3 Release workflow for lockstep multi-package publish, inert until trusted publishing is configured; current `@jcsoftdev/ui` publish keeps working.
- [ ] P1.1 `packages/ui-tokens`: move tokens JSON, CSS outputs, build-theme script, `ui-theme` CLI; add `tailwind.css`.
- [ ] P1.2 `@jcsoftdev/ui` consumes ui-tokens (workspace) and ships byte-identical `styles/*`, `tokens/*`, `bin`; pack + consumer install test.
- [ ] P1.3 Compose generator + CI path filters follow the move; `generateUiTokens` verified.
- [ ] P1.4 Site: stable CSS variable contract page + component-level var convention (`--ui-<component>-<prop>`).
- [ ] P2.1 `createTheme` (OKLCH, gamut mapping, contrast solver, same JSON shape as default.json), `toCss`, `applyTheme`, CLI `ui-theme generate`.
- [ ] P2.2 Golden + property tests (random seeds, determinism, no-DOM import, SSR import); verify data-accent presets against createTheme.
- [ ] P2.3 Playground `examples/vanilla-theme` + site "Theme builder" page if cheap; real Chromium screenshots.
- [ ] P2.4 `check:size` gzip budgets wired into CI.

## Acceptance
- All existing `packages/ui` checks pass unchanged: lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, test:stories, test:glass; root build:site.
- Packed `@jcsoftdev/ui` exposes the same `styles/*`, `tokens/*`, `ui-theme` bin as 0.2.0 (byte-identical outputs).
- Every createTheme fg/bg pair meets 4.5:1 (text) or 3:1 (UI) for 1000+ random seeds, light and dark.
- Compose `:kit:generateUiTokens` still works.

## Checks
`pnpm lint && pnpm test && pnpm build && pnpm typecheck && pnpm check:treeshake && pnpm check:dist-imports && pnpm check:docs-examples && pnpm --filter @jcsoftdev/ui test:stories && pnpm --filter @jcsoftdev/ui test:glass && pnpm build:site && pnpm check:size`.
TDD: disabled (project policy: implement first, then protective tests).

## Progress / evidence
(filled as tasks close)
