# @jcsoftdev/ui

Token-driven React 19 component library: zero runtime dependencies, Tailwind CSS v4, no runtime CSS-in-JS.
The whole look (colors for light/dark themes, brand palettes, type, radius, shadows, font) comes from
**one tokens JSON file**. Change the file, rebuild the theme, and every component follows.

## Install

```bash
pnpm add @jcsoftdev/ui
# peers: react ^19, react-dom ^19; styling needs tailwindcss ^4
```

Documentation, live Storybook and an LLM-readable index: https://ui.jcsoftdev.com

### Presets (data attributes)

Set these on `<html>` (or any element to restyle only its subtree); no rebuild is needed:

| Attribute | Purpose |
| --- | --- |
| `data-theme="light\|dark"` | Color scheme (omit to follow the OS). |
| `data-accent="<palette-id>"` | Brand palette. |
| `data-style="<preset>"` | Style preset (radii, borders, shadows, glass, ...). See https://ui.jcsoftdev.com/docs/theming/. |
| `data-density="<level>"` | Control and spacing density: `compact`, `normal`, `comfortable`, `touch`. |
| `data-radius="<level>"` | Global corner radius scale. |
| `data-glass="liquid\|liquid-clear\|liquid-regular\|liquid-thick\|liquid-crystal"` | Switch glass surfaces to Liquid Glass (lensing, specular rim) with a preset. Configure one surface with `style={liquidStyle(options)}` and mount `<LiquidGlass />` once for the lens (both from `@jcsoftdev/ui/liquid`); see https://ui.jcsoftdev.com/docs/glass/. |

### Subpath exports

- Component groups: `@jcsoftdev/ui/atoms`, `forms`, `overlays`, `navigation`, `containers`, `states`, `shell`, `palette`, `calendar`, `charts`, `dashboards`, `utils`, each also per component (`@jcsoftdev/ui/atoms/button`).
- `@jcsoftdev/ui/ai`: chat, prompt input, markdown and code block building blocks for AI interfaces.
- `@jcsoftdev/ui/rich-text`: rich text editor with a sanitizer.
- `@jcsoftdev/ui/motion`: `Reveal`, `Stagger`, `CrossFade`, `Presence`, `CountUp` and `useHighlightRow`, on the `--motion-*` tokens and reduced-motion aware.
- `@jcsoftdev/ui/i18n`: `UiStringsProvider`, `useUiStrings` and the `en`/`es` string presets.
- `@jcsoftdev/ui/xlsx`: dependency-free `.xlsx` writer.
- `@jcsoftdev/ui/brand`: logo mark and logo forge utilities.
- `@jcsoftdev/ui/styles/*` and `@jcsoftdev/ui/tokens/*`: CSS and token JSON.

## Quickstart (5 lines)

```bash
pnpm add @jcsoftdev/ui                       # peers: react, react-dom, tailwindcss v4
npx ui-theme build my-tokens.json --out src/theme   # optional: your own look (default theme ships built)
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "@jcsoftdev/ui/styles/tokens.css"; /* or ./theme/tokens.css */
@import "@jcsoftdev/ui/styles/theme.css";  /* or ./theme/theme.css  */
@import "@jcsoftdev/ui/styles/base.css";
@source "../node_modules/@jcsoftdev/ui/dist"; /* lets Tailwind see the classes used by the components */
```

Import order is free: `theme.css` declares nothing in Tailwind's `theme` layer that points back at itself (tokens such as `--radius-input` are mapped with `@theme reference inline`, so `rounded-input` reads the raw variable directly). `tokens.css` and `base.css` can sit unlayered, or in a layer of your own (`@import "…/tokens.css" layer(ui);`) declared before or after `theme`, with no `@layer` reordering and no re-declared names. Verified with Tailwind 4.3.3.

```tsx
import { Button } from "@jcsoftdev/ui/atoms/button";
<Button variant="primary">Save</Button>;
```

## Theming

`ui-theme build [tokens.json] --out <dir> [--kotlin-package <pkg>] [--no-kotlin]` generates:

| File | Purpose |
| --- | --- |
| `tokens.css` | CSS variables. Light by default, dark through `prefers-color-scheme` and the `[data-theme="dark"]` / `[data-theme="light"]` override, brand palettes through `[data-accent="<id>"]`. |
| `theme.css` | Tailwind v4 `@theme inline` mapping variables to utilities (`bg-surface`, `text-ink`, `rounded-card`, `shadow-flat`, `text-page-title`, `h-control-height`, ...). |
| `fonts.css` | Optional `@import` for the Google Fonts declared in the tokens. Skip it when the app loads fonts itself (for example `next/font`, then override `--font-sans`). |
| `Theme.kt` | Compose Multiplatform colors (per theme), palettes, shapes, sizes and text styles, so a Kotlin app shares the same tokens. Needs hex or `rgb(a)` colors: pass `--no-kotlin` to skip it when tokens use `var(...)` or `oklch(...)`. |

Without a tokens argument the bundled default (`tokens/default.json`) is used; its output is already shipped as
`@jcsoftdev/ui/styles/{tokens,theme,fonts}.css`.

### Tokens file shape

```jsonc
{
  "name": "My theme",
  "color": {
    "themes": [{ "id": "light" }, { "id": "dark" }],        // first = default, "dark" also follows the OS
    "tokens": [
      { "name": "bg", "value": { "light": "#f4f4f8", "dark": "#000" } },
      { "name": "accent", "value": "#faa2a2" },               // plain string = same in every theme
      { "name": "pal-mint-fill", "value": "#77d3ad" }         // pal-<id>-<fill|deep|ink|word|soft|line|2> => [data-accent="<id>"]
    ]
  },
  "type": { "fonts": [{ "family": "Figtree", "source": "google", "spec": "Figtree:wght@300..900" }],
            "families": { "sans": "\"Figtree\", system-ui, sans-serif" },
            "groups": [{ "name": "Text", "family": "sans", "styles": [{ "name": "body", "fontSize": "14px", "lineHeight": 1.5, "fontWeight": 400 }] }] },
  "radius":  { "tokens": [{ "name": "radius-card", "value": "16px" }] },
  "shadow":  { "tokens": [{ "name": "shadow-flat", "value": { "light": "0 1px 2px #0001", "dark": "0 0 0 1px #fff1" } }] },
  "spacing": { "tokens": [{ "name": "space-16", "value": "16px" }] },
  "size":    { "tokens": [{ "name": "control-height", "value": "36px" }] }
}
```

Components reference these semantic token names only (`bg`, `surface`, `ink`, `accent`, `on-accent`, `accent-ink`, `danger`, `line`, ...).
A custom tokens file must define the same names as `tokens/default.json`; copy it and edit the values.

Switching at runtime: set `data-theme="light|dark"` (remove it for "system") and `data-accent="<palette-id>"` on `<html>`.

## Customization

Every styled component can be restyled without forking it: override the CSS variables, pass
`classNames={{ part: "..." }}` for the inner parts (`className` still targets the root; your
classes win on conflicts), reuse the exported variant maps (`buttonClasses`, `buttonVariantClasses`,
`chipToneClasses`, ...), and use `createCn` / `extendCn` for your own theme tokens. Full guide:
https://ui.jcsoftdev.com/docs/customization/

## Touch density

`data-density="touch"` is the preset for phones operated with a thumb: controls and small buttons are
44px tall, large buttons 52px, text inputs 48px, and padding follows `comfortable`. Components with
fixed hit areas (Checkbox, Switch, RadioGroup rows, an interactive Chip, the Dialog and Drawer close
buttons) grow to at least 44px under it and are unchanged under every other level.

`data-density="auto"` picks the level from the input device, with CSS only: `normal` sizes on a fine
pointer (mouse, trackpad) and `touch` sizes under `@media (pointer: coarse)` (phones, tablets).
It is opt-in, not the default: with no attribute the kit keeps `normal` everywhere, so upgrading
never resizes an existing app on touch devices.

```html
<html data-density="auto"> <!-- or any subtree: <main data-density="touch"> -->
```

Recommended setup:

- Put `auto` on `<html>` so every screen adapts to the device.
- Force `touch` on operational screens (POS, kitchen display, kiosk) that are used by finger even
  when a mouse is plugged in.
- Force `compact` or `normal` on dense admin tables.

An explicit level on a subtree always beats an `auto` ancestor, because each level redeclares the
whole set of density tokens on its own element. Fixed hit areas read `--touch-target` (0 or 44px) and
the `--touch` switch (0 or 1) instead of a selector, so they follow whichever level is nearest, `auto` included.

Portaled content (Dialog, Drawer) leaves the subtree, so set the attribute on `<html>` or pass the
`container` prop to keep it inside. Custom token files can declare absolute sizes per level:
`{ "id": "touch", "density": 1.125, "values": { "control-height": "44px" } }`; the keys must be
tokens listed in `styles.density.scaled` or `styles.density.fixed`. Both sides of `auto` are level
ids in `styles.density.auto` (`{ "fine": "normal", "coarse": "touch" }`); point them at other levels
to retune them, or remove the key to emit no `auto` level. `auto` is reserved and cannot be a level id.

## Localized default strings

Default texts (Retry, Close, Loading, the optional marker, Cancel, Confirm, Processing…) come from
`UiStringsProvider`. `en` is the default and needs no provider; `es` is neutral Spanish (tú).
Explicit props such as `retryLabel` or `closeLabel` always win.

```tsx
import { UiStringsProvider } from "@jcsoftdev/ui/i18n";

<UiStringsProvider locale="es" strings={{ retry: "Probar otra vez" }}>
  <App />
</UiStringsProvider>;
```

`uiStrings.en` and `uiStrings.es` export the presets; `useUiStrings()` reads the active set. A nested
provider inherits its parent and overrides only the keys it passes. Hard-coded Spanish labels that
older components already ship (NumberStepper, Carousel, AI set) are not routed through it yet.

## Status, forms and states (additive props)

| Component | Added |
| --- | --- |
| `Button` | `loading` keeps the button focusable (`aria-disabled` and `aria-busy`, clicks and form submission ignored, not dimmed; `disabled` still disables natively), `loadingLabel` (shown instead of the children while `loading`, announced through a status region), `block` (full width), `size="lg"` (52px at normal density, scaled like the other controls). |
| `Field` | `optional` appends the localized "(optional)" marker to the label; `error` also accepts `null`. |
| `Banner` | `appearance="outline"` (page surface, only the border carries the tone; default `soft`), `title`; a default glyph per tone when `icon` is not passed (`icon={null}` hides it, so status never relies on color alone); only `danger` is `role="alert"`, the rest are `role="status"`; the `info` tone uses the `info` tokens. |
| `Chip` | `icon`, `statusIcon` (prefixes `info`, `success`, `warning`, `danger` chips with their glyph), and an `info` tone. |
| `ErrorState` | `title` and `description` (`message` keeps working as the headline), `actions`; an `Error` or any non-renderable value is never printed, a generic localized sentence is shown instead. |

## Blocks for application screens (additive)

New components, all zero-dependency, localized through `UiStringsProvider`, laid out with container
queries and sized for touch density. Props, accessibility notes and type-checked examples:
https://ui.jcsoftdev.com/docs/blocks/

| Component | Entry | What it is |
| --- | --- | --- |
| `Spinner`, `Kbd` | `atoms` | Loading ring (`size`, `label`, `label={false}` for decorative) and a styled `<kbd>`. |
| `IconButton` | `atoms` | Square `Button` with a required `label` (`aria-label`), `variant`, `size`, `loading`. |
| `DueChip` | `atoms` | Due-date chip: overdue, soon (`soonDays`) and ok states with a glyph and sr-only suffix; time-zone safe. |
| `Seal` | `atoms` | Stamp mark: `title`, `icon`, `tone`, optional named `label`. |
| `Tooltip` | `overlays` | Hover and focus tip: `content`, `shortcut`, `side`, `openDelay`, `closeDelay`; `role="tooltip"`. |
| `AlertDialog` | `overlays` | `role="alertdialog"` with cancel and confirm, `tone="danger"`, async `onConfirm` with a pending state. |
| `SelectMenu` | `forms` | Custom listbox select over `options` (groups, disabled options, typeahead, hidden `name` input). |
| `Combobox` | `forms` | Filterable, async-friendly (`onSearchChange`, `loading`), `clearable`, `emptyText`. |
| `DatePicker`, `DateTimePicker` | `forms` | Typed masked input plus calendar popover; ISO values, `min`, `max`, `isDateDisabled`, locale week start. |
| `DateCalendar` | `calendar` | Standalone keyboard date grid behind the pickers. |
| `ChipGroup` | `forms` | Multi or single toggle chips (`aria-pressed`, roving focus, `count`, `name`). |
| `Wizard` | `navigation` | `Stepper` plus Back/Next/Finish: `steps`, async `canAdvance`, `onBeforeNext`, `onComplete`. |
| `TabsNav`, `TabsNavLink` | `navigation` | Link-mode sub-navigation strip (`aria-current="page"`, `renderLink` or `asChild`). |
| `Section`, `Note`, `Aside` | `containers` | Titled block with `actions` and optional `divider`, a text note with a `tone`, and a complementary region. |
| `ListDetail` | `containers` | Master-detail that collapses to one pane under 641px of its own width. `listWidth` or `ratio` for a list rail, `surface="card"`, `stickyList`, a `ListDetailHeader` above the list and a `ListDetailEmpty` detail placeholder. |
| `PageHeader`, `PageHeaderBack` | `containers` | Page title block with `back`, `breadcrumbs`, `meta` and `tabs` rows and a `sticky` variant. |
| `Page` | `containers` | The `page` container; `aside` adds a side rail that stacks under the content at 1000px of page width. |
| `DetailHeader` | `containers` | Record header: `avatar`, `name`, `status`, `subtitle`, `facts` and `actions`. |
| `Feed`, `FeedEvent` | `containers` | Activity log with a mark, text and `<time>` (absolute or `relative`). |
| `Shortcuts`, `ShortcutsItem` | `containers` | Link or button tiles with `icon`, `count`, `kbd`. |

Additive props on existing components:

| Component | Added |
| --- | --- |
| `DescriptionList` | `layout` (`auto`, `inline`, `stacked`), `columns` (1 to 3), `valueAlign` (`end`, `start`); `DescriptionListItem` with a dash placeholder for empty values. |
| `Chip` | `size="sm"` (compact; a tag is `<Chip size="sm" square>`). |
| `Skeleton` | `variant` `list`, `kpis`, `key-value`, `bar` and `count`. |
| `ErrorState` | `actions` node, rendered in the same row as the retry button (the retry button now sits inside a wrapper `div`). |
| `RadioGroup` | Each radio is named by its label and described by its description. |
| `Checkbox`, `Switch` | The 44px touch target is an invisible `::after`; under touch density the layout box stays 40px. |
| `Table` | `flush` (`true`, `"start"`, `"end"`), `stickyHeader`, `maxHeight`, selection (`selectedKeys`, `defaultSelectedKeys`, `onSelectedKeysChange`, `rowKey`, `TableSelectCell`, `TableSelectAllCell`), `TableActionsCell` (wraps, or swaps for your overflow `menu`, under a narrow table container). |
| `Section` | Parts `Section.Header`, `.Title`, `.Count`, `.Description`, `.Actions`, `.Body` next to the props; a titleless wrapper takes no heading level. |
| `Kpi` | Parts `Kpi.Label`, `.Value` (`mono`, `suffix`, `trend`), `.Description`; `card` chrome; `trailing` slot. |
| `Timeline` | `status` per item (`done`, `current`, `error`, `pending`) and `Timeline.Item` children. |
| `Stepper` | `status` per step with a glyph and a spoken state. |
| `AlertDialog` | `confirmDisabled`, `cancelDisabled`; compound `AlertDialog.Root`, `.Trigger`, `.Content`, `.Title`, `.Description`, `.Cancel`, `.Action`. |
| `ListDetail` | `onBack` for the back action; `onValueChange` never receives `null`. |
| `DueChip` | `state` forces `overdue`, `soon`, `ok` or `done`. |
| `Seal` | `tone="institutional"` and any `tonePalettes` tone by name. |
| `DropdownMenu` | `DropdownMenuContent bare` (no panel look), `DropdownMenuAnchor`, `dropdownMenuItemClasses`, `dropdownMenuSurfaceClasses` for custom menus. |
| `toast` | `toast.info`, `toast.warning`, `toast.danger`; success, info, warning and error toasts are tinted with a glyph. |

In tests, reset the toast store with `import { resetToasts } from "@jcsoftdev/ui/overlays/testing"`
(kept off the `overlays` entry so production bundles never carry it).

## ConfirmAction and ResponsiveList

```tsx
import { ConfirmAction } from "@jcsoftdev/ui/containers/confirm-action";

<ConfirmAction
  label="Cancel order"
  consequence="The order of Marco Salazar is cancelled and S/ 45 is refunded."
  onConfirm={async () => {
    const res = await cancelOrder(id);
    return res.ok ? undefined : { ok: false, error: "The payment is already settled." };
  }}
/>;
```

`ConfirmAction` swaps its trigger for the consequence, a danger button and a Cancel button that takes
focus. While `onConfirm` runs the button shows the localized "Processing…"; a returned
`{ ok: false, error }` or a thrown error keeps the step open with an inline message.

```tsx
import { ResponsiveList } from "@jcsoftdev/ui/containers/responsive-list";

<ResponsiveList
  caption="Today's orders"
  items={orders}
  rowKey={(o) => o.id}
  columns={[
    { key: "customer", header: "Customer", cell: (o) => o.customer, primary: true },
    { key: "total", header: "Total", cell: (o) => o.total, align: "end" },
  ]}
  renderActions={(o) => <Button size="sm">Open</Button>}
/>;
```

A table from `md` up (library `Table` styling) and a stack of cards below it; the `primary` column
(default: the first) titles each card and the other columns become label/value rows. Every row
carries `data-row-key`; `rowClassName` applies to both layouts.

## Install a single component (tree shaking)

The package is unbundled ESM, `"sideEffects": ["**/*.css"]`, and every component has its own entry point:

```ts
import { Button } from "@jcsoftdev/ui/atoms/button";   // only Button + Slot + cn()
import { Dialog } from "@jcsoftdev/ui/overlays/dialog"; // only the Dialog + the dialog primitive
import { Chip, Avatar } from "@jcsoftdev/ui/atoms";     // group entry: still tree-shakes
```

Entries: `atoms`, `forms`, `overlays`, `navigation`, `containers`, `states`, `shell`, `palette`, `calendar`, `charts`, `utils`, `icons`
(each also as `<group>/<component>`), plus `styles/*` and `tokens/*`. The package has no runtime
dependencies (only the `react` and `react-dom` peers), so a consumer that imports one component only bundles that
component's own code. Components that need state are marked `"use client"`.

Tailwind needs to see the class names inside the package: add `@source "…/node_modules/@jcsoftdev/ui/dist";`
(see Quickstart). Each component's styling is plain Tailwind classes over tokens; there are no per-component CSS files.

## Develop

```bash
pnpm --filter @jcsoftdev/ui build      # styles + dist (ESM + .d.ts)
pnpm --filter @jcsoftdev/ui lint       # biome
pnpm --filter @jcsoftdev/ui typecheck
pnpm --filter @jcsoftdev/ui test       # token generator golden test
```

The `source` export condition points at `src/*/index.ts` for consumers that want to compile the TypeScript themselves.

## Conventions

- English identifiers; every visible string and aria label is a prop. Defaults are English and can be localized in one place with `UiStringsProvider`.
- Relative imports use the `.js` extension; components import specific component entries, never group barrels.
- No literal colors in components, no `dark:` variants; dark mode is a token concern.


## Headless primitives

`@jcsoftdev/ui/primitives` publishes the unstyled behavior under the overlays (`DialogPrimitive`, `PopoverPrimitive`, `PopperPrimitive`, `MenuPrimitive`, `CommandPrimitive`, `Portal` and the layer hooks) so you can bring your own markup and styles. Importing one primitive does not bundle the others. See the [guide](https://ui.jcsoftdev.com/docs/primitives).

## Icons

`@jcsoftdev/ui/icons` exports every icon as its own tree-shakeable component (`import { Check } from "@jcsoftdev/ui/icons"`). The SVG sources in `icons/svg` are vendored from [Lucide](https://lucide.dev) (ISC, see `icons/LICENSE-lucide`); regenerate the components with `pnpm build:icons`.

## Third-party notices

The package has no runtime dependencies. Icon sources are vendored from Lucide (ISC, with Feather MIT portions), and the class merge engine, command scorer and overlay behavior are derived from or modeled on tailwind-merge, cmdk and Radix UI (MIT). Attributions and license texts are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
