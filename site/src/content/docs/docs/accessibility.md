---
title: Accessibility
description: Keyboard support, focus management, reduced motion, contrast and data alternatives built into the components.
section: Guides
---

Accessibility is part of each component, not an add-on.

## Keyboard and semantics

- Interactive primitives (dialogs, menus, popovers, tabs, radio groups, switches, checkboxes) come from Radix, which implements the WAI-ARIA patterns.
- `DataGrid` follows the ARIA grid pattern with a roving tabindex and full keyboard navigation (arrows, Home/End, Enter/F2 to edit, Escape to cancel, Ctrl+Z/Y for undo and redo, Ctrl+V and Ctrl+D/R to paste and fill).
- Overlays return focus to the element that opened them.
- The AI `Conversation` is a `role="log"` region that follows new content until the user scrolls up, then offers a "jump to latest" button.

## Focus

A single token-driven focus ring is applied with `focus-visible` (`--focus-ring-width`, `--focus-ring-color`, `--focus-ring-offset`), so it follows every style preset. Controls never remove it.

## Motion

All animations (entrances, shimmer, streaming caret, chart transitions) honor `prefers-reduced-motion`. The base stylesheet also collapses animation and transition durations for users who ask for less motion.

## Color and contrast

Text and interactive tokens are chosen for contrast on their intended surfaces (the token notes list the measured ratios). Color is never the only signal: charts offer patterns, legends are toggleable buttons and series can be read as a data table.

## Charts

Charts expose an accessible name, an optional data table (`ChartDataTable`) and keyboard navigation across data points where the chart supports it. Tooltips are available on focus as well as hover.

## Labels and language

Every visible string and ARIA label is a prop, with English defaults. Pass translated strings for other locales.

## Testing

Stories run with the Storybook accessibility addon; component-level notes appear in the **Accessibility** section of a component page whenever the source documents them with `@a11y`, `@keyboard` or `@accessibility` JSDoc tags.
