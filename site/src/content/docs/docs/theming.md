---
title: Theming and presets
description: Zero-runtime theming with data-style, data-density, data-radius, data-accent and data-theme, plus precedence and custom token files.
section: Theming
---

The whole look comes from one tokens file, `tokens/default.json`. A build step turns it into CSS custom properties (`tokens.css`) and a Tailwind v4 theme (`theme.css`). At runtime nothing is computed in JavaScript: five attributes only remap CSS variables.

| Attribute      | Values                                                        | Default (no attribute)         |
| -------------- | ------------------------------------------------------------- | ------------------------------ |
| `data-theme`   | `light`, `dark`                                               | follows `prefers-color-scheme` |
| `data-accent`  | `durazno`, `menta`, `cielo`, `lavanda`, `orquidea`, `grafito` | Coral                          |
| `data-style`   | `soft`, `bordered`, `elevated`, `flat`, `glass`, `brutal`     | `soft`                         |
| `data-density` | `compact` (x0.875), `normal`, `comfortable` (x1.125), `touch` | `normal`                       |
| `data-radius`  | `none`, `sm`, `md`, `lg`, `full`                              | the preset's own radii         |

```html
<html data-theme="dark" data-style="brutal" data-accent="cielo" data-density="comfortable">
  ...
  <section data-style="glass">only this subtree is glass</section>
</html>
```

## Style presets

Each preset changes shape, edge and elevation, not the palette:

- `soft`: hairline shadows instead of borders, pill buttons (the default).
- `bordered`: crisp 1px borders, no shadows, tighter radii.
- `elevated`: real shadows and a lifted card surface; has light and dark variants.
- `flat`: no shadows and no borders; surfaces separate by tone only.
- `glass`: translucent surfaces with backdrop blur; has light and dark variants.
- `brutal`: thick borders, hard offset shadows, square corners.

## Precedence

On a single element the order is source order at equal specificity: theme, then accent, then `data-style`, then `data-density`, then `data-radius`. `data-radius` also wins over a preset set on a descendant, because presets read `var(--radius-card-override, <own radius>)`. Presets never touch density tokens. There is no `!important` anywhere.

## Density

Density is a unitless `--density` that scales control heights, control and card padding and the `gap-density*` scale with `calc()`. Tailwind's global `--spacing` scale is not scaled.

`touch` is built for thumbs: it also pins absolute sizes (controls 44px, large buttons 52px, inputs 48px) because one multiplier cannot lift 30px and 36px controls to the same 44px target. Fixed-size hit areas (Checkbox, Switch, radio rows, interactive Chip, dialog close buttons) grow to 44px under it. Portaled content leaves the subtree, so set the attribute on `<html>` or pass `container` to keep dialogs inside.

## Using tokens in your own code

Use the semantic utilities so your UI follows the presets too:

| Concern          | Utilities                                                                               |
| ---------------- | --------------------------------------------------------------------------------------- |
| Radius           | `rounded-button`, `rounded-input`, `rounded-card`, `rounded-popover`, `rounded-chip`... |
| Edge             | `border-card`, `border-control`                                                         |
| Shadow           | `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-control`                      |
| Surface          | `bg-surface-card`, `bg-surface-control`, `bg-surface-overlay`, `bg-surface-sunken`      |
| Density          | `h-control`, `h-input`, `px-control-x`, `p-card`, `gap-density`                         |
| Focus and motion | `focus-visible:focus-ring`, `pressable`, `ease-style`                                   |

The complete list of tokens, with light and dark values and usage notes, is generated on the [Design tokens](/docs/theming/tokens/) page.

## Your own tokens

Copy `tokens/default.json`, edit values (keep the same names) and run the CLI:

```bash
npx ui-theme build my-tokens.json --out src/theme
```

It writes `tokens.css`, `theme.css`, `fonts.css` and a Compose `Theme.kt` so a Kotlin app can share the tokens. Import your generated files instead of the shipped ones.

## Runtime switching with persistence

```ts
const root = document.documentElement;
root.dataset.style = "glass";
root.dataset.accent = "menta";
localStorage.setItem("preset", JSON.stringify({ style: "glass", accent: "menta" }));
```

Restore it from an inline script in `<head>` before first paint to avoid a flash. This site does exactly that.
