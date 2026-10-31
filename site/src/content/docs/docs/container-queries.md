---
title: Container queries
description: Components respond to the width of their container, not the viewport, so they behave the same in a sidebar, a card or a dialog.
section: Guides
---

Every component adapts to the width of the box it is placed in. The library uses Tailwind v4 container queries (`@container`, `@sm:`, `@md:`...) and never viewport breakpoints (`sm:`, `md:`) inside components.

## Why it matters

A `KpiGroup` in a narrow sidebar and the same `KpiGroup` across a wide dashboard are the same component. No prop and no media query decides the layout; the container does.

```tsx
<div className="w-80">
  <KpiGroup items={items} /> {/* stacks */}
</div>
<div className="w-full">
  <KpiGroup items={items} /> {/* lays out in a row */}
</div>
```

## Charts measure their container

Charts use a `ResizeObserver` through `ChartFrame` and also adapt: fewer ticks, rotated or skipped labels, a legend that moves below, tooltips that stay inside the frame and data labels that hide when they do not fit. A chart fills its parent exactly, so give the parent a size:

```tsx
<div className="h-72">
  <LineChart series={series} categories={categories} height="fill" />
</div>
```

## Page layouts

Three containers lay out whole screens on the width of their own box. They share the page cuts 720 / 1280 / 1600 px (the `--container-page-m`, `-w` and `-xw` tokens in `theme.css`).

```tsx
import { ContextRail, ResponsiveList } from "@jcsoftdev/ui/containers";

<ResponsiveList
  caption="Orders"
  items={orders}
  columns={columns}
  rowKey={(order) => order.id}
  selectedKey={selectedId}
  onSelect={setSelectedId}
/>;

<ContextRail rail={<Cart />} collapse="sheet" summary={<CartTotal />}>
  <Menu />
</ContextRail>;
```

`ContextRail` keeps a sticky rail (360 / 400 / 440 px) beside the work area and stacks it, or turns it into a bottom sheet behind a `summary` bar, under `breakpoint`. `breakpoint` takes 720, 960 or 1280, plus `"never"` (the rail stays beside the work area at any width) and `"always"` (it is always collapsed). `Cols variant="thirds"` gives three equal columns from 1280 px, two from 720 px and one below. `ResponsiveList layout="auto"` switches between table and cards on its own container width (`breakpoint` 480, 640, 672, 768, 960 or 1280; default 672, which is 42rem), not on the viewport. `SettingsLayout` stacks under `breakpoint` 720, 940, 1080 or 1280 (or `"never"`) of the page container, or of its own with `container="self"`. The cuts are closed sets so every query stays a literal class.

## Guarantees

- Nothing overflows horizontally at 320 px: long text truncates or wraps, tables scroll inside their own wrapper and toolbars wrap.
- Nested containers are named (for example `@container/kpi`) so they do not clash.
- The live examples on every component page have a width control (320, 480, 768, full) to check this.

## In your own layouts

Mark a wrapper as a container and style its children with container variants:

```tsx
<section className="@container">
  <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">...</div>
</section>
```
