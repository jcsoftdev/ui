---
title: Liquid Glass
description: A glass material for the control and navigation layer in two looks, frosted and liquid (lensing, specular rim, thickness), with regular and clear variants, accessibility fallbacks and per-component opt-in.
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

## Two looks: frosted and liquid

Every glass has two looks. **Frosted** (`glass`, `glass-clear`) is the 0.2/0.3 material: blur, tint, hairline edge. It renders exactly as before. **Liquid** (`liquid`, `liquid-clear`) follows what makes Apple's Liquid Glass recognisable:

- **Lensing**: the backdrop is bent over the whole surface like a dome, strongest at the rim and gentle (never abrupt) towards the centre, with at most 24 px of offset so a large surface does not smear. `--glass-lens-coverage: rim` (or the `coverage` option) limits it to a bevel of about 1.2 times the corner radius, with the middle undisplaced.
- **Specular rim**: with the lens, a second map lights a 1.4px glint on the walls that face the upper left (half strength on the opposite walls). The glint is the lensed backdrop pushed to a saturation of 6, so it takes the colour behind the glass; a 0.75px dark contour and a faint inner shadow separate the glass from the backdrop. Without the lens the CSS rim does the same job with inset shadows.
- **Thickness**: inner highlight, edge glow and a lower inner shadow, plus a soft outer shadow.
- **Chromatic dispersion** at the rim of small surfaces, a thin blur (2px regular, 0.6px clear), saturation 1.5, a soft halo behind text (`--liquid-halo`) and a deeper outer shadow (`--liquid-shadow`, override it to ease the shadow over plain light content).
- **Press flex**: interactive surfaces (`button`, `a`, `[role=button]`, `[data-glass-interactive]`) brighten from within and scale on press. Nothing animates `backdrop-filter`, and under `prefers-reduced-motion` there is no transition.

```html
<div class="liquid rounded-dialog p-5">Regular liquid</div>
<button class="liquid-clear rounded-full px-6 py-2">Clear liquid</button>
```

```tsx region=liquid
export function LiquidCards() {
  return (
    <>
      <Card material="liquid">Lensed along the rim</Card>
      <Card material="glass">Frosted, as before</Card>
    </>
  );
}
```

`material` accepts `"solid" | "glass" | "glass-clear" | "liquid" | "liquid-clear"`. The names `glass` and `glass-clear` keep meaning frosted, so nothing changes for existing apps.

### Switching the whole app

Put `data-glass="liquid"` on `<html>` (or on any scope): `glass`, `glass-clear` and, in the `glass` preset, the chrome surfaces (`surface-overlay`, `surface-nav`, `surface-side`: Dialog, Drawer, menus, Topbar, Sidebar) render liquid. The content layer (`surface-card`) stays solid. Remove the attribute to go back to frosted. Limits: the switch is one-way down the tree (a nested `data-glass="frosted"` does not undo an outer `liquid`; use `material` on the component instead), and surfaces already mounted do not load the lens until they remount.

### The lens

Chromium only: it is the one engine that paints `backdrop-filter: url(#filter)`. Components with a glass `material` (Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, Topbar, Sidebar, ActionBar, Card) call `useGlassLens` internally. It looks at the `--glass-lens` flag that the liquid utilities set and, only then, imports the engine as a separate chunk; frosted and solid surfaces never load it, so tree-shaking and bundle size are untouched for them. It does nothing on import, is SSR-safe, and releases its filter on unmount.

The map is rasterised from the signed distance function of the rounded rectangle (size, radius and pixel ratio aware). Across a rim, the displacement follows a convex squircle height profile through Snell's law (n = 1.5): zero in the middle, strongest at the edge, pulling the content from just inside the shape. Full coverage pulls each axis towards the centre by `A (x / half width)^2` (and the same on y), so the field is smooth with no crease along the diagonals and no seam at the centre; `A` is at most 0.4 of the half size and 24 px. The first lenses (a Snell-law profile, strength equal to the bevel width) folded back on themselves where the offset fell faster than 1 px per px, which broke straight stripes into a repeating sawtooth along the walls; both profiles now keep the slope under 1, and a test checks it. The veil is adaptive: the lens is blurred wide, its luminance read, and a veil of the ink-contrasting colour is laid only where the backdrop is close to the ink, so over friendly backdrops the body stays clear. The directional specular layers are added on top. Dispersion is off by default (it paints a colour fringe on hard edges); turn it on with `--glass-lens-dispersion: .05` or the option, on surfaces up to 100,000 px squared, where it is naturally strongest at the rim because it scales with the local offset. When a lens is first applied the refraction grows from nothing over 280 ms (the materialise), and on a pressed control it lifts to 1.35 times for the duration of the press; neither runs under reduced motion, where there is no lens.

Budgets: at most 8 lenses alive at once, no lens on a surface over 640,000 px squared (they keep the plain liquid look), dispersion only up to 100,000 px squared, the map is rebuilt at most about ten times a second while a surface resizes (one coalesced pass per frame for all surfaces), and the last 16 maps (displacement and specular) are cached. Opt out with `data-glass-lens="off"` on the element or any ancestor, or `--glass-lens: 0` in CSS. It follows `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` and `prefers-reduced-motion` live.

Other engines (Safari, Firefox) get the base liquid look without refraction: rim, thickness, saturation, outer shadow. Legibility is the same: the uniform CSS veil is used there. With the lens active the veil is lighter only along the rim (at most the outer 28px), so text placed on the rim of a surface over a black or white backdrop has less contrast than the guarantee below, which is measured away from it.

### Measured cost

Chromium headless with software compositing, device pixel ratio 2, unthrottled frame loop while a photo scrolls under the surface (so every frame re-renders the backdrop). These are relative numbers, not GPU numbers:

| Surface                          | Frame time |
| -------------------------------- | ---------- |
| No lens (frosted or liquid)      | 0.1 ms     |
| Nav bar 1280x56, lens + specular (dispersion off, the default) | about 6 ms |
| Dialog 520x320, lens + specular (dispersion off, the default) | about 16 ms |
| Either with dispersion on | about 2x |

The cost only exists while the backdrop changes (scrolling under a nav, animations behind a surface); a modal dialog over a static page does not pay it per frame. Dispersion roughly doubles it on large surfaces, which is why it is off by default there. Building a map costs 1 to 7 ms at ratio 2 for typical sizes (a 520x320 surface: about 6 ms).

### Imperative API

`applyGlassRefraction(element, options)` and `useGlassRefraction()` still exist for any element, glass or not, with `scale`, `bezel`, `dispersion`, `veil`, `specular`, `animate`, `refraction: "force"` and `auto` (only while `--glass-lens` is 1). `useGlassLens(ref?)` is the ref the components use; reuse it for your own surfaces.

```tsx region=lens
export function Lens() {
  const ref = useGlassLens<HTMLDivElement>();
  return (
    <div ref={ref} className="liquid-clear rounded-dialog p-6">
      Bent edges
    </div>
  );
}
```

Safari parses `backdrop-filter: url(...)` and then paints nothing, and Firefox ignores it, so `@supports` cannot gate it. `supportsBackdropRefraction()` is a feature allow-list: the declaration parses, `SVGFEDisplacementMapElement` exists and the Blink-only `-webkit-app-region` property exists. It is not a pixel test.

## Tokens (liquid)

Shared, per theme where light and dark differ: `liquid-regular-blur`, `liquid-clear-blur`, `liquid-saturate`, `liquid-regular-filter`, `liquid-clear-filter`, `liquid-regular-tint`, `liquid-regular-dim`, `liquid-clear-tint`, `liquid-clear-dim`, `liquid-rim`, `liquid-depth`, `liquid-depth-active`, `liquid-halo`, `liquid-shadow`. Border, edge-less shadow and fallback reuse `glass-*`. Liquid glass trades veil for transparency, so its measured floors are lower than the frosted 4.8:1 and documented. Without the lens (the fallback, a uniform veil): regular keeps `text-ink` at 4.5:1 and `text-ink-2` at 3.5:1, clear keeps `text-ink` at 4.5:1 and `text-ink-2` at 2:1 over white, black, split and striped backdrops. With the lens (adaptive veil), over a smooth photo-like backdrop `text-ink` keeps 4.5:1 and `text-ink-2` 2:1 on every pixel; over hard fine stripes the worst pixel keeps 2:1 for `text-ink` and the text halo carries the glyphs. Use regular glass, or frosted, for small secondary copy. The halo is not counted in these numbers. The price is the same as for frosted: over a dark backdrop, light liquid glass is pale.

## Sources

- WWDC25 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/): lensing ("bends, shapes, and concentrates light"), specular highlights that respond to geometry, tint adapting to what is behind, Regular vs Clear, glass that "illuminates from within" on press, thicker glass with deeper shadows and stronger lensing.
- Apple Newsroom, [new software design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/): "reflects and refracts its surroundings", specular highlights.
- Apple HIG [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) is JavaScript-rendered and could not be read automatically.
- kube.io, [Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg/): Snell's law, squircle height profile, displacement map encoding, Chromium-only `backdrop-filter: url()`. Dispersion by per-channel displacement is a common technique that is not described there; the implementation here is our own.
