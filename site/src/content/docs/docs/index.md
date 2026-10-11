---
title: Introduction
description: What @jcsoftdev/ui is, what it ships and how this documentation is organised.
section: Guides
---

`@jcsoftdev/ui` is a token-driven React 19 component library with zero runtime dependencies, built on Tailwind CSS v4. There is no runtime CSS-in-JS: the whole look comes from one tokens file that is compiled to CSS variables, and a handful of `data-*` attributes restyle everything at runtime.

## What is inside

- **Atoms, forms, containers, overlays, navigation, states, shell**: the everyday building blocks, including a DataGrid with formulas, undo, XLSX export and integrated charts.
- **Charts**: about one hundred pure React and SVG charts and chart parts (line, bar, donut, radar, gauge, heatmap, treemap, sankey, stock, globe, maps, crossfilter...) with no chart dependency.
- **AI kit** (`@jcsoftdev/ui/ai`): conversation, streaming-friendly messages, markdown, code blocks, prompt input and tool calls.
- **Rich text**, **XLSX** writer, **brand** tools (Logo Forge), calendar views and a command palette.

Everything adapts to the width of its **container**, not the viewport, so a component behaves the same in a sidebar, a card or a dialog.

## How to read these docs

1. [Getting started](/docs/getting-started/) installs the package and wires the CSS.
2. [Theming and presets](/docs/theming/) explains `data-style`, `data-density`, `data-radius`, `data-accent` and `data-theme`.
3. Each page under **Components** is generated from the library source: import path, props with types and defaults, accessibility notes, a live example and links to Storybook.
4. Language models can read the same content as plain Markdown: see [Docs for LLMs](/docs/llms/).

## Conventions

- Documentation and identifiers are in English. Sample data in examples is Spanish (a barbershop), because that is the product the library was built for.
- Component pages are regenerated from `packages/ui/src` on every build, so props and import paths never drift from the code.
