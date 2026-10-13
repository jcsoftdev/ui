# Changelog

## 0.3.0 (unreleased)

### Liquid Glass is opt-in (breaking for the 0.3.0 previews)

Liquid Glass now costs nothing until an app asks for it. This replaces the material objects and
the per-component lens of the earlier 0.3.0 previews, which were never published (0.2.x users have
nothing to change).

- **Non-liquid components carry no liquid code.** Card, Dialog, Drawer, Popover, DropdownMenu,
  ContextMenu, HoverCard, Topbar, Sidebar, ActionBar and CommandPalette are back to plain class
  names: no lens hook, no option mapping, no glass-card detection, no ref composition, and no
  chunk they could fetch later. `check:treeshake` asserts that no chunk of the `atoms`, `ai`,
  `containers`, `forms`, `navigation`, `overlays`, `palette`, `primitives`, `shell` and `utils`
  entries, eager or lazy, holds a glass module, so a page without Liquid Glass cannot fetch one at
  run time. Sizes match the build before Liquid Glass (#35) within 15 bytes gzip (`shell` 10057 B, `overlays` 27125 B,
  `containers` 89025 B, `utils` 7678 B).
- **New `@jcsoftdev/ui/liquid` entry** for the declarative API: `<LiquidGlass />`,
  `startLiquidGlass()`, `liquidStyle()`, `liquidVars()`, `mergeLiquid()`, `LIQUID_DEFAULTS`,
  `LIQUID_PRESETS`, `LIQUID_PRESET_CLEAR`, `LIQUID_PRESET_REGULAR`, `LIQUID_PRESET_THICK`,
  `LIQUID_PRESET_CRYSTAL`, `supportsBackdropRefraction()` and the option types. It holds no static
  import of the lens engine, so even a bundler that splits by file (esbuild) keeps the engine out
  of the first load. `@jcsoftdev/ui/glass` keeps the imperative engine and the map builders.
- **`<LiquidGlass />`** (or `startLiquidGlass()`, which returns its stop; calls are counted) is the
  only thing that loads the lens. Render it once near the root. It watches the document (classes,
  `data-glass`, `data-glass-lens`, `data-style`, `data-theme`, added and removed nodes, and the
  transparency, contrast and motion preferences) and gives the lens to every surface whose CSS
  resolves to `--glass-lens: 1` with a backdrop filter (computed, so `md:liquid`, `dark:liquid`,
  `data-[state=open]:liquid`, `aria-*` and `group-*` variants, container queries and an inline
  `--glass-lens` count; pseudo-class variants such as `hover:liquid` are not followed; a custom
  `@apply liquid` class needs `data-glass-lens="on"`),
  fetching the engine the first time one does and retrying a failed fetch with a backoff (six attempts at most). It does
  nothing on the server and nothing where the lens cannot paint (Safari, Firefox).
- **A lens applied by code and the watcher share an element safely.** Each element's lens keeps one
  claim per owner: `applyGlassRefraction` / `useGlassRefraction` options win over the automatic
  ones, the watcher never stops a manual lens, and after the manual cleanup the automatic lens takes
  over again. A release left over from an ended claim is a no-op.
- **Lens slots go to surfaces that can show one.** Hidden (`display: none`), zero-area and
  far-offscreen surfaces take none of the 8 slots, and are lensed once they show.
- **Options are `style={liquidStyle(options)}`**: synchronous custom properties, so the server
  markup and the first client paint are already right, nothing changes at hydration, and no option
  can go stale after it.
- The engine is split along its features: the crystal layer (`lens-crystal`, with `crystal-map`)
  and the dispersion passes (`lens-dispersion`) are lazy chunks fetched only for a surface that
  uses them. The specular and crystal map builders moved out of `displacement-map` into
  `specular-map` and `crystal-map` (same exports from `@jcsoftdev/ui/glass`). The specular layer
  and the motion stay in the engine chunk: every lensed surface uses both on its first frame.
- Topbar, Sidebar and CommandPalette accept `style` on their root.
- `check:size` measures the liquid tiers (Topbar alone, plus `liquidStyle`, plus `<LiquidGlass />`,
  plus the lazy engine, plus the crystal and dispersion chunks).

### Migration

From the 0.3.0 previews (`main` before this change):

- `material={{ type: "liquid", ...options }}` becomes
  `material="liquid" style={liquidStyle(options)}` (`"liquid-clear"` the same way). `material` only
  takes `"solid" | "glass" | "glass-clear" | "liquid" | "liquid-clear"`.
- `material={{ type: "liquid", preset: "thick", radius: 24 }}` becomes
  `material="liquid" style={liquidStyle(mergeLiquid(LIQUID_PRESET_THICK, { radius: 24 }))}`.
- The lens no longer turns on by itself: render `<LiquidGlass />` once (from
  `@jcsoftdev/ui/liquid`) in an app that wants it. Without it, liquid surfaces keep the CSS look.
- `useGlassLens(ref?)` is removed. Drop the ref: with `<LiquidGlass />` mounted, any element with
  the `liquid` or `liquid-clear` class (or a glass surface under `data-glass="liquid"`) is lensed.
  `applyGlassRefraction()` and `useGlassRefraction()` remain for manual control.
- `materialStyle()`, `withMaterialStyle()`, `MaterialName`, `LiquidMaterial` and
  `liquidOptionsOf()` are removed. `@jcsoftdev/ui/utils` exports `Material` (now a string union)
  and `materialClass()` only.
- Import `LiquidGlass` and `startLiquidGlass` from `@jcsoftdev/ui/liquid`; the options, presets
  and `liquidStyle` are exported from both `@jcsoftdev/ui/liquid` and `@jcsoftdev/ui/glass`.
- The automatic lens reads the pointer mode (`interactive`) only from the surface itself, on every
  surface (before, only the overlays did).
- A surface that leaves the page releases its lens when the DOM mutation is observed (a microtask later), not synchronously.

From 0.2.x: nothing changes unless you adopt Liquid Glass.

### Security

- **RichTextEditor sanitizer: `javascript:` href bypass via Unicode whitespace.** The URL check ignored only ASCII and a few invisible characters, while the emitted `href` was `decodeEntities(href).trim()`, and `trim()` also strips U+00A0, U+1680, U+2000-200A, U+202F, U+205F and U+3000. A link such as `<a href="&nbsp;javascript:alert(1)">` passed the check and was emitted as `href="javascript:alert(1)"` (stored XSS for apps that render sanitized HTML as markup); the output was not idempotent. The href is now normalized once, that exact string is validated (all whitespace and format characters ignored, then a protocol allowlist through `new URL`), and the same string is emitted. Anyone using `sanitizeHtml` or `isSafeUrl` should upgrade; stored content is re-sanitized on the next pass.
- **Markdown parser (low): bounded nesting and link scan.** Blockquote and list nesting is capped at 32 levels (deeper levels render as literal text), which removes a stack overflow on `>` x 20000 and a multi-second parse on deeply nested lists, and the link-target scan is bounded so `[](` repeated thousands of times is no longer quadratic.

### App-level building blocks

- **Tone palettes.** `tonePalettes` in a token file (optional) emits `--tone-<name>`, `--tone-<name>-soft` and `--tone-<name>-ink` for light and dark, plus `--color-tone-*` in `theme.css`. Names are kebab-case; `fill` and `soft` are required, `ink` falls back to `fill`. `buildTheme`, `buildTokensCss`, `buildThemeCss` and `ui-theme build` all honour it; files without the section build byte-identically.
- **Open `tone`.** `Chip`, `StatusDot`, `Kpi` and `Avatar` accept any tone name besides the built-in ones (`ChipTone`, `StatusDotTone`, `KpiTone`, `AvatarTone` are the built-in union plus `string & {}`; `ChipBuiltinTone` and friends keep the closed unions). Unknown names resolve through `--tone-<name>` variables set inline, so no class needs generating.
- **Kpi**: `tone`, `dot`, `icon`, `trend`. **KpiGroup**: `layout="auto-fit"` with `minItemWidth` (default 150) for separate cards in as many columns as fit.
- **Avatar**: `tone`, and `status` + `statusLabel` for a small status dot at the bottom-right.
- **EmptyState / ErrorState**: `variant="outlined"` (dashed border / danger border).
- **PageHeader**: `compact` (centred, tighter, body-size lede) and `breadcrumbs` (trail on its own row above the title).
- **Topbar**: `onSearch`, `searchLabel`, `searchPlaceholder`, `breadcrumbs` and `breadcrumbsLabel` are optional; missing parts render nothing (and Cmd/Ctrl+K is only bound with `onSearch`).
- **CardHeader**: `icon`, `title` and `action` slots; children still render as before.
- **Segmented**: `options` (`{ value, label, disabled? }[]`), `block` (full width, control-height items) and `allowDeselect` (default `false`: the pressed item stays selected; `true` lets a second press clear it).
- **Button**: while `loading` without a `loadingLabel`, the children stay and the UI string `loading` is announced.
- **CopyField**: label, monospace read-only value and a copy button with a 1.5 s copied state and a live region; strings `copy` and `copied` join the UI strings (`en`, `es`).
- **Layout**: `Page`, `Stack` and `Grid` (`@jcsoftdev/ui/containers/page`, `/stack`, `/grid`). `Page` is the `page` container, so `Cols` and `SettingsLayout` inside it react to the page width. `Grid` is intrinsic by default (`minColumnWidth`) or fixed with `columns`; `Stack` takes `direction`, `gap` and `align`.
- **Forms**: `Form`, `FormError` (`role="alert"`) and `FormStatus` (`role="status"`) in `@jcsoftdev/ui/forms/form`; the two messages render nothing for `null`, `undefined` or an empty `message`.
- **`Breadcrumbs`** (`@jcsoftdev/ui/navigation/breadcrumbs`): a named `nav` with an ordered list, `aria-current="page"` on the last item and a `renderLink` hook. 
- **`LiveStatusBar`** (`@jcsoftdev/ui/states/live-status-bar`): `live`, `reconnecting` and `offline` states as a polite `role="status"` with a dot and localized text.
- **`BottomNav`** (`@jcsoftdev/ui/shell/bottom-nav`): phone navigation bar for `Sidebar` items; the items past the fifth slot go behind a "More" button that opens a drawer. It hides itself once the `AppShell` is 900 px wide.
- New localized strings: `breadcrumbs`, `live`, `reconnecting`, `offline`, `more`.

### Chart gaps

- **Cartesian charts** (`BarChart`, `AreaChart`, `LineChart`, `ComboChart`): `tooltipRows({ index, category, rows })` returns `{ title?, rows?, footer? }` to replace parts of the tooltip (the default is unchanged when absent; the hidden data table is untouched); `categoryTickEvery` (a step or `(index, label) => boolean`) overrides the automatic thinning of the category labels; `markers` also takes an array of indices of `categories` to dot only those points.
- **`ValueAxisOptions.min` / `max`** accept a function of the data bound, e.g. `max: (dataMax) => Math.ceil(dataMax / 400) * 400`. `resolveAxisBound` and `AxisBound` are exported from `core/types`; the horizontal bar, lollipop, dumbbell, range area and waterfall axes honour it too.
- **`HeatmapChart`**: `cellDetail(row, column, value)` returns extra `TooltipRow`s under the cell value; `ChartTooltip` gained a `footer` slot.
- **`DonutChart`**: `sliceLabels` (`true`, `"percent"` or `"value"`) draws the share or the formatted value inside the ring and skips slices too small to hold it; it combines with `outsideLabels`.

### Behavior change

- **`Segmented` keeps the selected item selected.** Pressing the selected `SegmentedItem` again used to clear the selection (value `""`); a single-select group now stays on it. `Segmented` takes `allowDeselect` (default `false`) to keep the old behavior.

### Fixes

- **PolarAreaChart hover no longer flickers.** The hovered sector steps out by 6px and was also the pointer target, so a still pointer near its inner edge fell outside the moved sector: hover, tooltip and dimming toggled about 25 times a second. Pointer events now go to invisible sectors at rest, with no gap between neighbours and covering the stepped-out area, as in DonutChart since 0.2.1. The tooltip stays inside the chart vertically too.
- **DonutChart, PieChart and PolarAreaChart keep a tapped slice.** On touch and pen, lifting the finger fires `pointerleave`, which dropped the slice right after the tap: tooltip, centre value and dimming flashed for a frame and vanished. A tap now pins the slice until the next tap on another slice or outside the chart; the mouse still drops the hover when it leaves. `useIndexNavigation` returns `pointerLeave` for this.
- **Chart tooltips stop swapping sides under the pointer.** On pointer-following tooltips (Sankey, Chord, Treemap, Icicle, Sunburst, Radar, horizontal Bar and Funnel, Scatter, ...) a 1-2px move across 60% of the width swapped the card from one side of the pointer to the other, and the 100ms transform transition animated the swap across the cursor. The side now has a dead zone (right of the pointer until 65% of the width, left of it until 55%, or until the card would overflow) and a swap jumps instead of sliding.
- **Waffle, Parliament and Pictogram keep the category over the gaps between its units** instead of hiding the tooltip until the pointer reaches the next unit; Treemap and Icicle snap to the nearest cell across the 1-6px gutters, and Sankey, Chord, RadialBar and every `useIndexNavigation` chart wait 60ms before clearing, so crossing a gutter goes from one mark to the next without an empty frame.
- **Charts react to taps on touch screens.** `ChartFrame` now owns touch selection for every chart: a tap pins the mark's (or category's) details, tapping it again, tapping outside or pressing Escape unpins, tapping another mark moves the pin, and a swipe or scroll (more than 10px) never selects. Lifting a finger no longer counts as leaving, and a tap snaps to the nearest mark within 44px. Cartesian charts (Bar, Line, Area, Combo, ChartGrid) pin the tapped category instead of ignoring the tap and picking the first one on focus; focusing a chart by pointer no longer selects the first item (only the keyboard does).
- **Chart details dock on phones.** `ChartTooltip` gets `dock="auto" | "always" | "never"` (default `auto`). `auto` docks the details in a full-width panel under the plot, in normal flow, based on the device: a coarse primary pointer or a viewport 480px wide or less. A narrow card on a desktop with a mouse keeps the floating card and reserves nothing. The panel reserves a fixed 160px (it scrolls past that) through CSS, so the reservation also holds on the server render and only exists while docking applies; its rows are at least 44px tall. A separate polite live region announces the pinned or keyboard-selected category, debounced and never for mouse hover. `ChartFrame` takes `dock` too, and `BarChart`, `LineChart`, `AreaChart`, `ComboChart` and `ChartGrid` forward it. Charts with `tooltip={false}` reserve nothing.
- **`AppShell` no longer re-renders the page during hydration.** Its context value changed in the first layout effect after hydration, which made Next.js client-render still-dehydrated Suspense boundaries (a hidden `div#S:0` stayed in the page). The value is now a store that never changes identity and reads `false` on the server and on the first client render; only `useAppShell` consumers update, once the width is measured.
- **`OfflineBanner` takes an `action`** (for example a retry button) after the queue counter.
- **`Checkbox` takes a `label`**: it renders a `<label>` bound to the box, so it names the checkbox and a click on it toggles. New `wrapper` and `label` parts.
- **Checkbox looks like a checkbox.** The box is square (`rounded-xs`, the 4px small-radius token, 3px in the compact theme) instead of a circle, and the checked and indeterminate fill is the accent (as in Switch and the selected RadioGroup row) instead of the success green. Round plus green read as a radio button in multi-select lists. Sizes, 44px touch hit area, focus ring, disabled state and the `box`/`indicator`/`icon` parts are unchanged; The indeterminate state draws a dash instead of a check mark, and a disabled checkbox is dimmed (`opacity-50`, `cursor-not-allowed`) like the other form controls. RadioGroup stays round.

### Theme builder

- **`@jcsoftdev/ui/theme-builder` stays available.** The subpath published in 0.2.2 (`buildTheme`, `buildTokensCss`, `buildThemeCss`, `buildFontsCss`, `buildThemeKt`; `buildTheme(tokens, { kotlin: false })`) is re-exported from `@jcsoftdev/ui-tokens` and shipped inside this package, so 0.2.2 consumers upgrade unchanged and nothing extra is installed.

### Crystal lens

- **`profile: "crystal"`** and the `crystal` preset (`data-glass="liquid-crystal"`): a thick, fully clear convex lens that minifies the backdrop, bends it hard towards the rim, splits colour at the edge and has no frost, veil or tint. `refraction` accepts 0 to 2 for it (defaults and the other profiles are unchanged; above 1 they behave as 1). The minifying map cannot fold; the filter runs on a layer that extends past the surface and is clipped to it. No contrast guarantee.

### Configurable Liquid Glass and liquid motion

- **`LiquidGlassOptions`**: `style={liquidStyle(options)}` on any liquid surface. Options: `refraction`,
  `bevelWidth`, `profile` (`"full"`, `"dome"`, `"rim"`), `dispersion`, `frost`, `saturation`,
  `brightness`, `tint`, `rim`, `specular`, `fresnel`, `grain`, `radius`, `opacity`, `shadow`,
  `interactive`, `motion`. Each maps to a `--liquid-*` custom property that the CSS and the lens
  read, so a scope or the theme can set them and a change applies live. Exported from
  `@jcsoftdev/ui/liquid` with `LIQUID_DEFAULTS`, `LIQUID_PRESETS`, `liquidStyle` and `liquidVars`.
- **`data-glass` presets**: `liquid-clear`, `liquid-regular` and `liquid-thick` (in `base.css`).
  The global switch is now `[data-glass^="liquid"]`.
- **Optics**: the `dome` profile (round contours), a size-scaled outer shadow, fresnel glow, film
  grain, and a specular glint that follows `specular.angle`. Defaults are unchanged.
- **Motion**: an in-house spring and one rAF loop: the lens materialises by spring, a press deepens
  it, swells the surface and lights a touch glow that follows the pointer (the rim light turns
  towards it), and `interactive: "drag"` pulls the surface through a rubber band with a velocity
  squash (mismatched X/Y springs) and a jelly settle. Off under `prefers-reduced-motion` and with
  `motion: false`.
- New tokens: `liquid-rim-lit`, `liquid-rim-back`, `liquid-rim-ring`, `liquid-shadow-ink`,
  `liquid-shadow-alpha`, `liquid-shadow-drop`, `liquid-shadow-blur`, `liquid-shadow-contact` (the
  engine's size-scaled shadow now follows the theme in light and dark). The liquid utilities compose their backdrop filter from the blur and
  saturate tokens and the per-surface options; overriding `--liquid-regular-filter` alone no longer
  changes anything.
- A lower `opacity`, a `tint` or `grain` void the contrast guarantee of the defaults.
- Fix: a removed element released its lens only after the rebuild throttle; it is now immediate.
- Motion hardening: the motion is written to `translate`/`scale` composed with the author's own
  (an author `transform` is untouched; inline values are restored at rest, nothing is pinned); a
  drag ignores presses on buttons, links and fields inside the surface, captures the pointer only
  after 6 px, and swallows just its own gesture's click (within ~350 ms); no style reads per frame
  and no config refresh from the motion's own writes; `--liquid-motion` and `--liquid-interactive`
  are live; a moved surface follows its new ancestors.

### Liquid variant of the glass (lensing)

Frosted glass is unchanged; Apple-style Liquid Glass is a second look next to it.

- **`liquid` and `liquid-clear` utilities and `material="liquid" | "liquid-clear"`**: thin blur, higher
  saturation, specular rim (lit top-left edge and a fainter opposite one), inner highlight, edge
  glow and lower inner shadow for thickness, press flex on interactive surfaces (brightens and
  scales; no transition under reduced motion; `backdrop-filter` is never animated). `glass` and
  `glass-clear` render exactly as in 0.2 (a golden test pins their CSS).
- **Global switch**: `data-glass="liquid"` on `<html>` or any scope makes `glass`, `glass-clear` and
  the glass-preset chrome surfaces render liquid. Content (`surface-card`) stays solid.
- **Lens for liquid surfaces in Chromium** once `<LiquidGlass />` is mounted (see above). The displacement map is rasterised from a
  rounded-rect signed distance field with a Snell's-law squircle profile, DPR aware; chromatic
  dispersion on surfaces up to 100,000 px squared; the blur and legibility veil move into the
  filter so the rim stays sharp while the middle stays frosted. Budgets: 8 lenses, 640,000 px
  squared, rebuilds throttled, one coalesced pass per frame. Opt out with `data-glass-lens="off"`
  (element or ancestor) or `--glass-lens: 0`. Other engines get the base liquid look.
- **Closer to Apple** (liquid only): refraction only across a bevel as wide as the corner radius
  (centre shows the backdrop undisplaced), strength equal to the bevel width, blur 4px / 1.5px,
  saturation 1.5, thinner veil (regular .6 light / .54 dark, clear .47 / .38) with a text halo
  (`--liquid-halo`), a directional specular layer in the filter (glint tinted by the backdrop,
  dark contour, faint inner shadow, second `feImage`), dispersion 0.05, a materialise ramp and a
  press lift on the refraction, and a `--liquid-shadow` token. Liquid contrast floors are now
  documented per variant (regular 4.5 / 3.5, clear 4.5 / 2).
- **Full-surface lens** (liquid): the lens now bends the whole surface (smooth dome, strongest at the
  rim, 24 px cap) instead of a bevel only; `coverage: "rim"` / `--glass-lens-coverage: rim` keeps the
  old extent. The serrated edge of the first lenses was a fold-over of the displacement (offset
  falling faster than 1 px per px); both profiles are now fold-free, with a regression test. The
  veil moved fully into the filter and is adaptive (only where the backdrop is close to the ink), the
  tint is dropped while the lens is on, blur is 2 px / 0.6 px, the rim glint is brighter and wider,
  and dispersion is off by default (`--glass-lens-dispersion` or the option turns it on).
- The full-surface lens is a crease-free superellipse dome (pull along the gradient of `r = (|u|^3 + |v|^3)^(1/3)`), not a per-axis or edge-distance field, so it no longer reads as a four-faced diamond; tests check direction continuity across the diagonals and a positive 2D Jacobian.
- **Fixes**: `Card` stays a server component; the lens follows class, `data-glass`, opt-out and
  preference changes at runtime; area and dispersion budgets are enforced on every resize;
  surfaces waiting for one of the 8 slots get one when it frees. New `check:rsc` script.
- `@jcsoftdev/ui/glass`: new `computeDisplacementField`, `lensProfile`;
  `createDisplacementMap` now returns a PNG data URI (browser only); `applyGlassRefraction` gains
  `dispersion`, `veil` and `auto`, and moves the blur into the filter. The default `scale` is 20.
- New shared tokens `--liquid-*` (blur, saturate, filters, tints, dim, rim, depth). 
- Material components and the `cn` merge group accept the new values. Card and ActionBar type
  their `ref` prop (it reaches the root).

### Liquid Glass

Apple-style glass for the control and navigation layer, with content kept solid.

- **Glass material tokens in every preset**: `--glass-regular-*` and `--glass-clear-*` (`tint`,
  `blur`, `saturate`, `filter`, `border`, `edge`, `shadow`, `dim`, `fallback`) plus
  `--glass-sheen`, `--glass-noise` (off) and `--glass-nested-tint`. The `glass` preset now tunes
  them. `Theme.kt` exports `UiGlass` / `GlassMaterial`.
- **`glass` and `glass-clear` utilities** with an opaque base and the blur behind
  `@supports (backdrop-filter)`; `prefers-reduced-transparency`, `prefers-contrast: more` and
  `forced-colors` fall back to a solid fill with a border. Glass nested in glass drops its blur.
  Specular edge highlight and sheen are built in. Both variants carry a legibility veil (stronger
  for clear) so `text-ink` and `text-ink-2` keep 4.5:1 over white, black, split and striped
  backdrops in both themes; `text-ink-3` and tinted text are not covered.
- **`material` prop** (`"solid" | "glass" | "glass-clear"`) on Card, Dialog, Drawer, Popover,
  DropdownMenu, ContextMenu, HoverCard, CommandPalette, ActionBar, Topbar and Sidebar; every other
  surface opts in with `glass`, `glass-clear` or `surface-solid` in `className`. The `cn` merge
  treats the surface utilities as one group (the last one wins).
- **New `surface-nav`, `surface-side` and `surface-solid` utilities**; Topbar and Sidebar are glass
  in the `glass` preset and unchanged elsewhere.
- **Opt-in refraction** in the new `@jcsoftdev/ui/glass` entry: `useGlassRefraction`,
  `applyGlassRefraction`, `supportsBackdropRefraction`, `createDisplacementMap`. Chromium only,
  never on by default, skipped under reduced transparency, more contrast, forced colors and reduced
  motion. No dependencies.
- New [Liquid Glass guide](https://ui.jcsoftdev.com/docs/glass), stories and real-browser tests
  (`pnpm test:glass`) including measured text contrast over a worst-case backdrop.

### Platform

- **Tokens live in `@jcsoftdev/ui-tokens`.** `@jcsoftdev/ui` still ships the same `styles/*`,
  `tokens/*` and `ui-theme` bin; they are synced from ui-tokens at build time.
- **The `ui-theme` bin is now a single bundled file** (it inlines the theme engine from ui-tokens);
  invoke it exactly as before. It is no longer a thin script next to `scripts/build-theme.mjs`.
- **`ui-theme build` also writes `tailwind.css`** next to `tokens.css`, `theme.css` and `fonts.css`.
- **`ui-theme generate`** derives a WCAG AA color set from `--brand` (and optional `--accent`,
  `--neutral`, `--danger`) and writes `tokens.json` plus the CSS outputs; a bad hex prints a clean
  error and exits 1. The same engine is available as `createTheme`, `toCss` and `applyTheme` in
  `@jcsoftdev/ui-tokens`.

### Fixes

- **`ui-theme build --no-kotlin` no longer builds Kotlin.** It used to generate `Theme.kt` and discard it, so `var(...)` and `oklch(...)` colors still threw "Unsupported color for Kotlin". Without the flag, the error now names the token and suggests `--no-kotlin`. The builders in `@jcsoftdev/ui-tokens/build` take `kotlin: false` and have typed `buildTokensCss`, `buildThemeCss`, `buildFontsCss` and `buildThemeKt`.
- **DonutChart / PieChart no longer flicker on hover.** The hovered slice steps out by `explode`
  and was also the pointer target, so a still pointer near its edge ended up outside the moved
  slice, the hover dropped, the slice slid back under the pointer and the loop repeated (tooltip,
  dimming and centre total blinking). Pointer events now go to fixed, invisible hit arcs that leave
  no gap between slices and also cover the stepped-out ring.
- `ChartTooltip` takes an optional `containerHeight` and keeps the card inside it vertically
  (DonutChart passes it), so a slice near the top no longer pushes the card past the chart edge.

### Migration notes

- **Cards no longer blur.** `surface-card` is now an opaque fill with no `backdrop-filter`, in every
  preset. In the `glass` preset cards (`surface-card`, `surface-control`) are opaque instead of
  translucent. To get the old look on one card use `material="glass"` (or `className="glass"`).
- `--surface-alpha` is now `1` in every preset and is only kept as an alias. `--surface-blur` and
  `--surface-filter` still exist; in the `glass` preset they equal `--glass-regular-blur` and
  `--glass-regular-filter`, and `--surface-overlay` equals `--glass-regular-tint`.
- Translucent `bg-surface-overlay` without a blur was replaced by the `surface-overlay` utility in
  the map controls, attachment preview, emoji picker, source card and conversation button.
- `cn("surface-card", "surface-overlay")` now returns `surface-overlay`.
- A menu or popover portaled out of a glass dialog is not a DOM descendant, so it is not detected as
  nested glass; pass `material="solid"` if you want it opaque.
- Non-glass presets are unchanged: overlays, the top bar and the sidebar keep their 0.2.0 fills in
  every media mode (new `--surface-overlay-fallback`, `--surface-nav-fallback` and
  `--surface-side-fallback` default to the surface's own token). In the `glass` preset, browsers
  without `backdrop-filter` and users with reduced transparency or more contrast now get an opaque
  overlay instead of a translucent one, plus a ring (more contrast) or outline (forced colors).
- In the `glass` preset `--shadow-card` changed (an inset highlight plus a large drop shadow became
  a 1px ring plus a softer drop), and the overlay fill went from 82% `--float` to the regular
  glass tint (72% white in light, 62% near-black in dark) plus the veil, which only the
  `surface-overlay` / `surface-nav` / `surface-side` utilities paint: a bare `bg-surface-overlay`
  is a translucent colour without blur or veil, use the utility.
- The unprefixed `glass` class can collide with an existing `.glass` in your CSS; see the guide.

## 0.2.0 (2026-10-11)

Zero runtime dependencies, a published headless layer, per-part customization and a configurable
class merge. This release has breaking changes, listed below.

### Highlights

- **Zero runtime dependencies.** `dependencies` is gone; only the `react` and `react-dom` 19 peers
  remain. Removed: `@radix-ui/react-*` (dialog, popover, dropdown-menu, tabs, toggle-group, switch,
  checkbox, radio-group, progress, avatar, slot), `cmdk`, `sonner`, `lucide-react`, `clsx` and
  `tailwind-merge`. The replacements are in-house and covered by keyboard, ARIA and browser tests.
  Attributions are in `THIRD_PARTY_NOTICES.md`.
- **New `@jcsoftdev/ui/primitives` entry** (ESM, typed): `DialogPrimitive`, `PopoverPrimitive`,
  `PopperPrimitive`, `MenuPrimitive`, `CommandPrimitive`, `Portal`, `usePresence`,
  `useFocusScope`, `useDismissableLayer`, `useLayer`, `LAYER_BRANCH_ATTRIBUTE`,
  `computePlacement` (with geometry types) and `commandScore` / `CommandFilter`. Internals are not
  importable. Single-primitive imports tree-shake.
- **`classNames` per part** on about 100 styled components (typed `ClassNames<Part>` and exported
  `XxxPart` types). Merge order is kit, then `classNames.root`, then `className`.
- **`createCn` / `extendCn`**: a per-instance class merge configured with your own text, spacing,
  radius and shadow tokens, plus custom class groups and conflicts. The default `cn` is unchanged.
  The kit's own tokens are derived from `styles/theme.css` at build time.
- **Exported variant maps**: `buttonClasses`, `buttonVariantClasses`, `buttonSizeClasses`,
  `chipToneClasses`, `eventToneClasses`, `dayChipToneClasses`.
- **Font-size tokens**: `type.sizeScale` in the tokens file generates `--text-fs-95` to
  `--text-fs-440`; components use `text-fs-*` instead of `text-[Npx]`.
- **`ink-3` darkened** in the light theme (`#666673`) to clear 4.5:1 contrast on `surface-2`. This
  is global: anything using the token gets darker text.
- **Icons** are an in-house set at `@jcsoftdev/ui/icons`, one tree-shakeable component per icon
  (a single icon bundles in under 1 KB).
- **Toaster** is in-house with the same `toast`, `toast.success`, `toast.error`, `toast.dismiss`
  and action API.

### Breaking changes

Types and imports

- Radix prop types are no longer exported or leaked. `DropdownMenuContent` and `ContextMenuContent`
  types come from the in-house `MenuPrimitive`.
- `LucideIcon` is a deprecated alias of the new `IconComponent` type. Import icons from
  `@jcsoftdev/ui/icons` (the icon set is vendored; `lucide-react` is no longer installed for you).
- `ToasterProps` is owned by the package: `position`, `duration`, `visibleToasts`, `className`,
  `label`, plus `container` and `dir`. Other `sonner` props are gone, and there are no `info` or
  `warning` toast tones.

CSS variables, selectors and attributes

- `--radix-popover-content-*` and `--radix-dropdown-menu-content-*` are now `--ui-popper-*`
  (`--ui-popper-available-width|height`, `--ui-popper-anchor-width|height`,
  `--ui-popper-transform-origin`).
- `[data-radix-popper-content-wrapper]` is now `[data-ui-popper-wrapper]`.
- `--cmdk-list-height` is now `--ui-command-list-height`; `[cmdk-*]` attributes are now
  `data-ui-command-*` (for example `[cmdk-group-heading]` is `[data-ui-command-group-heading]`).
- `data-disabled` on command items is present-only (it used to be `"true"` / `"false"`).
- Transform-origin semantics follow the in-house popper.

Props and behavior

- Removed from popper and popover content: `asChild`, `forceMount` on `Portal`,
  `updatePositionStrategy` and `onPlaced`. Menus no longer take `loop`: they always loop.
- `aria-controls` on popover and menu triggers is present only while the content is open.
- Menu `onSelect` receives a plain `Event`. Tab now closes a menu. ArrowUp on a closed menu
  trigger opens it on the last item (new).
- Command: `Separator` is `aria-hidden` (no `role="separator"`); `Loading` should be rendered
  beside `List`; `Command.Dialog` keeps `overlayClassName`, `contentClassName` and `container`, but
  Radix dialog props are not accepted.
- Nodes appended to `body` after a modal opens are not hidden from assistive technology, and live
  regions stay reachable under a modal. See the primitives guide.
- Part names: Dialog and Drawer `classNames.content` is `root`; Toaster `message` is `title`;
  StatusPill `led` is `dot`. `overlayClassName` / `closeClassName` on Dialog and Drawer content
  were never released and are not available; `Carousel.slideClassName` remains.
- Merge order for `className` against `classNames.root` is now `className` last.

### Migration from 0.1.x

1. Upgrade to `@jcsoftdev/ui@0.2.0`. Your own dependencies on `lucide-react`, `clsx`,
   `tailwind-merge`, `sonner` or `@radix-ui/*` are no longer pulled in by the kit; keep them only if
   your app imports them directly.
2. Replace `import { X } from "lucide-react"` with `import { X } from "@jcsoftdev/ui/icons"` where
   you pass icons to kit components (the `LucideIcon` type still works as an alias of
   `IconComponent`).
3. Search your CSS for `--radix-popover-content-*`, `--radix-dropdown-menu-content-*`,
   `[data-radix-popper-content-wrapper]`, `--cmdk-list-height` and `[cmdk-*]`, and rename them as
   listed under "Breaking changes".
4. If you passed Radix or `sonner` props through `Popover`, menus, `Command.Dialog` or `Toaster`,
   drop the ones listed as removed; `className` now wins over `classNames.root`.
5. Check light-theme text that uses `ink-3`: it is darker now (`#666673`).
6. Optional: use `classNames` per part, `createCn` / `extendCn` for your own tokens, and
   `@jcsoftdev/ui/primitives` for headless building blocks.

### Other changes

- `Dialog`, `Drawer`, `Popover`, `HoverCard`, `DropdownMenu`, `ContextMenu` and `CommandPalette`
  keep their public API; `DropdownMenu` gains `CheckboxItem`, `Group`, `Sub`, `SubTrigger`,
  `SubContent`, `Arrow` and `container`; `Popover` gains `PopoverArrow` and `container`.
- `RadioOption.disabled` is supported.
- The Toaster section carries the layer-branch attribute, so toast clicks never dismiss a dialog.
- Package `files` now include `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md`.
- New checks in CI: `check:dist-imports` (the unbundled dist loads under plain Node) and
  `check:docs-examples` (the primitives guide compiles).
