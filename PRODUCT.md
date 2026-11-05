# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who build product interfaces (internal tools, dashboards, data and AI-assisted apps) with React 19 and
Tailwind CSS 4, or with plain custom elements and no framework. They adopt a kit to avoid designing every control
themselves, and they expect to bend it to their own brand without forking it.

## Product Purpose
`@jcsoftdev/ui` is a component library with a documentation site. It ships sensible default variants and a set of
design tokens, and it can be extended to any color palette or UI standard through those tokens and the theme
generator. Success is a developer reaching a consistent, accessible interface quickly, and re-theming it without
touching component code.

## Positioning
One token system drives the React components, the native custom elements (`@jcsoftdev/ui-elements`) and the
Compose kit. Themes are generated, not hand-tuned: the generator guarantees WCAG 2 contrast (4.5:1 text, 3:1 UI
components). Defaults are opinionated; extension is first-class.

## Operating Context
Used inside app code (React, Tailwind 4, or vanilla HTML with custom elements), documented and demonstrated on the
Astro/Starlight site, and exercised in Storybook. Components must work under theme changes, density and
container-query layouts, and light and dark modes.

## Capabilities and Constraints
- Packages: ui, ui-tokens, ui-core, ui-elements (npm, lockstep versions) and ui-compose (Kotlin, separate).
- Zero runtime dependencies in the framework-agnostic packages; precompiled per-component CSS for vanilla users.
- Component-level variables follow `--ui-<component>-<prop>` and default to semantic tokens.
- Native platform features first (dialog, Popover, inert), with fallbacks.
- Liquid Glass is a material the kit provides, not the only look.
- Size budgets are enforced in CI (`size-budgets.json`).

## Brand Commitments
Author and maintainer: jcsoftdev. No further brand assets or voice rules were confirmed in this session.

## Evidence on Hand
The documentation site (`site/`), Storybook stories under `packages/ui/src`, and the ADR in `docs/adr`. No customer
testimonials, benchmarks or usage numbers were provided; none should be invented.

## Product Principles
1. Defaults earn trust; extension is never a fork. Any palette or UI standard must be reachable through tokens.
2. Accessibility is a guarantee of the system, not a per-component afterthought.
3. One source of truth for tokens across renderers.
4. Components stay unopinionated about product content and expose parts and variables to be restyled.

## Accessibility & Inclusion
WCAG 2 contrast ratios are guaranteed by the theme generator (4.5:1 text, 3:1 UI components); APCA is out of scope
(ADR 0001). Keyboard and focus behavior follow native semantics.
