---
title: Theme generation
description: createTheme turns a brand color into a full light and dark token set with guaranteed WCAG AA contrast.
section: Theming
---

`@jcsoftdev/ui-tokens` ships a pure function that derives every semantic token from a few seed colors. It has no dependencies and no DOM access, so it runs at build time, on the server, or in the browser.

```ts
import { createTheme, toCss } from "@jcsoftdev/ui-tokens";

const theme = createTheme({
  brand: "#6d28d9",
  accent: "#0ea5e9",
  neutral: "#64748b",
  contrast: "AA",
});

const css = toCss(theme, { selector: ":root" });
```

In the browser, `applyTheme` is the only function that touches the DOM:

```ts
import { applyTheme } from "@jcsoftdev/ui-tokens/dom";

applyTheme(theme, document.documentElement);
```

## Options

| Option     | Meaning                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `brand`    | Required hex. The primary action color. Its hue and chroma drive the scale.    |
| `accent`   | Optional hex for the neighbour tone (`--accent-2`). Defaults to a hue shift.   |
| `neutral`  | Optional hex whose hue tints the grays. Defaults to a near-neutral from brand. |
| `danger`   | Optional hex that overrides the error color.                                   |
| `contrast` | `"AA"`. Text pairs are at least 4.5:1, UI pairs at least 3:1, in both schemes. |

The guarantee is checked for every foreground and background pair the theme declares, for light and dark. The brand color is used as the fill exactly as given. Everything that must read against it or against a surface (`on-accent`, `accent-ink`, `accent-word`, the status colors, chart colors, field borders) is solved: its OKLCH lightness moves until the WCAG ratio is met, and out-of-gamut colors lose chroma, never lightness. `auditTheme(theme)` returns the list of violations (empty when compliant) so you can assert it in your own tests.

## CLI

```bash
ui-theme generate --brand "#6d28d9" [--accent "#0ea5e9"] [--neutral "#64748b"] --out ./theme
```

merges the generated colors into the bundled default tokens (the `data-accent` presets are kept) and writes `tokens.json` (the same shape as `default.json`), `tokens.css`, `theme.css`, `tailwind.css` and `fonts.css`. Add `--danger <hex>` to override the error hue.
