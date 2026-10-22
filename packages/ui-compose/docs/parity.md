# Web to Compose parity

Maps every family of the web kit (`packages/ui/src`, `@jcsoftdev/ui`) to the Compose kit (`packages/ui-compose`, package
`com.jcsoftdev.ui`). The Compose kit targets a phone: it ports the mobile subset and keeps names, props and the accessibility
contract aligned where a component exists on both sides.

Status values:

- **both**: present on both sides (the notes say where the shape differs).
- **web-only**: exists on the web, not in Compose (yet).
- **compose-only**: exists in Compose only.
- **n/a**: does not apply to the platform (no hover, no multi-pane shell, no DOM).

Compose names are in `com.jcsoftdev.ui.<package>`; each styled component has a matching `XDefaults` object and `@Immutable`
`XColors` class. Screenshots for the Compose side live in `kit/screenshots` (light, dark, 200% font).

## Foundations, tokens and i18n

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| Design tokens (`tokens/default.json`, CSS variables) | both | `theme.UiColors`, `UiShapes`, `UiSizes`, `UiTypography`, `UiPalettes` | Generated from the same `tokens.json` at build time (`generateUiTokens`). |
| Theme provider and accent palettes | both | `theme.UiTheme(dark, colors, accent, fontFamily, motion, shapes, sizes, typography, strings)` | Accent takes a palette id or `#rrggbb`. |
| `i18n` `UiStringsProvider` (`en`, `es`) | both | `theme.UiStrings` (`En`, `Es`), `LocalUiStrings` | Label parameters default to `UiTheme.strings.*`; explicit parameters win. |
| `utils/reduced-motion` | both | `foundation.Motion` | Reads the system animator scale; 0 turns transitions into jump cuts. |
| `atoms/pressable-feedback` | both | `foundation.pressScale` | `Modifier.Node`, not `composed`. |
| `utils/cn`, `class-merge`, `slot` | n/a | none | Tailwind class plumbing. |
| `utils/roving-focus` | both | `primitives.Roving`, `rememberRovingFocus`, `rovingItem` | Used by Segmented and Tabs. |
| `utils/use-controllable-state` | n/a | none | Compose state hoisting replaces it. |
| Android system back | compose-only | `foundation.BackDispatcher`, `BackHandler`, `BackPriority` | Web layers use Escape. |
| Fonts (Figtree) | both | `rememberFigtree` (internal, compose resources) | Injectable through `UiTheme(fontFamily)`. |

## Atoms

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Avatar` | both | `atoms.Avatar`, `AvatarSize` | Image slot drawn over initials. |
| `AvatarGroup` | web-only | none | |
| `BigDate` | web-only | none | |
| `Button` | both | `atoms.Button`, `ButtonVariant`, `ButtonSize` | Loading state, `block`, 48dp touch target. |
| (icon-only `Button`) | compose-only | `atoms.IconButton` | Description is required because it is icon-only. |
| (floating action button) | compose-only | `atoms.FloatingActionButton`, `ExtendedFloatingActionButton`, `FabColors`, `FabDefaults` | 56dp, button role, collapses to the icon; reduced motion is a jump cut. |
| `Checkbox` | both | `atoms.Checkbox` | Boolean and tri-state overloads. |
| `Chip` | both | `atoms.Chip`, `ChipTone` | `onRemove` and `removeLabel` append a remove button with a 48dp touch target. |
| `Icon` and the icon set | both | `icons.Icon`, `icons.Icons.*` | Same SVG source (`packages/ui/icons`), same names; generated at build time, one nullable-backed property each. |
| `Led`, `StatusDot` | web-only | none | The Compose LED is part of `StatusPill`. |
| `StatusPill` | both | `atoms.StatusPill`, `LedStatus` | |
| `NumberValue`, `TrendChip` | web-only | none | |
| `Progress` | both | `atoms.Progress` (determinate and indeterminate) | |
| `Meter` | web-only | none | |
| `RadioGroup` (`Root`, `Item`, `Indicator`) | both | `atoms.RadioGroup`, `RadioOption` | One composable instead of the compound parts. |
| `Switch` | both | `atoms.Switch` | |
| (typography) | compose-only | `atoms.Text`, `LocalContentColor` | The web uses plain elements and CSS. |
| (rule) | compose-only | `atoms.Divider`, `VerticalDivider` | |

## Forms

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Field`, `Label` | both | `forms.Field` | Label, description, error and required marker in one composable. |
| `Input`, `InputIcon` | both | `forms.Input` | `leading` and `trailing` slots replace `InputIcon`. `size = InputSize.Lg` matches the large button height. |
| (password input) | compose-only | `forms.PasswordInput` | The web uses `Input` with a password type. |
| (autofill content type) | compose-only | `forms.InputContentType`, `Input(contentType)`, `PasswordInput(contentType)` | Maps to Compose `contentType` semantics; the web uses the `autocomplete` attribute. |
| `TimeInput` | both | `forms.TimeInput` | Number keyboard; stores digits and emits `HH:mm` when valid. |
| (date input) | compose-only | `forms.DateInput` | Emits `dd/MM/yyyy` when valid. |
| `PinInput` | both | `forms.PinInput` | One hidden field, SMS autofill. |
| `NumberStepper` | both | `forms.NumberStepper` | |
| `Select` | both | `forms.Select`, `SelectOption` | The web opens a popover listbox; Compose opens a bottom `Sheet`. |
| `NativeSelect`, `InlineSelect` | n/a | none | |
| `Textarea` | web-only | none | |
| `Slider`, `Rating` | web-only | none | |
| `CheckboxButtonGroup`, `RadioButtonGroup` | web-only | none | |
| `Dropzone` | web-only | none | |
| `EmojiPicker`, `EmojiReactionButton` | web-only | none | |
| `AccentPicker`, `FormGrid` | web-only | none | |

## Containers

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Banner` | both | `containers.Banner`, `BannerTone` | Danger is an assertive live region. |
| `Card` (`Header`, `Body`, `Footer`) | both | `containers.Card` | Slots instead of sub-components; clickable variant. |
| `PageHeader` (`Eyebrow`, `Title`, `Lede`, `Actions`) | both | `containers.PageHeader` | Adds a back button. |
| `Cell`, `GenericRow` | both | `containers.ListRow` | Leading, title, subtitle, meta, trailing. |
| `ActionBar`, `Toolbar` | web-only | none | |
| `Carousel`, `Kanban`, `Scrolly`, `Resizable*`, `FileTree` | web-only | none | |
| `Table*`, `DataGrid`, `ResponsiveList` | web-only | none | Out of scope for the Compose kit; the web container-width switch has no counterpart. |
| `Kpi`, `KpiGroup`, `HBars`, `Facts`, `HighlightLine`, `DescriptionList` | web-only | none | |
| `Comment`, `Timeline`, `ItemCardGroup` | web-only | none | |
| `ConfirmAction` | web-only | none | Compose callers build it from `Dialog`. |
| `SettingsLayout`, `SettingsRow` | web-only | none | |
| `Cols` | n/a | none | CSS grid helper. |

## Liquid Glass

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `glass`, `glass-clear`, `surface-solid` utilities | both | `glass.SurfaceMaterial` (`Glass`, `GlassClear`, `Solid`) | `material` parameter on Card, Sheet, Dialog, Menu, Toaster, TopBar, ActionBar; `Modifier.material`, `MaterialSurface` for the rest. |
| `glass` preset | both | `theme.UiStyle.Glass` (`UiTheme(style = ...)`) | Chrome glass, content solid. |
| `--glass-regular-*`, `--glass-clear-*` | both | `theme.UiGlass`, `GlassMaterial` | Generated from the same tokens. Sheen, shadow and noise layers are not ported. |
| `backdrop-filter` | both | `glass.GlassState`, `glassSource`, `rememberGlassState` | `GraphicsLayer` + `BlurEffect`; Android 31+, desktop, iOS. Tint fallback elsewhere. |
| glass-on-glass nested tint | both | `glass.MaterialSurface` nesting marker | Near-solid `float` fill. |
| reduced transparency, more contrast | both | `UiTheme(reduceTransparency, highContrast)` | OS defaults on iOS and Android high-contrast. |
| refraction (SVG displacement) | both | `glass.LiquidGlass` (`lens = RefractionLens(dispersion = Dispersion())` / `CrystalLens()`, `LiquidInteraction`), `UiTheme(chromeGlass)` | Opt-in per feature like the web tiers (base, lens, crystal, dispersion, interaction), each preset its own value; runtime shader lens (Android 13+, desktop, iOS); blur plus rim on API 31-32, tint plus rim below. Frosted stays available. |

## Overlays


| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Dialog` | both | `overlays.Dialog` | Glass with `UiStyle.Glass`. |
| `Drawer` | both | `overlays.Sheet` | The web drawer is a side panel; Compose is a bottom sheet with scrollable body and pinned footer. |
| (full-screen sub-screen) | compose-only | `overlays.FullScreenModal`, `FullScreenModalColors`, `FullScreenModalDefaults` | A modal layer: hides the app from accessibility, focus to the header, back handling. |
| `DropdownMenu` | both | `overlays.Menu` | Roles for items, checkbox and radio items; opens an anchored popup (no screenshot golden). |
| `Toaster` / `toast` | both | `overlays.Toaster`, `primitives.ToastHostState` | Same `success`/`error`/`info` shape and queue of two. |
| `ContextMenu` | web-only | none | |
| `Popover` | web-only | `primitives.AnchoredPopup` (headless) | No styled popover. |
| `HoverCard` | n/a | none | Touch has no hover. |
| `PreviousFocusProvider` (focus return) | both | `primitives.OverlayLayer` | Focus returns to the exact element when a layer closes. |

## Navigation

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Tabs` | both | `navigation.Tabs`, `TabItem` | Selected tab role, optional count. |
| `Segmented` | both | `navigation.Segmented`, `SegmentedOption` | |
| `Topbar` | both | `navigation.TopBar`, `BarColors`, `BarDefaults` | Chrome: glass with `UiStyle.Glass`. |
| (pinned bottom actions) | compose-only | `navigation.BottomActionBar`, `BottomActionBarDefaults` | Insets, keyboard and an optional `dockHeight`. |
| `ActionBar` | both | `navigation.ActionBar` | Floating capsule; chrome. |
| `Stepper` | web-only | none | |
| `FloatingToc` | n/a | none | |

## Auth

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| (sign-in screen frame) | compose-only | `auth.AuthScaffold`, `AuthScaffoldColors`, `AuthScaffoldDefaults`, `AuthHeaderShape` | Header band, overlapping or arc-cut sheet, pinned bottom slot, insets and keyboard. Welcome mode (`expanded`): full-screen header with a poster title and outlined echo, tagline and `welcomeAction` slot, one shared transition to the form, `onBackToWelcome` on system back. From a font scale above 1 the header text stops growing at 1.3x, the header band is limited to 40% of the screen (30% with the keyboard up), and below a 480dp visible sheet the pinned slot scrolls with the content. The web sibling lives in `packages/ui` (separate feature). |
| (header art) | compose-only | `auth.AuthArcs`, `AuthArcsColors`, `AuthArcsDefaults` | Concentric arcs that sway, lengthen with progress, dim on the password, shake on error and carry a comet on success; clear of the header text; still frame with motion off. |
| (header art) | compose-only | `auth.AuthFloatingArt`, `AuthFloatingArtColors`, `AuthFloatingArtDefaults` | Up to 8 pieces (kit icons and shapes) in 3 depth layers: drift, drag parallax with spring back, state reactions; fewer pieces in a short header; still frame with motion off. |
| (form state) | compose-only | `auth.AuthState`, `AuthProgress` | Idle, Typing, Password, Error, Success; progress 0..1 with capacities of 12 id characters and 8 password characters. The web sibling feature (`auth-layout` in `packages/ui`, separate branch) has its own `formProgress` with 10 and 10; the two are independent and are not meant to match, so there is no web counterpart to keep in sync. |
| (pill fields) | compose-only | `auth.AuthTextField`, `AuthPasswordField`, `AuthFieldColors`, `AuthFieldDefaults` | Built on `forms.Input`; reveal labels default to `UiStrings`. |
| (actions) | compose-only | `auth.AuthPrimaryButton`, `AuthLink`, `AuthActionDefaults` | Pill action over `atoms.Button`; 48dp link. |
| (login assembly) | compose-only | `auth.LoginScreen` | Convenience over the parts; drives the header state from the fields; disables the fields and the done key while `loading`; replays the error reaction on every failed attempt (`errorKey`). |

## States

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `EmptyState` | both | `states.EmptyState` | |
| `ErrorState` | both | `states.ErrorState` | Correlation id, retry. |
| `OfflineBanner` | both | `states.OfflineBanner` | Queued-changes counter. |
| `Skeleton` | both | `states.Skeleton`, `SkeletonCircle`, `SkeletonText`, `SkeletonGroup` | Static under reduced motion. |
| `ForbiddenState` | web-only | none | |

## Shell, calendar, charts, palette, AI, rich text

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `AppShell`, `Sidebar`, `Topbar` | n/a | none | Multi-pane desktop shell; apps own their navigation on phones, so the web `collapsed` rail has no counterpart. |
| `MonthView`, `WeekView`, `TimelineView`, `DayChip`, `EventBlock` | web-only | none | Out of scope for now. |
| Charts (54 kinds: line, bar, area, pie, donut, scatter, heatmap, sankey, treemap, maps, gauges, sparkline and more) | web-only | none | Out of scope for now. |
| `CommandPalette` | n/a | none | Keyboard-driven. |
| AI set (`ChatMessage`, `ChatList`, `Conversation`, `PromptInput`, `CodeBlock`, `Markdown`, `ToolCall`, `Source`, `Attachment`, `Loader`, `TextShimmer`, `ChainOfThought`, `MessageActions`, `PromptSuggestion`) | web-only | none | Out of scope for now. |
| `RichTextEditor`, `RichTextView` | web-only | none | |
| `dashboards`, `brand`, `xlsx` | n/a | none | Web application and tooling code. |

## Primitives (headless)

| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `DialogPrimitive`, `layer-stack`, `use-layer`, `hide-others` | both | `primitives.OverlayLayer`, `ModalLayer`, `OverlayHost` | Modal layers hide the background from accessibility, own back handling and focus capture. |
| `use-dismissable-layer`, scrim click | both | `primitives.dismissOnTap`, `ModalLayer(dismissOnScrimTap)` | |
| `use-focus-scope`, `focusable` | both | `primitives.initialFocus`, focus restore in `OverlayLayer` | |
| `use-presence` | both | `primitives.OverlayPresence`, `rememberOverlayPresence` | |
| `PopperPrimitive`, `PopoverPrimitive` | both | `primitives.AnchoredPopup`, `anchoredPopupPosition` | Flip and RTL aware. |
| `MenuPrimitive` | both | `primitives.menuItem`, `menuCheckboxItem`, `menuRadioItem`, `menuGroup` | Semantics modifiers. |
| `CommandPrimitive` | web-only | none | |
| `Portal`, `scroll-lock`, `pointer-events-lock` | n/a | none | DOM concerns; `OverlayHost` draws layers inline. |
| (sheet drag and dismiss state) | compose-only | `primitives.SheetState`, `rememberSheetState`, `sheetDraggable`, `sheetTranslation` | |
| (toast queue) | compose-only | `primitives.ToastHostState`, `ToastHost`, `ToastItem`, `ToastAction`, `ToastTone` | The web calls the `toast` function. |
| (masked digit input) | compose-only | `primitives.MaskedInputState`, `DigitMask`, `rememberMaskedInputState` | |

## Known gaps in the Compose subset

- Everything marked web-only above, by design (charts, data grid, calendar, AI, rich text, shell).
- No styled popover, no `Textarea`, `Slider`, `Rating`, `Stepper`.
- The kit is checked on JVM only for pixels: Roborazzi goldens are recorded and verified on desktop (Skia), not through
  Robolectric on Android.

## Re-recording screenshot goldens

The goldens in `kit/screenshots` are the Linux ones and CI verifies them on ubuntu. Skia text rendering differs on macOS, so never commit goldens recorded locally. To re-record after an intended visual change, run the `ui-compose-record` workflow (`gh workflow run ui-compose-record.yml --ref <branch>`, available once the file is on the default branch), then `gh run download <id> -n roborazzi-goldens -D packages/ui-compose/kit/screenshots` and commit the PNGs. Before the workflow is on the default branch, temporarily add a `push` trigger for your branch to it. A local `verifyRoborazziJvm` on macOS can report small glyph differences; treat CI as authoritative.
