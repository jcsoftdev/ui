# Changelog

## Unreleased

### Page structure (G1, G4, G9, G10)

Additive; every new prop defaults to the previous behavior unless noted.

- **`ListDetail` (G1).** New `listWidth` (fixed list rail, number = px or any CSS length), `ratio`
  (`1:1` default, `1:2`, `1:3`), `surface` (`flat` default, `card`), `stickyList` and `stickyOffset`
  (the list column stays in view and scrolls on its own from 641px of the component's width). New
  parts `ListDetailHeader` (`count`; search, filter chips and a result count above the list, passed as
  `ListDetailList` `header`) and `ListDetailEmpty` (detail placeholder while nothing is selected).
  Default look is unchanged. Markup change to check: `ListDetailList` now renders a column wrapper
  (`data-list-detail-pane="list"`, carrying the divider and the hide-when-detail classes) around the
  `ul`; the `ul` keeps its `aria-label`, `className` and props, but `list.parentElement` is no longer
  the grid.

## 0.5.0 (2026-10-23)

### Busy buttons keep focus (behavior to check when upgrading)

- **`Button` and `IconButton` `loading`** no longer set the native `disabled` attribute. A busy
  button stays focusable, so pressing it from the keyboard leaves focus on it instead of dropping
  to `body`. It is exposed as `aria-disabled="true"` plus `aria-busy="true"` (the status region
  still announces the loading text), it ignores clicks, Enter and Space, and a `type="submit"`
  button does not submit its form, including the implicit submit from Enter in one of its fields.
  The dimmed `disabled` look no longer applies while loading; the spinner or loading label stays
  and the cursor turns to `progress` (a button with neither a `loadingLabel` nor a spinner child
  shows no other visible change, so give it one). Passing `disabled` keeps the native attribute and the dimmed
  look as before, also while loading. Check code that read `button.disabled` or tests that expect
  `toBeDisabled()` on a loading button: they now see `aria-disabled` instead.

### Sign-in screen

New `@jcsoftdev/ui/auth` entry, additive and source compatible. Colors come only from the theme
tokens, so dark mode and every `data-accent` apply without extra code. Guide: `/docs/auth/`.

#### Added

- **Auth.** `AuthLayout` (`layout` `split`, `split-reverse`, `centered`, driven by its own container
  width; parts `.Brand`, `.Art`, `.Panel`, `.Footer`; controlled or uncontrolled `state`,
  `progress` and `activeIndex`; `useAuthLayout`), `AuthIllustration` (isometric portal slabs that
  react to `state`, `progress` and `activeIndex` with CSS only; under reduced motion each state
  keeps its pose without moving) and `LoginForm` (parts `.Header`, `.Portals`, `.Identifier`, `.Password`, `.Error`,
  `.Submit`, `.Footer`; async `onSubmit`, `loading`, `error`, `success`; drives the surrounding
  layout and works standalone). A field left empty is reported under that field; a failed sign-in
  shows as a callout from `.Error`, placed above the fields in the default composition.
- **Auth compositions.** `AuthLayout` `panel` (`paper`, `solid`: a solid themed side panel with an
  open form on the other side), `LoginForm` `appearance` (`card`, `open`), `LoginForm.Options`
  (remember me, reported as `remember`, plus a help slot) and `LoginForm.Providers` (a labelled slot,
  no providers included), and `AuthIllustration` `look` as the plug-in point for further looks.
- **Illustration motion.** Pointer parallax (fine pointers only, one CSS variable write per
  frame), a hop per keystroke, an overshooting entrance, a cheer and burst on success, and an
  error that settles back to the password state after `ERROR_HOLD_MS` (1.1s). Only `transform`
  and `opacity` animate; reduced motion jumps straight to each state's pose (spread at rest, flung
  apart on an error, assembled with a still burst on success) and turns the parallax off, also when
  the setting changes while the page is open.
- **`Stack` look (`@jcsoftdev/ui/auth/stack`).** A tower of books that gains a book as the form fills,
  wobbles on an error and plants a flag with the active portal's glyph on success; 4, 5 or 6
  books by the width of its container.
- **`Mosaic` look (`@jcsoftdev/ui/auth/mosaic`).** A floor of isometric tiles that lights diagonally with
  progress, glints per keystroke, glows under the pointer, flashes red on an error and ripples on
  success; three tiles carry the portal glyphs and the active one stands raised.
- **`Character` look (`@jcsoftdev/ui/auth/character`).** A student on a hover board that follows the
  pointer, looks toward the form while it is typed into, covers their eyes for the password,
  shakes their head on an error and hops with a boost on success.
- **`Statement` look (`@jcsoftdev/ui/auth/statement`).** Kinetic type: `headline` rises word by word, an
  optional `caption` and `action`, and a pill that fills toward its arrow as a progress meter;
  on success the headline gives way to the new UI string `signedIn` (default headline
  `welcomeBack`). Not hidden from assistive technology. `AuthLayout.Art` forwards `headline`,
  `caption` and `action`.
- **One entry per look.** `AuthIllustration` takes the look as a component (`look`, default `Slabs`),
  and each look is its own subpath (`@jcsoftdev/ui/auth/slabs`, `stack`, `mosaic`, `character`,
  `statement`), so an app bundles only the looks it renders; each look carries only its own CSS. A look
  is any component typed `AuthLook`, with optional static `variant` (the `data-variant` value) and
  `text` (not hidden from assistive technology). `AuthLayout.Art` takes `look` too.
  `AuthIllustrationAny` (`@jcsoftdev/ui/auth/looks`) keeps the string `variant` and imports all five
  looks on purpose. The `ui/auth` size budget drops back from 32300 to its default-entry weight.
- **`PasswordInput`** (reveal toggle with `aria-pressed`) and **`Divider`** (optional label).
- **Icons.** `Eye`, `Mail`, `House` and `GraduationCap`.
- **UI strings** (en/es) for the sign-in screen and `showPassword`.

#### Fixed

- **Portal tiles.** A `LoginForm.Portals` tile lifts on keyboard focus as it does on hover, and the
  selected tile shows a check badge besides its colour change, so the choice does not rest on
  colour alone. The badge is decorative; the radio's `aria-checked` still carries the state.
- **Primary button hover contrast.** On hover the primary `Button` and `IconButton` (and so
  `LoginForm.Submit`) turn their text to `--surface` on the darker `--accent-ink` fill. The text
  kept `--on-accent`, made for the pale `--accent`, and fell to 2.4:1 in light themes for six of the
  seven accents; it is now 5.7:1 or more in every accent, light and dark.
- **Portal tile edge.** An unselected portal tile draws its border in `--ink-3` instead of
  `--line-strong`, which was 1.5:1 against the card; it is now 5.2:1 or more in light and dark.
- **Sign in shows it is busy.** `LoginForm.Submit` draws a spinner next to its label while the
  request runs, since a loading button is no longer dimmed.
- **`Input`** with `start` or `end` draws one focus ring (the wrapper's) instead of a second square
  ring on the inner input.
- **`LoginForm` posts by default.** The form carries `method="post"`, so a submit before hydration
  can no longer put the identifier and the password in the URL (history, logs, Referer). Pass
  `method` to override it.
- **Looks are client modules.** Each look and `AuthIllustrationAny` start with `"use client"`, so a
  Server Component can pass `look={Stack}` to `AuthLayout.Art` or `AuthIllustration` without
  Next.js rejecting a function prop.
- **`LoginForm` state.** The same failed sign-in twice in a row replays the error (a new submit
  leaves the error state first). A controlled `success` or `error` returning to unset derives
  idle, typing or password from focus again. Without portals the form no longer overrides
  `AuthLayout` `defaultActiveIndex`.
- **`Statement` accessibility.** The visible line is the one assistive technology reads: "You're in."
  replaces the headline on success, and the caption is hidden with it.
- **Password length no longer reaches the DOM.** `progress` counts the identifier by length but the
  password only as filled or not (new pure `formProgress`), so styles and attributes do not mirror
  how long the password is. The slabs tighten once the password is filled instead of per character,
  and the keystroke hop no longer fires per password character.

## 0.4.0 (2026-10-21)

### Blocks for application screens

New components, all additive and source compatible, with no new runtime dependency. Defaults come
from `UiStringsProvider` (en/es), layout follows container queries, and hit areas follow
`data-density="touch"`. Guide with examples: `/docs/blocks/`.

#### Added

- **Atoms.** `Spinner` (`size`, `label`, decorative `label={false}`), `Kbd`, `IconButton`
  (required `label`, `variant`, `size`, `loading`, `asChild`, `iconButtonSizeClasses`), `DueChip`
  (`date`, `today`, `soonDays`, `done`, `locale`) and `Seal` (`title`, `icon`, `tone`, `label`).
- **Overlays.** `Tooltip` (`content`, `shortcut`, `side`, `align`, `openDelay`, `closeDelay`,
  controlled `open`) and `AlertDialog` (`role="alertdialog"`, `tone`, async `onConfirm` with a
  pending state and inline failure message, focus on Cancel).
- **Forms.** `SelectMenu` (custom listbox select over `options`), `Combobox` (filter, async
  `onSearchChange`, `loading`, `clearable`, `valueLabel`), `DatePicker` and `DateTimePicker` (ISO
  values, `min`, `max`, `isDateDisabled`, locale-derived format and week start, time-zone safe) and
  `ChipGroup` (multiple or single toggle chips with roving focus).
- **Calendar.** `DateCalendar`, the standalone keyboard date grid behind the pickers.
- **Navigation.** `Wizard` (`steps`, async `canAdvance`, `onBeforeNext`, `onComplete`) and
  `TabsNav` / `TabsNavLink` (link strip with `aria-current="page"`, `renderLink`, `asChild`).
- **Containers.** `Section`, `Note`, `Aside` / `AsideHeader`, `ListDetail` (with its parts and
  `useListDetail`), `Feed` / `FeedEvent` and `Shortcuts` / `ShortcutsItem`.
- **Banner `appearance="outline"`.** Page surface where only the border carries the tone (default
  `soft`).
- **`DescriptionList`** `layout` (`auto`, `inline`, `stacked`), `columns` (1 to 3), `valueAlign` and
  `DescriptionListItem` (dash placeholder for `null`, `undefined`, `false` and `""`).
- **`Chip` `size="sm"`** and `chipSizeClasses`; `ref` is a regular prop.
- **`Skeleton` variants** `list`, `kpis`, `key-value` and `bar`, with `count`.
- **`ErrorState` `actions`.**
- **Toast tones.** `toast.info`, `toast.warning`, `toast.danger` and `toastToneClasses`.
- **`resetToasts()`** in the new `@jcsoftdev/ui/overlays/testing` entry, for resetting the toast
  store between tests.
- **Form gaps found while migrating an app.** `Input` takes `start` / `end` adornments, a
  30px `size="xs"` and `variant="bare"`; `Dropzone` has `mode="field"` (a real labelled
  `<input type="file">` with `accept`, `multiple`, `onChange` and removable selections);
  `NumberStepper` has a string mode (`mode="string"`: empty state, caller-owned text, change event);
  `Field` accepts a node `label` and several children.
- **Table.** `flush` (`true`, `"start"`, `"end"`) drops the outer cell padding so the first and last
  column sit on the container edge; `stickyHeader`; `maxHeight` (the capped wrapper is focusable);
  row selection with `selectedKeys`, `defaultSelectedKeys`, `onSelectedKeysChange`, `rowKey` on
  `TableRow` / `TableLinkRow` (`aria-selected`), `TableSelectCell` and `TableSelectAllCell` (checked,
  mixed, unchecked); `TableActionsCell`, which wraps inline actions under a narrow table container
  (a named container query) or swaps them for an overflow `menu` you pass.
- **Section parts.** `Section.Header`, `.Title`, `.Count`, `.Description`, `.Actions` and `.Body`
  next to the props API; a part as a direct child switches to composed rendering.
- **Kpi parts and chrome.** `Kpi.Label`, `.Value` (`mono`, `suffix`, `trend`) and `.Description`;
  `card` (border and radius); `trailing` (content at the end of the label row that stays exposed to
  assistive tech, unlike the decorative `icon`).
- **Timeline** `status` per item (`done`, `current`, `error`, `pending`) with a glyph, a spoken state
  and `aria-current="step"`, and `Timeline.Item` children next to `items`.
- **Stepper** `status` per step (`done`, `current`, `error`, `pending`) with a check or cross and a
  spoken state; the default stays `current` for `currentStepId` and `pending` otherwise.
- **AlertDialog** `confirmDisabled` and `cancelDisabled`, and a compound API: `AlertDialog.Root`,
  `.Trigger`, `.Content`, `.Header`, `.Title`, `.Description`, `.Body`, `.Footer`, `.Cancel` and
  `.Action`. Cancel and Action close the dialog after their `onClick` unless it calls
  `preventDefault()`; use the props API for an async confirm with a pending state.
- **ListDetail** `onBack`.
- **DueChip** `state` forces `overdue`, `soon`, `ok` or `done` whatever the date says.
- **Seal** `tone="institutional"` (strong neutral, ink frame) and any tone declared in
  `tonePalettes`, by name, as `Kpi` does.
- **DropdownMenu** `bare` content (layering and size limits only, so a custom menu draws its own
  surface), `DropdownMenuAnchor`, and `dropdownMenuItemClasses` / `dropdownMenuSurfaceClasses`.
- **UI strings** (en/es) for the new components: `noResults`, `clear`, `selectPlaceholder`,
  `calendar`, `openCalendar`, `previousMonth`, `nextMonth`, `time`, `locale`, the day, month and
  year placeholders, `back`, `next`, `finish`, `stepOf`, `steps`, `aside`, `backToList`, `overdue`,
  `dueSoon`, `stepDone`, `stepError`, `selectRow`, `selectAll` and `rowActions`.

#### Changed (behavior to check when upgrading)

- **`ErrorState` markup.** The retry button now sits inside a wrapper `div` that also holds
  `actions`. Selectors or tests that expect the button as a direct child need updating.
- **Toast tint.** Success and error toasts are tinted with their tone (`*-soft` surface, tone
  border, status glyph) instead of the inverted neutral look. `default` is unchanged and roles are
  unchanged (only error is an alert).
- **`Checkbox` and `Switch` touch target.** The 44px target is an invisible `::after` of the control
  instead of a larger root, so under touch density the layout box is 40px (it was 44px) and the hit
  target can overlap a neighbour by 2px per side. Default density is unchanged.
- **`Section` `divider` is off by default.** A kit whose section header always drew a hairline
  needs `divider`.
- **`RadioGroup`** radios now carry `aria-labelledby` and `aria-describedby`, so they have
  accessible names without relying on `<label for>`.
- **`theme.css` no longer emits self-referencing variables.** Entries such as
  `--radius-input: var(--radius-input)` (radii, shadows, `--font-sans`) now sit in an
  `@theme reference inline` block, so the utilities resolve to the raw token and nothing is declared
  in Tailwind's theme layer. Consumers no longer need to reorder layers; verified on Tailwind 4.3.3.
- **Locale reaches the date pickers.** `UiStringsProvider` ignores `undefined` and empty entries
  instead of letting them overwrite the preset, so `strings={{ locale: undefined }}` no longer sends
  Intl to the system locale; its context is shared across duplicate module copies.
- **`Combobox` `required`** sets `aria-required` only and no longer blocks native submit before your
  own validation; `nativeRequired` opts back in.
- **`Section` and titleless wrappers.** A `Section` with no title no longer takes a heading level or
  tightens the spacing of what it wraps, so a titled section inside a wrapper keeps the level it
  would have had without it (it moves up one level compared with the earlier 0.3.0 previews).
- **`ListDetail` back action.** It calls `onBack` and never `onValueChange(null)`; `onValueChange`
  is typed `(value: string) => void`. Both only affect the earlier 0.3.0 previews, since `ListDetail`
  is new in 0.3.0.
- **`Table` selected rows.** A row with a `rowKey` in a table with selection props reports
  `aria-selected` and highlights; tables without selection props render as before.
- **Escape inside the library's own comboboxes.** The dismissable-layer primitive no longer treats
  the library's own open `role="combobox"` widgets as a foreign layer, so Escape closes them.

### Components for app shells

- **`Sidebar` rail.** `collapsed` turns the sidebar into an icons-only rail (labels as `title` tooltips and screen-reader text, badges as dots). It is ignored while the sidebar is a drawer, so the default behavior is unchanged.
- **`Chip` `onRemove`.** Appends a remove button named from the new `remove` UI string ("Remove" / "Quitar", or `removeLabel`), keyboard operable, with a 44px hit area under touch density.
- **`ResponsiveList` follows its own width.** It is a container (`@container/responsive-list`) and swaps cards for the table at 42rem of its own width instead of the viewport `md`, so it stays right in a narrow column or beside a sidebar.
- **`Input` `size="lg"`.** A thumb-friendly field at the height of the large `Button` (`h-control-lg`); `size` defaults to `md`. `size` is now the `md | lg` prop, no longer the native numeric attribute.
- **Key and Webhook icons.** `Key` and `Webhook` join the icon set (Lucide sources in `icons/svg`), with their lazy `<ui-icon>` glyphs.
### Liquid Glass on phones

- **Cheaper lens maps.** The displacement and specular maps are rasterised at no more than 1.5
  pixels per CSS pixel (they are smooth fields that `feImage` stretches), and a large surface drops
  toward one, so a 3x phone no longer builds a map 4x the size of the surface on the main thread.
  The specular map (contour and glint) keeps up to 1.5 even where the large-surface cap has taken
  the refraction map down to one. The crystal map, which mostly covers the margin its layer clips
  away, is lowered toward 48,000 pixels but never below half a pixel per CSS pixel (so a very
  large layer can still exceed that). `computeCrystalField` now accepts a `dpr` from 0.5. The
  whole-surface field computes its per-column terms once, with the same output. Sample positions use
  the effective ratio after rounding the map size, so a fractional size no longer drifts.
- **Lens work is spread over frames.** The per-frame pass that installs and resizes lenses stops
  after about 12 ms and leaves the rest for the next frame, so several lenses built at once no
  longer land in one task. A single lens build still runs whole (the budget is checked between
  tasks, not inside one), the leftover tasks run first in the next pass so one slow task cannot
  starve the others, and a lens that is undone drops its pending work.
- **A crystal lens no longer drops while an ancestor changes.** `<LiquidGlass />` read the crystal
  surface (whose backdrop filter moves to its own layer) as not painting one, so any class, style or
  `data-*` change above it, such as dragging, released and rebuilt the lens. The lens is kept only
  while the surface itself still resolves to a backdrop filter, so a crystal surface whose own
  liquid class stops applying (`data-[state=open]:liquid` closing) under a lensed ancestor releases.

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
