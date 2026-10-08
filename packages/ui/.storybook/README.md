# Storybook conventions

Run: `pnpm --filter @jcsoftdev/ui storybook` (dev, port 6006) or `build-storybook` (static).

## Every story file

- Lives next to the component: `src/<category>/<component>/<component>.stories.tsx`.
- CSF3, typed with `import type { Meta, StoryObj } from "@storybook/react-vite"`; use `satisfies Meta<typeof Component>`.
- `title: "<Category>/<ComponentName>"`. Categories: Foundations, Atoms, Forms, Navigation, Containers, Overlays, Shell, Palette, Calendar, States, Charts, AI.
- `tags: ["autodocs"]` and `component` set.
- `args` + `argTypes` so Controls work (`inline-radio` for unions, `boolean`, `text`). Use `control: false` for non-serializable props.
- A `Default` story first, then one story per meaningful variant or state (sizes, disabled, loading, empty, error).
- Realistic Spanish barbershop sample data: clientes, servicios, barberos, inventario, soles with the `S/` prefix (`S/ 35`).
- Import the component relatively (`./button.js`), never from `@jcsoftdev/ui`.
- No network calls and no Next.js imports (`next/*`).
- Use decorators only for layout (width, positioning); do not restyle the component.

## Responsive: container queries

Every component adapts to the width of its CONTAINER, not the viewport, so it works the same
in a sidebar, a card, a dialog or a full page.

- Use Tailwind v4 container queries: the component's root (or the wrapper that owns the
  layout) gets `@container` (name it, e.g. `@container/kpi`, when nested containers could
  clash) and children use `@xs:`, `@sm:`, `@md:`, `@lg:`… (or `@sm/kpi:`). Do not use
  viewport breakpoints (`sm:`, `md:`) inside the library.
- Charts measure their container (ChartFrame/ResizeObserver) and also adapt: fewer ticks,
  rotated or skipped labels, legend moves below, tooltips stay inside the frame, data labels
  hide when they do not fit.
- Nothing may overflow horizontally at 320 px: long text truncates or wraps, tables scroll
  inside their own wrapper, toolbars wrap.
- Check every story with the "Contenedor" toolbar at 320, 480, 768 and full (the frame can
  also be dragged to any width).

## Theme and palette

The toolbar sets `data-theme` (`light`/`dark`) and `data-accent` (Coral is the default and has no attribute) on `<html>`, same as the web app. Use token utilities (`bg-surface`, `text-ink`, `border-line`), never hard-coded colors. Check both themes and a couple of palettes before finishing.

## Style presets, density and radius

Three root attributes restyle the whole library with zero runtime: they only remap CSS custom
properties generated from `tokens/default.json` (`styles` section) into `styles/tokens.css`.
Never hand-edit `tokens.css`, `theme.css` or `Theme.kt`: change the JSON or
`scripts/build-theme.mjs` and run `pnpm build:styles`.

| Attribute | Values | Default (no attribute) |
| --- | --- | --- |
| `data-style` | `soft`, `bordered`, `elevated`, `flat`, `glass`, `brutal` | `soft` (the base tokens) |
| `data-density` | `compact` (×0.875), `normal`, `comfortable` (×1.125) | `normal` |
| `data-radius` | `none`, `sm`, `md`, `lg`, `full` | the preset's own radii |

- They combine with `data-theme` and every `data-accent`. Presets with light/dark-specific
  values (`elevated`, `glass`) get dark blocks for both `data-theme="dark"` and
  `prefers-color-scheme: dark`.
- They work on any element, not only `<html>`: `<section data-style="glass">` restyles its
  subtree. Every block declares its whole set of properties, so nesting never reads stale
  values computed at `:root`.
- Precedence on one element is source order at equal specificity: theme < accent <
  `data-style` < `data-density` < `data-radius`. `data-radius` also wins over a preset set on a
  descendant (presets read `var(--radius-card-override, <own>)`). Presets never touch density
  tokens; the generator rejects it. No `!important` anywhere.
- Density is a unitless `--density` that scales control heights, control and card padding and
  the `gap-density*` scale with `calc()`. Tailwind's global `--spacing` is not scaled.
- Avatars keep their shape under `data-radius`; only a preset (`brutal`) squares them.

### Components must read semantic tokens

A preset can only restyle what reads its tokens. Use these, never raw radii, arbitrary
shadows (`shadow-[...]`), fixed heights or `border border-line` for a card edge:

| Concern | Tokens / utilities |
| --- | --- |
| Radius | `rounded-button`, `rounded-input`, `rounded-badge`, `rounded-avatar`, `rounded-popover`, `rounded-card`, `rounded-control`, `rounded-chip`, `rounded-dialog`… |
| Edge | `border-card`, `border-control`, `border-t-divider`, `border-b-divider` (width + style + color) |
| Shadow | `shadow-card` (pairs with `border-card`), `shadow-raised`, `shadow-overlay`, `shadow-control`, `shadow-selected`, `shadow-inset`, `shadow-inset-accent`, `shadow-pinned-start/end` |
| Surface | `bg-surface-card`, `bg-surface-control`, `bg-surface-overlay`, `bg-surface-sunken`, `bg-surface-backdrop`; add `surface-card`/`surface-overlay` for the glass blur |
| Density | `h-control`, `h-control-sm`, `h-input`, `px-control-x`, `p-card`, `gap-density-sm`, `gap-density`, `gap-density-lg` |
| Focus and motion | `focus-visible:focus-ring`, `pressable`, `ease-style`, `duration-(--motion-duration)` |

A card edge is `border-card shadow-card`: `soft` puts the hairline in the shadow (border width
0), `bordered` puts it in the border (no shadow). The legacy names (`shadow-flat`,
`shadow-pop`, `shadow-hero`, `radius-*`, `control-height`) are remapped by the presets too,
so unrefactored components follow along partially. The `Foundations/StylePresets` story shows
every preset side by side; check it with the Estilo, Densidad and Radio toolbars.

## AI set (`@jcsoftdev/ui/ai`)

Chat building blocks live in `src/ai` and are exposed only through the subpath export
`@jcsoftdev/ui/ai` (the `./*` export maps to `dist/ai/index.js`; they are not re-exported from
other folders). Everything is dependency-free: `Markdown` builds React elements from its own AST
(raw HTML is shown as text, links allow only http, https and mailto) and `CodeBlock` ships a tiny
tokenizer for ts, js, json, bash, go and sql. Keyframes (dots, caret, shimmer) are injected once
through a hoisted `<style href precedence>`; all of them honor `prefers-reduced-motion`.
`Conversation` is a `role="log"` scroller that follows new content until the user scrolls up and
then offers a "jump to latest" button. The `AI/Asistente` story composes the whole set with a
simulated streaming reply.

## Files

- `main.ts`: stories glob, addons (docs, a11y), Tailwind v4 vite plugin.
- `storybook.css`: Tailwind entry plus library tokens/theme/base; `@source "../src"` generates the utilities used in components.
- `preview.tsx`: toolbar globals (theme, accent, style, density, radius, container) and the decorator that sets them on `<html>`.
