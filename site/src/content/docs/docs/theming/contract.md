---
title: CSS variable contract
description: Which custom properties are public and stable, which are internal, and the --ui-<component>-<prop> convention for component-level overrides.
section: Theming
---

Everything visual is a CSS custom property. This page says which ones you may rely on.

## Public: semantic names

The semantic tokens listed in the [token reference](/docs/theming/tokens/) are the stable contract. Override them on `:root`, on `[data-theme]`, or on any subtree.

| Family        | Examples                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| Surfaces      | `--bg`, `--surface`, `--surface-2`, `--sunken`, `--float`                 |
| Text          | `--ink`, `--ink-2`, `--ink-3`, `--on-accent`                              |
| Brand         | `--accent`, `--accent-ink`, `--accent-word`, `--accent-soft`, `--accent-line`, `--accent-2` |
| Lines         | `--line`, `--line-strong`, `--line-control`, `--hair`                     |
| Status        | `--danger`, `--warning`, `--info`, `--success` and their `-soft` fills   |
| Shape, space  | `--radius-*`, `--shadow-*`, `--space-*`, `--density`                      |
| Type          | `--font-sans`, `--font-scale`, the `--text-*` scale                        |

Rules:

- A semantic name is never renamed or removed in a minor release. A new one may be added.
- Values are documented to meet WCAG 2 contrast for the pairs listed in the token reference; keep that when you override.
- Dark values come from `prefers-color-scheme` or `[data-theme="dark"]`; override both when you replace a color.

## Internal: `--pal-*`

`--pal-<name>-{fill,deep,ink,word,soft,line,2}` are the raw palettes behind `data-accent`. They exist so that `[data-accent="menta"]` can remap the `--accent-*` tokens. They may change between releases: use `data-accent` or the `--accent-*` tokens instead.

## Component-level variables

Components expose a few knobs as `--ui-<component>-<prop>`. Each one defaults to a semantic token, so nothing is set unless you set it:

```css
.ui-button {
  background: var(--ui-button-bg, var(--accent));
  color: var(--ui-button-fg, var(--on-accent));
  border-radius: var(--ui-button-radius, var(--radius-control));
  padding-inline: var(--ui-button-padding-x, calc(var(--density, 1) * 16px));
}
```

```css
/* Override for one subtree only */
.checkout {
  --ui-button-radius: 4px;
}
```

Conventions for new components and for the custom elements:

1. The prefix is `--ui-` plus the component name, then a short property: `--ui-input-border`, `--ui-dialog-width`.
2. The fallback is always a semantic token (never a literal color), so theme changes keep flowing through.
3. Only expose what authors need to change: colors, radius, spacing, size. Layout and state styling stay private.
4. Component variables are read, never declared, by the component stylesheet. Declaring them is the author's job.

## Generating your own values

`@jcsoftdev/ui-tokens` can generate a complete, contrast-checked set of semantic tokens from a brand color:

```bash
npx ui-theme generate --brand "#6d28d9" --out ./theme
```

See [Theme generation](/docs/theming/theme-generator/).
