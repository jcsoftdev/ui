# Storybook conventions

Run: `pnpm --filter @jcsoftdev/ui storybook` (dev, port 6006) or `build-storybook` (static).

## Every story file

- Lives next to the component: `src/<category>/<component>/<component>.stories.tsx`.
- CSF3, typed with `import type { Meta, StoryObj } from "@storybook/react-vite"`; use `satisfies Meta<typeof Component>`.
- `title: "<Category>/<ComponentName>"`. Categories: Atoms, Forms, Navigation, Containers, Overlays, Shell, Palette, Calendar, States, Charts.
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

## Files

- `main.ts`: stories glob, addons (docs, a11y), Tailwind v4 vite plugin.
- `storybook.css`: Tailwind entry plus library tokens/theme/base; `@source "../src"` generates the utilities used in components.
- `preview.tsx`: toolbar globals and theme decorator.
