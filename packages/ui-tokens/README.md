# @jcsoftdev/ui-tokens

Design tokens, the CSS variable contract and a pure WCAG AA theme generator for the jcsoftdev UI
platform. Zero runtime dependencies.

## Install

```bash
pnpm add @jcsoftdev/ui-tokens
```

## What ships

| Path                              | Contents                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `styles/tokens.css`, `theme.css`  | Color, spacing, radius, density and style-preset variables.            |
| `@jcsoftdev/ui-tokens/tailwind.css` | Tailwind v4 `@theme` mapping of the variables.                      |
| `tokens/default.json`             | Source of truth that the CSS and `Theme.kt` are generated from.        |
| `ui-theme` bin                    | `build` and `generate` commands.                                       |
| `.` (`createTheme`, `toCss`, ...) | Pure functions, safe in Node, SSR and the browser.                     |
| `./dom` (`applyTheme`)            | The only module that touches the DOM.                                  |

## Generate a theme

```ts
import { createTheme, toCss } from "@jcsoftdev/ui-tokens";

const theme = createTheme({ brand: "#6d28d9", neutral: "#64748b" });
const css = toCss(theme); // light, prefers-color-scheme dark and [data-theme] blocks
```

Every foreground/background pair in `CONTRAST_PAIRS` meets WCAG 2 AA (4.5:1 text, 3:1 non-text) in
light and dark; `auditTheme(theme)` lists any violations. In the browser:

```ts
import { applyTheme } from "@jcsoftdev/ui-tokens/dom";

const dispose = applyTheme(theme, document.documentElement);
```

## CLI

```bash
ui-theme build [tokens.json] --out <dir>            # tokens.css, theme.css, tailwind.css, fonts.css, Theme.kt
ui-theme generate --brand "#6d28d9" --out <dir>     # also writes tokens.json
```

Full guide: https://ui.jcsoftdev.com/docs/theming/theme-generator

MIT. Author: jcsoftdev.
