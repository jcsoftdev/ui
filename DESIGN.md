---
name: "@jcsoftdev/ui"
description: "Token-driven component library: soft hairline surfaces, pill controls, a single rose accent that any palette can replace."
colors:
  canvas: "#f4f4f8"
  surface: "#ffffff"
  surface-2: "#eeeef1"
  sunken: "#e7e7ed"
  line: "#e3e3e6"
  line-strong: "#d2d2dc"
  line-control: "#85858f"
  ink: "#000000"
  ink-2: "#4b4b57"
  ink-3: "#666673"
  accent: "#faa2a2"
  on-accent: "#3f191a"
  accent-ink: "#a43a41"
  accent-word: "#dc5d63"
  accent-soft: "#ffebea"
  accent-line: "#f6c2c1"
  accent-2: "#fec79e"
  danger: "#c51f1c"
  danger-soft: "#ffe0d4"
  warning: "#865900"
  warning-soft: "#feefcf"
  info: "#0b5cad"
  info-soft: "#e8f2fc"
  success: "#0b7643"
  success-soft: "#dff8e6"
  dark-canvas: "#000000"
  dark-surface: "#0e0e10"
  dark-ink: "#f2f2f5"
  dark-accent-ink: "#ffb4b3"
  durazno-fill: "#efae75"
  menta-fill: "#77d3ad"
  cielo-fill: "#76c9f8"
  lavanda-fill: "#bab3fe"
  orquidea-fill: "#eaa3d5"
  grafito-fill: "#26262b"
  chart-cat-1: "#2f7fc1"
  chart-cat-2: "#12936f"
  chart-cat-3: "#c7820f"
  chart-cat-4: "#6d5bd8"
  chart-cat-5: "#bd4b95"
  chart-cat-6: "#5f6b7d"
  chart-cat-7: "#788f22"
typography:
  kpi-number:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  page-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  dialog-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.4
  card-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  row-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
  control:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.5
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  overline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  chip: "6px"
  event: "10px"
  control: "12px"
  banner: "14px"
  card: "16px"
  dialog: "20px"
  sheet: "36px"
  pill: "999px"
spacing:
  space-2: "2px"
  space-4: "4px"
  space-6: "6px"
  space-8: "8px"
  space-10: "10px"
  space-12: "12px"
  space-14: "14px"
  space-16: "16px"
  space-18: "18px"
  space-28: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-ink}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "38px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
---

# Design System: @jcsoftdev/ui

## Overview

This file documents the incumbent system as the code defines it: the generated tokens in `packages/ui-tokens`
(source `tokens/default.json`, theme name "Barbershop default"), the React components in `packages/ui/src`, and the
site styles in `site/src/styles`. It is a record, not a redesign. Values are the light theme unless a dark value is
named.

The default look is the `soft` style: depth comes from hairline edges instead of borders, shadows are nearly
absent, controls are pills, and cards sit on a cool grey canvas. A single rose accent carries every action and
selection; it is one of six interchangeable accent families, so the system is meant to be re-themed, not restyled
by hand. Liquid Glass is a material the kit provides for overlays and chrome, not the default surface.

Every visual decision is a CSS custom property. Components read semantic tokens (`--surface`, `--ink`, `--accent`,
`--radius-card`) and expose component variables as `--ui-<component>-<prop>`; presets, accents, density and radius
levels change tokens, never component code.

**Creative North Star: "The Dial Set".** The identity is the switchboard, not a single look. Style, accent, density, radius
and theme are independent switches on `data-*` attributes, so a product makes the kit its own by turning dials, never by
editing components. Hairline-first depth and the rose accent are the default dial positions, and Liquid Glass is one of
the positions, not the baseline. Work that touches the landing page or the docs should let a visitor turn a dial and see
the whole kit change.

**Key Characteristics:**
- Hairline-first depth: a 0.67px edge plus at most a faint shadow in the default style.
- Pill controls (`--radius-button: 999px`), 12px fields, 16px cards, 20px dialogs.
- One accent per screen, chosen from six families and re-derived for dark.
- Figtree only, weights 400 to 800, tight tracking on large numerals and titles.
- Density, radius, style, accent and theme are independent switches on `data-*` attributes.
- Dark is true black (AMOLED); depth there is carried by lines, not shadows.

## Colors

A cool neutral stack with one warm rose accent and a set of paired status colors. Each colored role has a
solid value for fills and a separate "ink" value tuned for text contrast. The default accent family is named
`coral` in the tokens (`--pal-coral-*`, "Por defecto es Coral" in `tokens/default.json`) and "Coral" on the site;
this file calls its roles Rose for description only, and code and copy use the token name.

### Primary
- **Rose Accent** (`--accent` #faa2a2): fill for primary buttons, switch-on, selected controls. Text on it uses
  `--on-accent` (#3f191a).
- **Rose Ink** (`--accent-ink` #a43a41; dark #ffb4b3): accent as text or outline on neutral surfaces, the focus ring
  color, and the primary button hover fill.
- **Rose Word** (`--accent-word` #dc5d63): a single highlighted word in a title, never body text.
- **Rose Wash** (`--accent-soft` #ffebea) and **Rose Line** (`--accent-line` #f6c2c1): tinted chip fill and its edge.
- **Peach Pair** (`--accent-2` #fec79e): second hue paired with the accent, used by charts and decorative gradients.

### Secondary (alternative accent families)
Selected with `data-accent`: `durazno` (#efae75), `menta` (#77d3ad), `cielo` (#76c9f8), `lavanda` (#bab3fe),
`orquidea` (#eaa3d5), `grafito` (#26262b). Each defines `fill`, `deep`, `ink`, `word`, `soft`, `line` and `-2`
(`--pal-<name>-*`) and remaps the whole `--accent*` set.

### Neutral
- **Cool Canvas** (`--bg` #f4f4f8; dark #000000): page background.
- **White Surface** (`--surface` #ffffff; dark #0e0e10): cards, rows, fields.
- **Mist** (`--surface-2` #eeeef1) and **Sunken** (`--sunken` #e7e7ed): hover fills and inset wells.
- **Hairlines** (`--line` #e3e3e6, `--line-strong` #d2d2dc, `--hair` rgba(0,0,0,.11)): dividers and card edges.
- **Control Edge** (`--line-control` #85858f): the only line strong enough to meet the 3:1 UI contrast bar.
- **Ink** (`--ink` #000000; dark #f2f2f5), **Ink 2** (#4b4b57), **Ink 3** (#666673): primary, secondary, tertiary text.

### Status
`--danger` #c51f1c, `--warning` #865900, `--info` #0b5cad, `--success` #0b7643, each with a `-soft` wash
(#ffe0d4, #feefcf, #e8f2fc, #dff8e6). Chips and alerts pair wash and solid; the solid is the text color.

### Data
`--chart-cat-1` to `--chart-cat-7` (#2f7fc1, #12936f, #c7820f, #6d5bd8, #bd4b95, #5f6b7d, #788f22) plus
`--chart-cat-reserve` (#dc5d63) that replaces a series colliding with the active accent. `--chart-up` #0f8a55 and
`--chart-down` #d23b35 for deltas.

### Named Rules
**The One Accent Rule.** One accent family is active at a time; never mix two `--pal-*` families on one screen.
**The Ink Pairing Rule.** Colored text uses the `-ink` (or status solid) value, never the `fill` value, so contrast
holds (4.5:1 text, 3:1 UI components per the generator).
**The Tokens-Only Rule.** Components reference semantic variables; a literal hex in component code is a defect.

## Typography

**Font:** Figtree (variable, weights 300 to 900) with `ui-sans-serif, system-ui, -apple-system, "Segoe UI"` as the
fallback. The site adds a mono stack (`ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas`) for code.

**Character:** One geometric humanist family does everything; hierarchy comes from weight (650 to 800) and tracking,
not from a second typeface. Body text is a compact 14px.

### Hierarchy
- **KPI number** (800, 24px, 1.2, -0.025em): indicator figures.
- **Page title** (800, 22px, 1.25, -0.02em): one per view; may carry one `--accent-word` word.
- **Dialog title** (750, 16px, 1.4) and **Card title** (700, 15px, 1.4, -0.01em).
- **Body / Lede** (400, 14px, 1.5); **Row title** (650, 14px, 1.5); **Control** (650, 13px, 1.5).
- **Meta** (400, 12px, 1.5) and **Chip text** (650, 12px, 1): secondary and compact labels.
- **Overline** (700, 11px, 0.08em tracking): section kickers.
- **Mobile set** (`m-title` 22/800, `m-card-title` 20/800, `m-row-title` 15/700, `m-body` 15/400, `m-button` 15/700,
  `m-meta` 13/400): the thumb-sized variant for the app surface.
- Size steps: `fs-100` 10, `fs-110` 11, `fs-120` 12, `fs-130` 13, `fs-140` 14, `fs-150` 15, `fs-160` 16,
  `fs-200` 20, `fs-240` 24, `fs-440` 44 (px).

### Named Rules
**The Weight Ladder Rule.** Emphasis moves between 650, 700, 750 and 800; avoid 500 and 600 for headings.
**The Scale Switch Rule.** Text sizes scale through `--font-scale`; never hardcode a px size outside the `fs-*` steps.

## Layout

Spacing is a small named scale (2, 4, 6, 8, 10, 12, 14, 16, 18, 28 px). Density is a unitless `--density` factor set
by `data-density` (`compact` 0.875, `normal` 1, `comfortable` 1.125, `touch` 1.125 with 44px targets). It multiplies
control heights, `--pad-control-x` (16px), `--pad-card` (16px) and the gap tokens `--gap-density-sm/-/lg`
(8, 12, 18 px). `auto` density maps a fine pointer to normal and a coarse pointer to touch.

Control heights are shared so a row aligns: `--control-height-sm` 30px, `--control-height-md` 38px,
`--control-height-lg` 52px, `--input-height` 38px; touch lifts them to 44 and 48px. Page width tokens:
`page-m` 720px, `page-w` 1280px, `page-xw` 1600px. App chrome: sidebar 244px, top bar 58px. Components use
container queries (`@container/card`, `@container/dialog`) rather than viewport breakpoints. The documentation
site wraps Starlight content at 50rem with 1.7 line height.

## Elevation & Depth

Hybrid, with a flat default. The `soft` style uses an edge-plus-whisper vocabulary; other presets swap the entire
shadow set. In dark there are no drop shadows (they do not read on black); depth is a 1px light edge.

### Shadow Vocabulary
- **Flat** (`--shadow-flat`: `0 0 0 .67px rgba(0,0,0,.11), 0 1px 2px rgba(0,0,0,.04)`): cards, secondary buttons.
- **Hero** (`--shadow-hero`: `0 0 0 .67px rgba(0,0,0,.11), 0 4px 18px rgba(0,0,0,.10)`): the one elevated card per view.
- **CTA** (`--shadow-cta`: `0 8px 36px rgba(0,0,0,.065)`): the large primary button; neutral grey, never brand-tinted.
- **Selected** (`--shadow-sel`: `0 2px 8px rgba(0,0,0,.10)`): the chosen pill in a segmented control.
- **Pop** (`--shadow-pop`: `0 0 0 .67px rgba(0,0,0,.11), 0 18px 48px -12px rgba(0,0,0,.22)`): dialogs, sheets, menus.

### Style presets (`data-style`)
`soft` (default), `bordered` (1px `--line-strong` borders, no shadows, radii tighter), `elevated` (layered shadows,
no borders), `flat` (no borders or shadows, tinted card fill), `glass` (translucent chrome over a gradient page
backdrop), `brutal` (2px ink borders, `4px 4px 0 0 var(--ink)` hard shadow, square corners, 60ms motion).

### Glass
Regular glass is `--glass-regular-tint` rgba(255,255,255,.72), blur 20px, saturate 1.8; clear glass is tint
rgba(255,255,255,.14), blur 10px, saturate 1.5. The Liquid Glass lens adds `--liquid-*` variables (refraction, frost,
specular, rim, shadow). `data-glass` presets: `liquid-clear` (refraction 0.9, frost 0.6px), `liquid-thick`
(refraction 1, bevel 32px, frost 3px), `liquid-crystal` (refraction 1.67, no contrast guarantee), and the theme
`liquid-regular` default. Reduced transparency and more-contrast preferences remove the blur.

### Named Rules
**The One Hero Rule.** Only one card per view takes `--shadow-hero`; everything else is flat.
**The Hairline Rule.** Separation is a hairline edge, not a border, unless the active style is `bordered`.
**The Material Opt-In Rule.** Glass is applied to overlay and chrome surfaces (`surface-overlay`, `material` prop), not to content cards.

## Shapes

Rounded, pill-forward geometry. Radius tokens: `radius-xs` 4px (keys, hatch labels), `radius-chip` 6px,
`radius-event` 10px, `radius-control` 12px (fields, nav items), `radius-tile` 12px, `radius-banner` 14px,
`radius-card` 16px, `radius-dialog` 20px, `radius-sheet` 36px (floating bottom sheet), `radius-pill` 999px
(buttons, chips, trays, avatars). Component aliases `radius-button`, `radius-input`, `radius-badge` and
`radius-popover` map onto these and are what components read. The `data-radius` switch (`none`, `sm`, `md`, `lg`,
`full`) rescales the whole set; at `none` everything is square. Switches are 34 x 20px pills with a 14px thumb.

## Components

Components are Tailwind 4 utility compositions over the tokens; custom utilities such as `focus-ring`, `pressable`,
`surface-card`, `surface-overlay` and `border-card` bind them to the variables above.

### Buttons
- **Shape:** pill (`--radius-button`), heights 30 / 38 / 52 px, weight 650, 6px gap for icons.
- **Primary:** `--accent` fill, `--on-accent` text, bold; hover turns to `--accent-ink` with `--surface` text.
- **Secondary (default):** `--surface-control` with `--shadow-control`, hover `--surface-2`.
- **Ghost:** transparent, `--ink-2` text, hover `--surface-2` and `--ink`. **Danger:** `--danger-soft` fill, `--danger` text.
- **States:** disabled at 45% opacity; busy stays focusable and swallows clicks; press scales to `--press-scale` (.97).

### Chips
- **Style:** tone washes (`neutral`, `accent`, `danger`, `warning`, `success`, `info`), `solid` accent, and `outline`
  with an inset `--line-strong` edge. Pill by default, `radius-chip` when square. Text 12px, weight 650.

### Cards / Containers
- **Corner style:** `radius-card` (16px). **Background:** `--surface-card`. **Shadow:** `--shadow-card` (flat by default).
- **Border:** width from `--border-width-card` (0 in soft; 1px in bordered; 2px ink in brutal).
- **Internal padding:** `--pad-card` 16px sides, 14px body (`space-14`), 12px header rows.

### Inputs / Fields
- **Style:** `radius-input` (12px), `--surface-control` fill, control border from `--border-color-control`.
- **Focus:** a 2px `--accent-ink` outline pulled inside the edge, border made transparent.
- **Invalid:** `aria-invalid=true` switches the border to `--danger`. Placeholder uses `--ink-3`.

### Navigation
- Segmented controls are a `--seg-track` tray (`radius-button`, 3px inner padding) with a 30px option; the selected option sits on
  `--seg-on` with `--shadow-sel`. Nav icon-to-text gap is 10px (`space-10`).

### Overlays
- **Dialog:** `radius-dialog`, `surface-overlay`, `--shadow-overlay`, `--scrim` backdrop (rgba(0,0,0,.2); dark .72); opens near the top
  (9dvh), max height 84dvh; the close target is 30px (44px under touch).

### Focus
- Global `:focus-visible` is a 2px solid `--focus-ring-color` (`--accent-ink`) outline with 2px offset; the menu surface drops its own ring unless more contrast or forced colors is active.

### Motion
- `--motion-duration` 180ms, `--motion-ease` cubic-bezier(.2,.8,.2,1), press scale .97. Reduced motion collapses
  durations to 0.01ms. Brutal preset shortens to 60ms.

## Do's and Don'ts

### Do:
- **Do** read color, radius, shadow and spacing from semantic tokens (`--surface`, `--radius-card`, `--shadow-card`).
- **Do** use `--accent-ink` for accent text and `--accent` for fills with `--on-accent` text.
- **Do** keep control heights on `--control-height-sm/md/lg` so mixed rows align.
- **Do** keep the focus ring on every interactive element; use `focus-ring` or global `:focus-visible`.
- **Do** make Liquid Glass opt-in via the `material` prop or `data-glass`; it must degrade to `--glass-regular-fallback`.
- **Do** re-theme through `data-accent`, `data-style`, `data-radius`, `data-density` and the theme generator.

### Don't:
- **Don't** put brand tint in `--shadow-cta`; it is neutral grey.
- **Don't** use drop shadows in dark mode; use the 1px light edge.
- **Don't** pair `--pal-*-fill` with text; use the matching `-ink`.
- **Don't** hardcode hex, px radii or font sizes in component code; add a token instead.
- **Don't** add a second elevated hero card to a view.
- **Don't** rename token variables or component `--ui-<component>-<prop>` hooks; they are public API.
