# auth-compose: mobile login for the Kotlin Compose kit

Branch: `feat/auth-compose` (worktree `.claude/worktrees/auth-compose`, from origin/main f279416, ui-compose 0.2.0 unreleased).
Mirror: Engram `odd/auth-compose/tasks` (project: ui). Sibling feature: `auth-layout` (web), independent files, no shared code.
TDD: disabled (owner override). Tests where they buy safety. Delivery: work-unit commits on the feature branch; no push, no tag, no version bump, no publish.

## Objective

A native mobile login screen family for `packages/ui-compose`, following the owner-approved reference: a dark header band (title + tagline + animated arcs) with a surface bottom sheet that has large rounded top corners and overlaps the header, filled pill-shaped fields with 24dp leading icons and a trailing password-reveal, a full-width pill primary button pinned at the bottom, and a small secondary link beneath. The header art reacts to form state with motion.

## Owner decisions

- Tenant colour is the app's concern. The kit only reads `UiTheme.colors` (`accent`, `accentInk`, `accentSoft`, `accent2`, `surface`, `ink`, `ink3`, `bg`, `danger`) and `UiTheme.shapes` / `sizes` / `typography`. No tenant API.
- Alternatives are selected by one parameter; slots keep the composition open (compound-style slots, the kit has no compound objects).
- Follow kit conventions exactly (below). Public API is explicit, documented, additive.

## Kit conventions (verified on origin/main)

- KMP + Compose Multiplatform 1.8.2: `commonMain` code under `kit/src/commonMain/kotlin/com/jcsoftdev/ui/<layer>/`; `explicitApi()`; binary-compatibility-validator (`./gradlew apiDump` after public API changes); each component in its own file; non-public pieces `internal`.
- Signature shape: required params, `modifier: Modifier = Modifier`, flags, then style params defaulting to `XDefaults.*` (`colors: XColors = XDefaults.colors()`, `shape`, `contentPadding`, `textStyle`), nullable slots (`leading: (@Composable () -> Unit)? = null`). State hoisted. `XColors` `@Immutable` with `copy()`. `XDefaults` with `@Composable @ReadOnlyComposable` getters over `UiTheme.*`.
- No MaterialTheme. `UiTheme { }` provides locals; read via `UiTheme.colors/shapes/sizes/typography/motion/strings`. No `@Preview`: previews are the sample galleries and Roborazzi shots.
- Reuse: `Input` (48dp min, pill via `shape = UiTheme.shapes.pill` + `colors = InputDefaults.colors().copy(container = ..., border = Color.Transparent)`, `leading`/`trailing` slots), `PasswordInput` (has trailing eye, no leading slot; do NOT change its public API, build the auth password field on `InputFrame`, which is `internal` in `forms/Input.kt`, or compose from `Input`), `Button` (`block`, `shape = UiTheme.shapes.pill`, `Ghost` = text link), `IconButton`, `Icon` + Lucide `Icons.*`, `BottomActionBar` (safeDrawing + IME aware, the pinned bottom slot), `Text`.
- `Sheet` is a modal overlay; do not use it. The login sheet is a plain surface with `RoundedCornerShape(topStart, topEnd)` (token `shapes.sheet` is 24dp).
- Motion: `UiTheme.motion.tween(Motion.STANDARD)`, `UiEasing`; `UiTheme.motion.enabled` is false when animations are off. The kit does not gate infinite animations yet: gate loops on `UiTheme.motion.enabled` and render a static frame when false.
- Accessibility: decorative art uses `Modifier.clearAndSetSemantics {}`; `IconButton` needs a `contentDescription`; inputs take `contentDescription` and `contentType` (autofill); errors set `semantics { error }`. Min touch target 48dp (`Modifier.minimumTouchTarget()`).
- Insets: `WindowInsets.safeDrawing` / `WindowInsets.ime`; content must scroll above the keyboard, bottom action stays reachable.
- Text is passed by the caller (no hardcoded login strings in the kit); only reuse `UiTheme.strings` for show/hide password.
- Tokens are generated (`generateUiTokens`, needs `node`); never edit generated files.

## Target structure (package `com.jcsoftdev.ui.auth`, new layer)

- `AuthState.kt`: `enum class AuthState { Idle, Typing, Password, Error, Success }` + `AuthProgress` helpers (pure, tested in `commonTest`).
- `AuthScaffold.kt`: header band + overlapping rounded sheet + pinned bottom slot; params `title`, `tagline`, `state`, `progress`, `art` slot (default arcs), `bottom` slot, `content`; sizes: display 32sp, tagline 16sp, sheet top radius ~32dp, header/sheet overlap ~24dp; IME-aware scroll; works edge-to-edge.
- `AuthArcs.kt`: Canvas concentric arcs sweeping the header corner; infinite drift gated by `motion.enabled`; `progress` brightens/advances, Error = brief jitter, Success = bright sweep; reduced motion = static frame. `AuthArt` parameter lets callers pass another composable (alternative looks by slot); a second built-in look is optional and minimal.
- `AuthFields.kt`: `AuthTextField` and `AuthPasswordField` in the pill style (58dp, 15sp text, 24dp leading icon, 20dp rhythm), `AuthFieldDefaults`.
- `AuthActions.kt`: `AuthPrimaryButton` (full-width pill, 62dp, 20sp semibold, loading) and `AuthLink` (13sp underlined text link, 48dp tap target).
- `LoginScreen.kt`: a thin convenience composable that assembles the above for the common case and drives `AuthState`/`progress` from the field state; fully slot-based so apps can use the parts directly.
- Sample: `AuthGallery` + `--es screen auth` branch in `SampleActivity.kt`. Tests: `commonTest` pure logic; `jvmTest` Compose UI tests (field wiring, reveal toggle, error semantics, loading disables button, state transitions with `Motion(0f)`); Roborazzi shot entries added to `Shots.kt` (goldens are recorded only by the Linux `ui-compose-record` workflow; never commit locally recorded PNGs). Docs: `docs/parity.md` entry, `CHANGELOG.md` bullet under 0.2.0 (Unreleased), `apiDump` committed.

## Tasks

- [x] C1 `AuthState`/progress model + pure tests (40f6003)
- [x] C2 `AuthArcs` art (motion-gated) and `AuthScaffold` (header, overlapping sheet, bottom slot, insets) (5c08bae)
- [x] C3 `AuthTextField`, `AuthPasswordField`, `AuthPrimaryButton`, `AuthLink`, defaults (fd664df)
- [x] C4 `LoginScreen` assembly + state driving (13603f8)
- [x] C5 Sample gallery, jvmTest UI tests, Shots entries, docs/parity, CHANGELOG, apiDump (358a2fe)
- [x] C7 (Arc shape and photo-in-art docs done in 5c08bae; sample toggle in 358a2fe; arc depth eases out in welcome mode b6f6622) `AuthHeaderShape { Overlap, Arc }` param on AuthScaffold: concave curved header edge (Path, no bitmap); document photo Painter in `art`
- [x] C8 (bb00a1d, tuned in b6f6622 and 3579e0e) `AuthFloatingArt`: 5-8 pieces in 3 depth layers from Lucide icons and primitives, per-piece drift/rotation, drag parallax with spring back, state reactions, gated on motion.enabled
- [x] C9 (b6f6622, fix 3579e0e) Welcome mode `AuthScaffold(expanded)`: full-height header with outlined-echo title, `welcomeAction` slot, one shared transition fraction (header height, title, art scale, sheet slide), back callback
- [x] C6 (partial: spotlessCheck, apiCheck, :kit:jvmTest 333 tests/0 fail/11 skipped, :kit:testDebugUnitTest 96/0, :kit:assembleRelease, :sample:assembleRelease green; :kit:allTests not completed: iOS simulator test hangs on simctl) Verification: `./gradlew spotlessCheck apiCheck :kit:allTests` (+ `:kit:assembleRelease :sample:assembleRelease` if the Android SDK is available; otherwise report it as not run), local `recordRoborazziJvm` for the new shots only to inspect the PNGs visually (do not commit them), iOS compile check only if on a Mac with the toolchain

- [x] M1 AuthArcs motion: drift, typing/progress, password dim/turn, error shake + danger flash, success comet, text keep-out at any font scale (4811a95)
- [x] M4 Gallery controls (welcome/form, overlap/arc, arcs/pieces, forced state, dark), UI tests, render-motion tests, shots, parity, CHANGELOG, apiDump (92c6abe)
- [x] K1 (ecf7533 e912f53 397a56a 4e6b4b7; sonnet, structure/behaviour) Fixes from the 2026-10-22 adversarial and visual reviews: Done key must not submit while `loading` (fields disabled while loading); header must not crush the sheet at font scale 200% (cap the title block, let the sheet scroll, keep the first field and the action reachable with the keyboard open, on 640dp and 800dp tall phones); a repeated error replays (state-change independent trigger, additive API only); accessibility focus moves to the form title after the welcome collapses; fast drags on `AuthFloatingArt` no longer drop deltas; motion render tests must fail when the effect they name is removed; remove the redundant `sheetShape` cast; parity doc wording.
- [ ] K2 (opus, motion/visual) After K1: success feedback that is visible on the login screen (today success is pixel-identical to the filled state), reference mood (header closer to black derived from tokens, white sheet also visible on the welcome, floating pieces with enough contrast, welcome title echo that does not read as a misrendered stroke), dark error state distinguishable from the accent, vertical rhythm of the form. Colours still come from `UiTheme` tokens only.

## Acceptance

- Header, sheet overlap, pill fields, pinned pill button match the reference proportions (32/16sp header text, 24dp icons, 20dp rhythm, 62dp button, 13sp link).
- Accent and dark mode follow `UiTheme` with no extra code; reduced motion gives a still header.
- Keyboard open: fields stay visible and the primary action stays reachable.
- No public API of existing components changes; `apiCheck` passes with only additive dump changes.

## Progress

- 2026-10-22: document created; nothing implemented yet.

- 2026-10-22: owner scope: header/art are inspiration only; colors from UiTheme tokens (header derived from accent/ink mix); sizes prefer kit tokens (fields InputSize.Lg 52dp, button sizes.mButton 54dp, mTitle/mBody/mButton/mMeta). C7-C9 added (queued after C1-C6). C1 done: 40f6003.
- 2026-10-22: C2-C6 done in commits 5c08bae fd664df 13603f8 358a2fe. AuthArcs is a static frame (hook: AuthArcsFrame in AuthArcs.kt). C8, C9 and all animation pending (owner: opus agent).
- 2026-10-22: motion/visual layer (opus): 4811a95 M1 arcs motion, bb00a1d M2 AuthFloatingArt, b6f6622 M3 welcome mode, 92c6abe M4 gallery/docs, 3579e0e welcome block anchored at the foot (drags reach the art). Checks: spotlessCheck, apiCheck (only additions vs main), :kit:jvmTest 357 tests/0 fail/11 skipped, :kit:testDebugUnitTest 106/0, :kit:assembleRelease, :sample:assembleRelease green; :kit:compileKotlinIosSimulatorArm64 green. verifyRoborazziJvm: 9 AuthShots fail (no Linux goldens yet, expected) plus 15 pre-existing macOS glyph diffs in other families. Device: sample on Medium_Phone_API_35 emulator: welcome, Get started, system back to welcome, IME (fields and action above keyboard), drag parallax checked. Next: record Linux goldens via ui-compose-record.
- 2026-10-22: K1 done (sonnet): ecf7533 loading/Done gate + errorKey replay + hardened render tests (frozen drift hook; each effect test fails with the effect removed, restored), e912f53 drag accumulation + sheetShape cast + parity wording, 397a56a font scale layout (header text cap 1.3x, band 40%/30%, pinned slot moves into the scroll under 480dp visible, movable content keeps state), 4e6b4b7 accessibility focus on collapse/expand. Checks: spotlessCheck, apiCheck (additions only vs origin/main), :kit:jvmTest 376 tests/0 fail/11 skipped, :kit:testDebugUnitTest 114/0, :kit:assembleRelease, :sample:assembleRelease, :kit:compileKotlinIosSimulatorArm64 green. Device (emulator, font 2.0, 360x640 and 360x800, keyboard open/closed): first field, password, link and action reachable. Done-while-loading verified by UI test only (sample has no loading state). Mirror `odd/auth-compose/tasks` pending (Engram not used by this worker).
