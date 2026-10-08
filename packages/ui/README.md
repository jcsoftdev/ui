# @jcsoftdev/ui

Token-driven React 19 component library: Radix primitives, Tailwind CSS v4, no runtime CSS-in-JS.
The whole look (colors for light/dark themes, brand palettes, type, radius, shadows, font) comes from
**one tokens JSON file**. Change the file, rebuild the theme, and every component follows.

It has no dependency on any app and is designed to be moved to its own repository.

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
| `Theme.kt` | Compose Multiplatform colors (per theme), palettes, shapes, sizes and text styles, so a Kotlin app shares the same tokens. |

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

## Install a single component (tree shaking)

The package is unbundled ESM, `"sideEffects": ["**/*.css"]`, and every component has its own entry point:

```ts
import { Button } from "@jcsoftdev/ui/atoms/button";   // only Button + Radix Slot + cn()
import { Dialog } from "@jcsoftdev/ui/overlays/dialog"; // only the Dialog + @radix-ui/react-dialog
import { Chip, Avatar } from "@jcsoftdev/ui/atoms";     // group entry: still tree-shakes
```

Entries: `atoms`, `forms`, `overlays`, `navigation`, `containers`, `states`, `shell`, `palette`, `calendar`, `charts`, `utils`
(each also as `<group>/<component>`), plus `styles/*` and `tokens/*`. Runtime dependencies (Radix, lucide-react,
cmdk, sonner) are regular `dependencies`, so a consumer that imports one component only bundles that component's
dependencies. Components that need state are marked `"use client"`.

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

- English identifiers; every visible string and aria label is a prop (aria defaults in English).
- Relative imports use the `.js` extension; components import specific component entries, never group barrels.
- No literal colors in components, no `dark:` variants; dark mode is a token concern.
