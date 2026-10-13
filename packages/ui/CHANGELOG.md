# Changelog

## 0.2.3 (2026-10-13)

### Fixes

- **Checkbox looks like a checkbox.** The box is square (`rounded-xs`, the 4px small-radius token, 3px in the compact theme) instead of a circle, and the checked and indeterminate fill is the accent (as in Switch and the selected RadioGroup row) instead of the success green. Round plus green read as a radio button in multi-select lists. Sizes, 44px touch hit area, focus ring, disabled state and the `box`/`indicator`/`icon` parts are unchanged; RadioGroup stays round.

## 0.2.2 (2026-10-13)

### Fixes

- **`ui-theme build --no-kotlin` no longer builds Kotlin.** It used to generate `Theme.kt` and discard it, so `var(...)` and `oklch(...)` colors still threw "Unsupported color for Kotlin". Without the flag, the error now names the token and suggests `--no-kotlin`.

### Added

- **`@jcsoftdev/ui/theme-builder`** exports `buildTheme`, `buildTokensCss`, `buildThemeCss`, `buildFontsCss` and `buildThemeKt`, typed. `buildTheme` takes `kotlin: false` to skip `Theme.kt`.

## 0.2.1 (2026-10-13)

### Fixes

- **DonutChart / PieChart no longer flicker on hover.** The hovered slice steps out by `explode`
  and was also the pointer target, so a still pointer near its edge ended up outside the moved
  slice, the hover dropped, the slice slid back under the pointer and the loop repeated (tooltip,
  dimming and centre total blinking). Pointer events now go to fixed, invisible hit arcs that leave
  no gap between slices and also cover the stepped-out ring.
- `ChartTooltip` takes an optional `containerHeight` and keeps the card inside it vertically
  (DonutChart passes it), so a slice near the top no longer pushes the card past the chart edge.

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
