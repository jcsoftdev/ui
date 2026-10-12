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
| `Checkbox` | both | `atoms.Checkbox` | Boolean and tri-state overloads. |
| `Chip` | both | `atoms.Chip`, `ChipTone` | |
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
| `Input`, `InputIcon` | both | `forms.Input` | `leading` and `trailing` slots replace `InputIcon`. |
| (password input) | compose-only | `forms.PasswordInput` | The web uses `Input` with a password type. |
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
| `Table*`, `DataGrid`, `ResponsiveList` | web-only | none | Out of scope for the Compose kit. |
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
| refraction (SVG displacement) | both | `glass.SurfaceMaterial.Liquid`, `LiquidClear`, `GlassVariant` | Runtime shader lens (Android 13+, desktop, iOS); blur plus rim on API 31-32, tint plus rim below. Frosted stays available. |

## Overlays


| Web | Status | Compose | Notes |
| --- | --- | --- | --- |
| `Dialog` | both | `overlays.Dialog` | Glass with `UiStyle.Glass`. |
| `Drawer` | both | `overlays.Sheet` | The web drawer is a side panel; Compose is a bottom sheet with scrollable body and pinned footer. |
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
| `ActionBar` | both | `navigation.ActionBar` | Floating capsule; chrome. |
| `Stepper` | web-only | none | |
| `FloatingToc` | n/a | none | |

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
| `AppShell`, `Sidebar`, `Topbar` | n/a | none | Multi-pane desktop shell; apps own their navigation on phones. |
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
