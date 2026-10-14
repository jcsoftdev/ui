# ui-compose accessibility and UX defaults (0.2.0)

## Objective
Fix the kit-level accessibility and UX defaults an audit of the Turnara app found in `com.jcsoftdev:ui-compose` 0.1.0, and add the missing app-level components (FAB, pinned bottom action bar, full-screen modal layer), so the 0.2.0 release carries them.

## Problem / why
The audit read the 0.1.0 sources. On main the kit is still one module (`packages/ui-compose/kit`, tokens generated from `packages/ui-tokens/tokens/default.json`); `VERSION_NAME` is already `0.2.0` and the CHANGELOG already has an unreleased `0.2.0` section (Liquid opt-in work), so no version bump is needed, only new entries in that section.

## Scope
- In: items 1-7 of the request (status tones, text wrapping at large font scale, `count` style, `Input` content type, FAB, bottom action bar, full-screen modal layer, disabled primary treatment, stronger card border), tests, API dumps, docs (parity, CHANGELOG), sample entries.
- Out: merging, tagging, publishing. Chart modules untouched.

## Constraints
- Tokens are shared with the web (`packages/ui-tokens`), so token edits also regenerate `styles/Theme.kt`, `tokens.css` and goldens there.
- Pay-for-what-you-use: every new component lives in its own file and nothing in the existing kit references it (R8 drops it for apps that do not name it).
- No Co-Authored-By or AI attribution in commits; conventional commits; ~400 authored lines per commit.
- Screenshot goldens are Linux-rendered; never commit macOS recordings.

## TDD mode
Disabled (user override: implement first, tests where they buy safety). Runner: `./gradlew :kit:jvmTest` and `:kit:allTests`; `verifyRoborazziJvm` on CI (Linux).

## Delivery strategy
ask-on-risk, single PR into main with work-unit commits.

## Tasks
- [ ] A1 Tokens: distinct `danger-soft` (light and dark) from `accent-soft`, `count` text style 12/1.2, contrast test over the soft/ink pairs. Route: inline (tokens json, generated outputs, one test).
- [ ] A2 Large font scale: `Button`, `Chip`, `Segmented` wrap to 2 lines when `fontScale > 1.3`. Route: inline.
- [ ] A3 `Input`/`PasswordInput` content type (`InputContentType`), placeholder kept consistent. Route: inline.
- [ ] A4 Disabled treatment for buttons (legible label, no alpha dim) and stronger card border (`CardDefaults.colors(outlined)`, high contrast). Route: inline.
- [ ] A5 `FloatingActionButton` (extended and icon-only, 56dp, role, reduced motion). Route: inline.
- [ ] A6 `BottomActionBar` (pinned above a dock, insets). Route: inline.
- [ ] A7 `FullScreenModal` (hides background from a11y, focus to header, back). Route: inline.
- [ ] A8 CHANGELOG, parity doc, sample gallery, API dumps, final checks, push, PR, CI.

## Authorized scope
Everything under `packages/ui-compose`, `packages/ui-tokens` (tokens and generated outputs), `odd/tasks`.

## Acceptance criteria
- `spotlessCheck apiCheck :kit:allTests` green locally (Roborazzi verify only on Linux CI).
- Soft status fills distinct, text on every soft fill >= 4.5:1, in light and dark.
- New components have semantics tests; API dumps updated.

## Route declaration
Inline throughout: each task is a small set of understood files and the parent asked for one executor; no mapping trigger fired (the 4+ file read was done once, up front).

## Progress / evidence
(updated per task)

## Next step
A1.
