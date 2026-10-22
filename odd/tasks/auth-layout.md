# auth-layout: login screen family for @jcsoftdev/ui

Branch: `feat/auth-layout` (worktree `.claude/worktrees/auth-layout`, from origin/main f279416, ui 0.4.0).
Locator mirror: Engram `odd/auth-layout/tasks` (project: ui).
TDD: disabled (owner override). Tests where they buy safety: pure model logic, a11y/behaviour of LoginForm.
Delivery: work-unit commits on the feature branch. No push, no tag, no publish (release is a separate authorization).

## Objective

Add an animated, themeable login screen to the library: a split layout with an illustration that reacts to the form,
built from compound components, container queries and the existing token system, with interchangeable looks selected by one prop.

## Decisions (owner, 2026-10-22)

- Tenant branding is NOT a library concern. The app sets `--accent*` / `data-accent` / theme; the library reads only its own tokens.
  No `tenant` or `tenantColor` prop. Default look = the library's default accent, for free.
- The slabs ("bases") are colored from tokens: accent, surface, ink. Dark mode and every `data-accent` work with no extra code.
- Everything is container-query driven (no viewport media queries for layout).
- Looks are alternatives behind one prop, via compound components.
- Follow the library's existing conventions (see Conventions). Atoms stay atoms: new generic pieces go in their proper layer, not inside `auth/`.

## Conventions to follow (from origin/main, verified by mapping)

- Components live in `packages/ui/src/<layer>/<component>/` with `x.tsx`, `index.ts` (`export * from "./x.js"`), `x.stories.tsx`, optional `model.ts` (pure logic) tested in `packages/ui/test/*.test.mjs`.
- Compound pattern: `containers/section/section.tsx` (context, `Section.Part = Part`, throwing hook `X.Part must be rendered inside a X`, `classNames?: ClassNames<Part>` merged via `cn`, parts also exported flat). Refs are plain React 19 props. `asChild` via `utils/slot.tsx`.
- Container queries: root declares `@container/<name>`, children use `@sm/<name>:` / `@max-*` variants. Guide: `site/src/content/docs/docs/container-queries.md`.
- Styling: Tailwind v4 maps, `cn` from `utils/cn.ts`, tokens `--bg --surface --ink --line --accent --accent-2 --accent-soft --accent-ink --on-accent --danger`, utilities like `surface-card rounded-card shadow-card h-control focus-visible:focus-ring`. No cva.
- Motion: global reduced-motion rule in `ui-tokens/styles/base.css` tames CSS animations/transitions. Use CSS transitions with `--motion-ease`; hook `usePrefersReducedMotion()` for JS only. No SMIL.
- Strings via `useUiStrings()` (`i18n/`, en + es).
- Imports are relative with `.js` suffix; `"use client"` on stateful files. New top-level layer needs a `packages/ui/tsup.config.ts` entry (wildcard `exports` needs nothing).

## Target structure

- `forms/password-input/` PasswordInput (Input with end slot + IconButton reveal; aria-pressed, localized labels).
- `atoms/divider/` Divider (horizontal, optional label; role=separator semantics).
- `auth/auth-illustration/` `AuthIllustration` with `variant: "slabs" | "stack" | "mosaic"`, `state`, `progress`, `activeIndex`; `model.ts` pure mapping state/progress -> spread/lift numbers; one file per variant under `variants/`.
- `auth/auth-layout/` compound `AuthLayout` (+ `.Brand`, `.Art`, `.Panel`, `.Footer`), `layout: "split" | "split-reverse" | "centered"`, owns/provides the auth state (controlled or uncontrolled) through context.
- `auth/login-form/` compound `LoginForm` (+ `.Header`, `.Portals`, `.Identifier`, `.Password`, `.Error`, `.Submit`, `.Footer`); drives illustration state from focus/typing/error/success via the AuthLayout context when present, works standalone otherwise.
- Stories for every variant x state x layout and a narrow-container story; story-level test for LoginForm a11y flow; docs page registration; CHANGELOG "Unreleased" entry.

Illustration visual spec = the approved mockup (published at https://claude.ai/artifact/2G3xtw9Qt9qgxTpcJC63ZU, source `/private/tmp/claude-501/-Users-jcsoftdev-personal-edumodules/d67a8a9f-6904-4107-a623-9efbe3e5779b/scratchpad/login-options.html`): three isometric slabs (book / house / cap) with halftone sides, drop-in entrance, bob, spread driven by state:
idle .85, id focus .65 (-.03 per char, min .35), password .22 (-.02 per char, min .05), error 1.35 then back, success 0 then spark burst. `activeIndex` lifts one slab by 20. Positions/lifts are CSS custom properties (`--spread`, `--lift`) set from `data-state` and inline numbers, transitions in CSS, no JS animation loop.

## Tasks

- [x] A1 Atoms: `forms/password-input`, `atoms/divider`, i18n strings (en/es), stories, exports
- [x] A2 (slabs only; stack and mosaic moved to A10) `auth/auth-illustration`: model.ts + tests, variant `slabs`, token-derived colors via `color-mix`, CSS transitions, reduced-motion safe
- [x] A3 `auth/auth-layout`: compound parts, context, `@container/auth` layouts (split, split-reverse, centered), art collapses by container width
- [x] A4 `auth/login-form`: compound parts, Portals radiogroup, state driving, a11y (Field wiring, aria-invalid, role=alert)
- [x] A5 Stories (variants x states x layouts, narrow), story test, docs page, CHANGELOG, tsup entry
- [ ] A6 Verification: lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, check:size, check:pack, test:stories; visual check in Storybook through chrome-devtools MCP (light, dark, two accents, narrow container, reduced motion)

- [ ] A7 Illustration variants from the Rive and Wise references, same `state`/`progress`/`activeIndex` contract, token colors, CSS motion, reduced motion = still
  - `character`: original flat student with backpack on a floating board over a pulsing ground shadow; bob, pointer-follow eyes (two CSS vars), blink, eyes closed or away on password, head shake on error, hop plus board boost burst on success
  - `statement`: kinetic uppercase heavy headline with staggered words, a rounded pill with an arrow that loops and advances with `progress`; props `headline`, `caption`, optional `action` slot
- [ ] A8 Composition variants: `AuthLayout panel="paper"|"solid"` (solid = full-height colored side panel, open form on the other side, container-query driven); `LoginForm appearance="card"|"open"` (open = no card chrome, labels above, pill primary button, new parts `Options` and `Providers`); no sign-up tabs
- [-] A9 Dropped by the owner: the sheet composition, `arcs` and `appearance="pill"` belong to the native mobile app (ui-compose), a separate feature. On the web narrow containers stack the art above the form. Nothing was implemented.
- [ ] A10 Minimal alternatives `stack` and `mosaic` (lint, typecheck, stories only), separate commits, droppable

## Acceptance

- One prop switches the illustration look; one prop switches the layout; accent and dark mode follow tokens with no extra code.
- Layout responds to its container width, not the viewport (story rendered in a 360px and a 1100px box proves it).
- Keyboard and screen reader flow correct; reduced motion leaves a still, assembled illustration.
- All CI steps listed in A6 pass.

## Progress

- 2026-10-22: document created; nothing implemented yet.
- 2026-10-22: A1 done in a624d0f (PasswordInput, Divider, Eye/Mail/House/GraduationCap icons, 10 en/es strings). biome and tsc clean, icons and i18n node tests 9/9. Story tests run in A6. Route: inline.
- 2026-10-22: owner priority change: slabs + AuthLayout split + LoginForm get full polish first. `stack` and `mosaic` are kept minimal and land last as separate work units (A10), droppable without touching slabs.
- 2026-10-22: A2 done in 55320ae (slabs, model + 5 node tests). A3 done next commit (AuthLayout with split, split-reverse, centered; container-query story asserts art drops at 360, stacks at 600, sits beside at 1100). Stories for auth + atoms: 22/22 passing locally.
- 2026-10-22: owner dropped A9 (mobile sheet: native app, ui-compose). Nothing of it was implemented. A4 done: LoginForm with Header/Portals/Identifier/Password/Error/Submit/Footer; stories with play tests for standalone submit, portals arrow keys, missing identifier, wrong password (aria-invalid, role=alert, focus) and the AuthLayout state flow; auth stories 24/24 locally.
- 2026-10-22: A5 done (595a85f docs, stories, changelog). A6 partial: lint, test (ui 677/677, ui-elements 181/181, core 135, tokens 59, site 23), build, typecheck, treeshake, dist-imports, size, pack and full stories (247 files, 1699 tests) green. check:docs-examples fails on the pre-existing "table" drift (identical on a clean origin/main build); the auth regions match their source. Visual check in Storybook NOT done. Owner rule: further motion work (A7 character/statement, stack/mosaic motion, any change to the slabs transitions) goes to an opus agent; A8 composition not started.
