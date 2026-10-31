---
title: Theming and presets
description: Zero-runtime theming with data-style, data-density, data-radius, data-accent and data-theme, plus precedence and custom token files.
section: Theming
---

The whole look comes from one tokens file, `tokens/default.json`. A build step turns it into CSS custom properties (`tokens.css`) and a Tailwind v4 theme (`theme.css`). At runtime nothing is computed in JavaScript: five attributes only remap CSS variables.

| Attribute      | Values                                                                | Default (no attribute)         |
| -------------- | --------------------------------------------------------------------- | ------------------------------ |
| `data-theme`   | `light`, `dark`                                                       | follows `prefers-color-scheme` |
| `data-accent`  | `durazno`, `menta`, `cielo`, `lavanda`, `orquidea`, `grafito`         | Coral                          |
| `data-style`   | `soft`, `bordered`, `elevated`, `flat`, `glass`, `brutal`             | `soft`                         |
| `data-density` | `compact` (x0.875), `normal`, `comfortable` (x1.125), `touch`, `auto` | `normal`                       |
| `data-radius`  | `none`, `sm`, `md`, `lg`, `full`                                      | the preset's own radii         |

```html
<html data-theme="dark" data-style="brutal" data-accent="cielo" data-density="comfortable">
  ...
  <section data-style="glass">only this subtree is glass</section>
</html>
```

## Import order

`theme.css` has no self-referencing custom property in Tailwind's `theme` layer. Tokens whose utility name equals the raw variable (`--radius-input`, `--shadow-pop`, `--font-sans`, ...) are declared in a `@theme reference inline` block: the utilities exist and read `var(--radius-input)` directly, and nothing is emitted for them in the `theme` layer. So `tokens.css` and `base.css` can load unlayered or in any layer of yours, before or after `theme`:

```css
@import "tailwindcss";
@import "@jcsoftdev/ui/styles/tokens.css" layer(ui);
@import "@jcsoftdev/ui/styles/theme.css";
@import "@jcsoftdev/ui/styles/base.css" layer(ui);
```

The build test (`test/theme-css.test.mjs`) compiles the theme with Tailwind and fails on any `--x: var(--x)` in the output. Verified with Tailwind 4.3.3 (`@theme reference`).

## Style presets

Each preset changes shape, edge and elevation, not the palette:

- `soft`: hairline shadows instead of borders, pill buttons (the default).
- `bordered`: crisp 1px borders, no shadows, tighter radii.
- `elevated`: real shadows and a lifted card surface; has light and dark variants.
- `flat`: no shadows and no borders; surfaces separate by tone only.
- `glass`: translucent, blurred chrome (dialogs, menus, popovers, top bar, sidebar) over a gradient page backdrop, with solid cards; has light and dark variants. The material itself is available in every preset, see [Liquid Glass](/docs/glass).
- `brutal`: thick borders, hard offset shadows, square corners.

## Precedence

On a single element the order is source order at equal specificity: theme, then accent, then `data-style`, then `data-density`, then `data-radius`. `data-radius` also wins over a preset set on a descendant, because presets read `var(--radius-card-override, <own radius>)`. Presets never touch density tokens. There is no `!important` anywhere.

## Density

Density is a unitless `--density` that scales control heights, control and card padding and the `gap-density*` scale with `calc()`. Tailwind's global `--spacing` scale is not scaled.

`touch` is built for thumbs: it also pins absolute sizes (controls 44px, large buttons 52px, inputs 48px) because one multiplier cannot lift 30px and 36px controls to the same 44px target. Fixed-size hit areas (Checkbox, Switch, radio rows, interactive Chip, dialog close buttons) grow to 44px under it. Portaled content leaves the subtree, so set the attribute on `<html>` or pass `container` to keep dialogs inside.

`auto` follows the input device with CSS only: `normal` sizes on a fine pointer and `touch` sizes under `@media (pointer: coarse)`. It is opt-in (with no attribute the kit stays on `normal`), and an explicit level on a subtree always wins over an `auto` ancestor. Recommended setup:

- `auto` on `<html>`, so phones and tablets get 44px targets and mouse desktops stay compact.
- `touch` forced on operational screens (POS, kitchen display, kiosk).
- `compact` or `normal` forced on dense admin tables.

Fixed hit areas read `--touch-target` (0 or 44px) and a 0/1 `--touch` token instead of a selector, so they follow the nearest level. A custom token file retunes the two sides with `styles.density.auto` (`{ "fine": "normal", "coarse": "touch" }`, level ids) or omits the key to drop `auto`.

## Using tokens in your own code

Use the semantic utilities so your UI follows the presets too:

| Concern          | Utilities                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radius           | `rounded-button`, `rounded-input`, `rounded-card`, `rounded-popover`, `rounded-chip`...                                                                                           |
| Edge             | `border-card`, `border-control`                                                                                                                                                   |
| Shadow           | `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-control`                                                                                                                |
| Surface          | `bg-surface-card`, `bg-surface-control`, `bg-surface-sunken`; utilities `surface-card`, `surface-overlay`, `surface-nav`, `surface-side`, `surface-solid`, `glass`, `glass-clear` |
| Density          | `h-control`, `h-input`, `px-control-x`, `p-card`, `gap-density`                                                                                                                   |
| Focus and motion | `focus-visible:focus-ring`, `pressable`, `ease-style`                                                                                                                             |

The complete list of tokens, with light and dark values and usage notes, is generated on the [Design tokens](/docs/theming/tokens/) page.

## Your own tokens

Copy `tokens/default.json`, edit values (keep the same names) and run the CLI:

```bash
npx ui-theme build my-tokens.json --out src/theme
```

It writes `tokens.css`, `theme.css`, `fonts.css` and a Compose `Theme.kt` so a Kotlin app can share the tokens. Import your generated files instead of the shipped ones.

### Tone palettes

Add named tones beyond the built-in ones with an optional `tonePalettes` section. Names are kebab-case; `fill` and `soft` are required, `ink` falls back to `fill`. Each role takes a plain value or a `{ "light", "dark" }` pair.

```json
{
  "tonePalettes": {
    "mint": {
      "fill": { "light": "#0f9d76", "dark": "#4fd1a8" },
      "soft": { "light": "#e0f7eb", "dark": "#10352a" },
      "ink": { "light": "#047554", "dark": "#8ee5c6" }
    }
  }
}
```

The build emits `--tone-mint`, `--tone-mint-soft` and `--tone-mint-ink` (plus `--color-tone-mint*` in `theme.css`). Pass the name as `tone="mint"` to `Chip`, `StatusDot`, `Kpi` and `Avatar`.

### Container breakpoints

The optional `containers` section emits literal `--container-<name>` widths in `theme.css`, which Tailwind turns into container-query variants. `tokens/default.json` ships the page breakpoints the layout containers use: `page-m` (720 px), `page-w` (1280 px) and `page-xw` (1600 px).

```json
{ "containers": { "page-m": "720px", "page-w": "1280px", "page-xw": "1600px" } }
```

Inside a `@container/page` ancestor, `@min-page-w/page:grid-cols-3` and `@max-page-m/page:hidden` then work like the built-in `@md` sizes. Values must be literal `px` or `rem` widths, because container queries cannot read `var()`. `Cols variant="thirds"`, `ListDetail` and `ContextRail` use the same cuts, written as arbitrary values so they also work with a theme built before this section existed. `Cols` keeps its original 940 / 1080 / 1500 cuts for the other variants.

## Runtime switching with persistence

```ts
const root = document.documentElement;
root.dataset.style = "glass";
root.dataset.accent = "menta";
localStorage.setItem("preset", JSON.stringify({ style: "glass", accent: "menta" }));
```

Restore it from an inline script in `<head>` before first paint to avoid a flash. This site does exactly that.
