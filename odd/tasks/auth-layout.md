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
- [x] A6 Verification: lint, typecheck, test, build, check:treeshake, check:dist-imports, check:docs-examples, check:size, check:pack, test:stories; visual check in Storybook through chrome-devtools MCP (light, dark, two accents, narrow container, reduced motion)

- [x] A7 (opus) Illustration variants `character` and `statement` from the Rive and Wise references. Plug point is ready: add the name to `AuthIllustrationVariant` and a component to `AUTH_VARIANTS` in `auth/auth-illustration/variants/index.ts`.
- [x] A8 Composition variants (structure only): `AuthLayout panel="paper"|"solid"`, `LoginForm appearance="card"|"open"`, `LoginForm.Options`, `LoginForm.Providers`; no sign-up tabs; AuthIllustration `variant` plug-in point
- [-] A9 Dropped by the owner: the sheet composition, `arcs` and `appearance="pill"` belong to the native mobile app (ui-compose), a separate feature. On the web narrow containers stack the art above the form. Nothing was implemented.
- [x] A10 (opus) redesign with better visual craft: `stack` and `mosaic` variants that adapt their composition to their container size. The owner liked the idea, not the first mockup. The saved first model code is at /private/tmp/claude-501/-Users-jcsoftdev-personal-edumodules/d67a8a9f-6904-4107-a623-9efbe3e5779b/scratchpad/stack-mosaic-model.ts (stackPlaced, mosaicLit, MOSAIC_ORDER).
- [x] A11 (sonnet, structure only) Bundle optimization inside the library: the `AUTH_VARIANTS` string registry pulls all five looks into every consumer. Owner decision 2026-10-22: optimize in `@jcsoftdev/ui` first (one entry per look plus real tree shaking), consumers adopt it afterwards. Looks become independently importable (`@jcsoftdev/ui/auth/<look>` subpath entries); `AuthIllustration` receives a look component instead of resolving a string; default look is `slabs` only; a separate registry wrapper keeps the string `variant` convenience and pays the full weight on purpose. Extend `check:treeshake` so a slabs-only import provably excludes stack, mosaic, character and statement; restore the `ui/auth` size budget to what the default entry now weighs. No motion changes.

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
- 2026-10-22: A8 structure done (solid panel, open appearance, Options, Providers, variant registry with `@container/art`). A7 and A10 are pending-opus; the Storybook visual check is also left to the opus agent.
- 2026-10-22 (opus, motion and visual layer): Storybook visual QA through chrome-devtools (leased port 6006) found and fixed: accent slab invisible on the solid panel (panel now `--accent` with a duotone illustration), light "shadows" and card glow in dark mode, extra gap before Sign in, checkbox 11px off, open form flush in a paper card, narrow solid brand overlap, double focus ring on adorned inputs (library-wide `Input` bug) in dcd3b82 and 4cfcbde. Slabs motion (parallax from rAF-throttled `--px/--py`, keystroke hops, entrance stagger, success burst, error settles to password after `ERROR_HOLD_MS` 1.1s) in 6245ece. New looks: `stack` 2925edf, `mosaic` 6291083, `character` 62982e5, `statement` 204eeba; lint fix and budgets 5acce09. Route: inline (single opus writer, owner rule). Size budgets raised with reasons in each commit: ui/auth 22800 -> 32300, ui/i18n 1600 -> 1700, ui/overlays 30850 -> 30950.
- 2026-10-22 verification at 5acce09 + docs format: typecheck, test (ui 686 + 10 auth model, ui-core 135 + 482, ui-elements 181 + 65, tokens 59, site 23; 0 failed), build, check:treeshake, check:dist-imports, check:size, check:pack green; test:stories 248 files / 1716 tests passed. check:docs-examples fails only on the pre-existing `table` drift in blocks.md; auth regions login, controlled, solid, looks, statement match. Lint: the statement svg error fixed in 5acce09 and auth.md reformatted with prettier in the following docs commit. Reduced motion (Playwright emulateMedia, only for that feature): 0 running animations in the stack, mosaic, character, statement and LoginScreen stories; only transform and opacity animate (getAnimations).
- Open: every look ships in the `@jcsoftdev/ui/auth` entry (about 2 to 3 KB gzip each); a per-look entry or lazy registry would keep unused looks out of apps.
- 2026-10-22 A11 done (sonnet, inline route, single writer). `AuthIllustration` takes `look` (component, default `Slabs`), `AuthLayout.Art` forwards it, each look is a subpath `@jcsoftdev/ui/auth/{slabs,stack,mosaic,character,statement}` and `AuthIllustrationAny` lives in `@jcsoftdev/ui/auth/looks` (all five on purpose). Looks describe themselves with static `variant` (data-variant) and `text` (not aria-hidden). `auth-styles.tsx` now holds only shared rules; slab rules moved to the slabs look. Gzip before -> after: `ui/auth` entry 32060 -> 23144, AuthLayout+LoginForm app (default look) 31875 -> 22960; looks alone: slabs 2604, stack 3740, mosaic 3235, character 3960, statement 3274; `auth/looks` 21872. Budgets: ui/auth 32300 -> 24000, new ui/auth/{looks,slabs,stack,mosaic,character,statement}. Checks: lint (10 pre-existing warnings, none in auth), typecheck, test 688/688, build, check:treeshake (new auth section), check:dist-imports, check:size, check:pack green; test:stories 248 files / 1717 tests; check:docs-examples fails only on the known `table` drift (auth regions login, controlled, solid, looks, by-name, statement verified equal by hand). Commit: see `git log` (refactor(auth): one entry per illustration look). Engram mirror `odd/auth-layout/tasks`: pending (tool not used by this worker).
