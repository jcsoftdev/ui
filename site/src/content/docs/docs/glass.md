---
title: Liquid Glass
description: A glass material for the control and navigation layer, with regular and clear variants, accessibility fallbacks, per-component opt-in and optional refraction.
section: Theming
---

Glass follows Apple's Liquid Glass model: it is a functional layer for **controls and navigation** that floats above content, not a decoration for content. The kit ships the material in every preset, applies it by default only to the chrome layer of the `glass` preset, and lets any surface opt in.

References: Apple HIG [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), WWDC25 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) and [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/).

## When to use it

| Layer                  | Examples                                                                                        | Default                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Control and navigation | Dialog, Drawer, Popover, menus, HoverCard, CommandPalette, ActionBar, Topbar, Sidebar, tooltips | Glass in the `glass` preset, solid in the others |
| Content                | Card, ItemCardGroup, KpiGroup, ResponsiveList, DataGrid, Kanban, chat bodies                    | Always solid                                     |

Rules of thumb: put glass over imagery or changing content, keep it off long reading surfaces, and never stack glass on glass.

## Variants

- **Regular** (`glass`): adaptive, the legible default. Blur 20px, saturation 1.8.
- **Clear** (`glass-clear`): more transparent for media-rich content, so it needs a stronger veil. `--glass-clear-dim` pushes the backdrop away from the ink colour (white in the light theme, black in the dark one) and, in the dark theme, `--glass-clear-brightness` darkens bright content behind it. Keep both; without them text is not legible over white or black. Regular glass has a lighter veil (`--glass-regular-dim`) for the same reason.

Both draw a hairline edge, a specular highlight on the top edge and a soft diagonal sheen.

```html
<div class="glass rounded-dialog p-5">Regular</div>
<div class="glass-clear rounded-dialog p-5">Clear</div>
```

## Tokens

All presets declare the same tokens, so glass is a material and not a preset. Per variant `glass-regular-*` and `glass-clear-*`: `tint`, `blur`, `saturate`, `filter`, `border`, `edge`, `shadow`, `dim`, `fallback`. Shared: `glass-sheen`, `glass-noise` (a transparent no-op; set it to a tiling `url(data:...)` image for grain) and `glass-nested-tint`. The `glass` preset only tunes them (blur 24px, saturation 1.9). See the [token reference](/docs/theming/tokens). `Theme.kt` exports `UiGlass` with the same values for Compose.

The older `--surface-alpha`, `--surface-blur`, `--surface-filter` and `--surface-overlay` still resolve; they alias the regular material in the glass preset.

## Opting in

Every surface accepts glass, but only on request.

```tsx region=opt-in
export function OptIn({ items }: { items: ItemCardGroupItem[] }) {
  return (
    <>
      <Card material="glass-clear">Over a photo</Card>
      <ItemCardGroup classNames={{ list: "glass" }} items={items} />
    </>
  );
}

export function AlwaysOpaque() {
  return <DialogContent material="solid">Always opaque</DialogContent>;
}
```

- `material?: "solid" | "glass" | "glass-clear"` exists on Card, Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, CommandPalette, ActionBar, Topbar and Sidebar.
- Elsewhere put `glass`, `glass-clear` or `surface-solid` in `className` or `classNames`: `cn` treats `surface-card`, `surface-overlay`, `surface-nav`, `surface-side`, `surface-solid`, `glass` and `glass-clear` as one group, so the last one wins.
- A different default for a whole family of components is not a built-in switch; override the `--surface-*` tokens in a scope.

## Accessibility

The opaque fill is the base style and the blur only exists inside `@supports (backdrop-filter)`, so unsupported browsers never get a see-through panel. On top of that:

- `prefers-reduced-transparency: reduce`: opaque fill, no blur.
- `prefers-contrast: more`: opaque fill plus a strong ring.
- `forced-colors: active`: `Canvas` background and a `CanvasText` outline.

Contrast is measured in the test suite on real screenshots, not estimated. For `glass`, `glass-clear`, and the glass-preset `surface-overlay` and `surface-nav`, both `text-ink` and `text-ink-2` keep 4.5:1 over a solid white, a solid black, a hard half-and-half and a fine-stripe backdrop, in the light and the dark theme. Other text tokens (`text-ink-3`, tinted text, links) are not covered: check them if you place them on glass. The price of the guarantee is that dark clear glass is visibly dimmed and light clear glass is milky; that is the legibility floor for an arbitrary backdrop, so lower the veil only when you control what sits behind.

In the preset-scoped fallbacks, only the glass preset adds the high-contrast ring and the forced-colors outline; the other presets keep exactly their 0.2.0 overlay, top bar and sidebar fills in every media mode.

## Glass on glass

Glass inside `.glass`, `.glass-clear` or `.surface-overlay` drops its blur and takes `--glass-nested-tint`, a near-solid fill. This covers `.glass`, `.glass-clear`, `.surface-overlay`, `.surface-nav` and `.surface-side` ancestors. Menus, popovers and hover cards are portaled to `body`, so they are not DOM descendants; the popper marks such content `data-glass-nested` when its trigger sits inside a glass, glass-clear or overlay surface (not a top bar or sidebar), and it then takes the same near-solid fill.

## The `glass` class name

The utilities are plain, unprefixed class names (`glass`, `glass-clear`, `surface-solid`, ...) generated by your Tailwind build. If your app or another library already defines a `.glass` class, the two will collide. Options: rename yours, or override the kit's utility in your own CSS with `@utility glass { ... }` after importing `theme.css`. A prefixed alias (for example `ui-glass`) was considered and not added: the kit's other utilities are unprefixed too, and a second spelling would double the nesting selectors and the merge group for a collision that can be handled in the consumer's CSS. Components never need the class: they take `material`.

## Performance

- Blur cost grows with radius times area. Stay between 8 and 24px and avoid full-screen glass.
- Never put glass on repeated list items; use it for a few floating surfaces.
- An active `backdrop-filter` creates a stacking and containing block; do not nest them.
- Do not animate the blur radius. Fade opacity or transform instead.

## Refraction (optional)

Lensing bends the backdrop along the rim. It is opt-in, off by default and only active in Chromium.

```tsx region=refraction
export function Lens() {
  const ref = useGlassRefraction<HTMLDivElement>();
  return (
    <div ref={ref} className="glass-clear rounded-dialog p-6">
      Bent edges
    </div>
  );
}
```

`applyGlassRefraction(element)` is the imperative form and returns a cleanup. It builds an SVG displacement filter at runtime (no dependencies) and sets `backdrop-filter: <blur> url(#id)` plus `data-glass-refraction="on"`.

Safari parses `backdrop-filter: url(...)` and then paints nothing, and Firefox ignores it, so `@supports` cannot gate it. `supportsBackdropRefraction()` is a feature allow-list: the declaration parses, `SVGFEDisplacementMapElement` exists and the Blink-only `-webkit-app-region` property exists. It is not a pixel test; pass `refraction: "force"` to skip the engine check. Refraction follows the user's preferences live: it is removed as soon as reduced transparency, more contrast, forced colors or reduced motion turn on, and re-applied when they are cleared. Applying it twice to the same element updates it instead of stacking filters, and removing the element (or calling the cleanup) releases the filter.
