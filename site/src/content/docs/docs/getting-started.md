---
title: Getting started
description: Install @jcsoftdev/ui, import the token stylesheets and render your first component in Next.js, Astro or Vite.
section: Guides
---

## Install

```bash
pnpm add @jcsoftdev/ui
```

Peer dependencies are `react` and `react-dom` (19) and `tailwindcss` v4. Radix, `lucide-react`, `cmdk` and `sonner` are regular dependencies of the package.

## Import the styles

The package ships its default theme already compiled. Import the three stylesheets after Tailwind and point Tailwind at the package so it can see the class names used by the components:

```css
/* app/globals.css */
@import "tailwindcss";
@import "@jcsoftdev/ui/styles/tokens.css"; /* CSS variables: colors, radii, shadows, presets */
@import "@jcsoftdev/ui/styles/theme.css"; /* Tailwind v4 @theme mapping: bg-surface, text-ink, rounded-card... */
@import "@jcsoftdev/ui/styles/base.css"; /* focus ring, reduced motion, body defaults */
@source "../node_modules/@jcsoftdev/ui/dist"; /* lets Tailwind generate the utilities the components use */
```

`@jcsoftdev/ui/styles/fonts.css` is optional: it imports Figtree from Google Fonts. Skip it when your app loads fonts itself and override `--font-sans`.

## Use a component

```tsx
import { Button } from "@jcsoftdev/ui/atoms";
import { Kpi } from "@jcsoftdev/ui/containers";

export function Today() {
  return (
    <div className="grid gap-3">
      <Kpi label="Citas hoy" value="18" />
      <Button variant="primary">Reservar corte</Button>
    </div>
  );
}
```

Every component is also a single entry point, for example `@jcsoftdev/ui/atoms/button`. See [Tree-shaking and subpaths](/docs/subpaths/).

## Next.js

Components that hold state are marked `"use client"`, so they work from Server Components as long as you pass serializable props. The package is plain ESM; no `transpilePackages` is required.

```tsx
// app/layout.tsx
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={figtree.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* globals.css, after the imports */
:root {
  --font-sans: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;
}
```

## Astro

Add `@astrojs/react` and the Tailwind Vite plugin, import the same stylesheets in a global CSS file and render components as islands (`client:visible` for heavy ones such as charts). This site is built that way.

## Vite

Use `@tailwindcss/vite`, import the stylesheets in your entry CSS and import components as usual. Nothing else is needed.

## Switch the look at runtime

Set attributes on `<html>` (or on any element, to restyle just its subtree):

```html
<html data-theme="dark" data-style="glass" data-accent="menta" data-density="compact"></html>
```

Read [Theming and presets](/docs/theming/) for every value and the precedence rules.
