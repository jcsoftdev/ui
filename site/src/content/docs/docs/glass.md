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

### Configuring the liquid

`material` also takes an object, `{ type: "liquid" | "liquid-clear", ...options }`, on every component that has a `material` prop (Card, Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, Topbar, Sidebar, ActionBar, CommandPalette). The string values keep working. Every option is optional and maps to one `--liquid-*` custom property, so the same configuration can come from a prop, from a scope, or from the theme; the lens engine and the CSS read the same variables, and they inherit. Change them at run time and the lens follows.

```tsx region=liquid-options
export function ConfiguredLiquid() {
  return (
    <Card
      material={{
        type: "liquid",
        profile: "dome",
        frost: 4,
        refraction: 0.8,
        specular: { intensity: 1.2, angle: -60 },
        shadow: { opacity: 0.8, offsetY: 14 },
        interactive: "drag",
        motion: "jelly",
      }}
    >
      A drop of glass
    </Card>
  );
}
```

| Option                     | Variable                                                                      | Meaning (default)                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refraction`               | `--liquid-refraction`                                                         | 0 to 1: the bend as a fraction of the strongest offset that cannot fold the backdrop (1)                                                                                                                                   |
| `bevelWidth`               | `--liquid-bevel`                                                              | px: width of the refracting band (`rim`) or cap of the offset (`full`, `dome`); derived from size and radius, at most 24 px for the whole-surface profiles                                                                 |
| `profile`                  | `--liquid-profile`                                                            | `"full"` a squarish dome over the whole surface (default), `"dome"` a round drop that is flatter in the middle, `"rim"` only a bevel along the edge                                                                        |
| `dispersion`               | `--liquid-dispersion`                                                         | 0 to 0.2: colour channels pulled apart (0); small surfaces only                                                                                                                                                            |
| `frost`                    | `--liquid-frost`                                                              | px of backdrop blur (2 regular, 0.6 clear)                                                                                                                                                                                 |
| `saturation`, `brightness` | `--liquid-saturation`, `--liquid-brightness`                                  | backdrop filter (1.5, 1)                                                                                                                                                                                                   |
| `tint`                     | `--liquid-tint-color`, `--liquid-tint-amount`                                 | `{ color, amount }`: a colour laid over the glass (none; amount 0.2)                                                                                                                                                       |
| `rim`                      | `--liquid-rim-strength`                                                       | 0 to 2: edge highlight (1)                                                                                                                                                                                                 |
| `specular`                 | `--liquid-specular`, `--liquid-specular-angle`                                | `{ intensity, angle }`: the glint on the walls facing the light (1, -120 deg: upper left)                                                                                                                                  |
| `fresnel`                  | `--liquid-fresnel`                                                            | 0 to 1: extra glow towards the edge (0)                                                                                                                                                                                    |
| `grain`                    | `--liquid-grain`                                                              | 0 to 1: film grain (0)                                                                                                                                                                                                     |
| `radius`                   | `--liquid-radius`                                                             | px corner radius (the component's own)                                                                                                                                                                                     |
| `opacity`                  | `--liquid-opacity`                                                            | 0 to 1: the legibility veil (1)                                                                                                                                                                                            |
| `shadow`                   | `--liquid-shadow-opacity`, `--liquid-shadow-spread`, `--liquid-shadow-offset` | `{ opacity, spread, offsetY }` of the outer shadow (1, 0, 10)                                                                                                                                                              |
| `interactive`              | `--liquid-interactive`                                                        | `"press"`, `"drag"` or `"none"`; by default `press` on buttons, links and `data-glass-interactive`. It inherits, except on the overlays (dialog, popover, sidebar, drawer), which read it only from their own inline style |
| `motion`                   | `--liquid-motion`                                                             | `"snappy"` (default), `"smooth"`, `"soft"`, `"jelly"` or `false` (`off`)                                                                                                                                                   |

`LiquidGlassOptions`, `LIQUID_DEFAULTS`, `LIQUID_PRESETS`, `liquidStyle()` and `liquidVars()` are exported from `@jcsoftdev/ui/glass`; `liquidStyle(options)` is the `style` object for your own surfaces (pair it with `useGlassLens`). The values are clamped to ranges the lens can honour.

**Presets.** `data-glass="liquid-clear"`, `"liquid-regular"` and `"liquid-thick"` switch the glass surfaces of a scope to the liquid look (like `data-glass="liquid"`) and set a bundle of the options above (`base.css` carries them; `LIQUID_PRESETS` is the same data). **Theme defaults** are plain CSS: `:root { --liquid-frost: 3px; --liquid-profile: dome; }` changes every liquid surface that does not set its own.

**Contrast.** The guarantees listed under Tokens hold for the defaults. A lower `opacity`, a `tint`, `grain` or a thinner `frost` can leave text without them; check the copy you put on a configured surface.

**Profiles and thickness.** Both whole-surface profiles pull each pixel towards the centre along the gradient of a radial coordinate (`full`: exponent 3, pull `A t^1.5`; `dome`: exponent 2, pull `A t^2`, with `t` the radial coordinate over its value at the corners), so neither has a crease along the diagonals, and both are tested not to fold. `refraction` and `bevelWidth` scale the filter, not the map, so changing them does not re-rasterise it. A bigger surface is thicker: its shadow grows with the size (`--liquid-size`, 0.7 to 1.5 times), and the lens offset grows with it up to the cap.

### Crystal: a thick, clear lens

`profile: "crystal"` (and the `crystal` preset, `data-glass="liquid-crystal"`) is the look of a thick convex piece of acrylic: the backdrop is **minified** (the surface shows a wider area than it covers, squeezed in), bent hard towards the rim, split into colour fringes at the edge, with no frost, no veil and no tint, only a thin bright edge.

```tsx
<Card material={{ type: "liquid", preset: "crystal" }} className="rounded-full px-8 py-4">
  <span className="font-bold text-white [text-shadow:0_2px_10px_rgb(0_0_0/.5)]">Liquid Glass</span>
</Card>
```

- `refraction` goes from 0 to 2 for this profile (the other profiles treat anything above 1 as 1). A minifying map `p -> p (1 + k s(t))` has a positive Jacobian for every `k`, so it cannot fold; the offset is capped at 260 px to bound the work.
- Minification samples outside the surface, which a filter on the surface cannot see. The engine therefore puts the filter on a layer inside the surface that extends past it by the largest offset and is clipped back to the silhouette (`data-glass-lens-layer`), and moves the surface's background and inset rim under/over it. Give the surface child elements (a `span` around the label), not a lone text node, and keep `overflow` visible on it.
- There is **no contrast guarantee**: use short, bold labels with a text shadow, and nothing small. The surface uses the same budgets (8 lenses, area) as the others; the filter region of one crystal is larger than its box.

### Motion

The lens engine drives its own springs (a damped spring written for the kit, no dependency) and a single `requestAnimationFrame` loop that sleeps when everything is at rest:

- **Materialise**: when a lens first appears its strength springs from 0 to its target instead of fading.
- **Press** (`interactive: "press"`, the default for buttons and links): the lens deepens by 35%, the surface swells by about 16 px over its width, a touch glow (a radial highlight at 15% opacity) follows the pointer and the rim light turns towards it.
- **Drag** (`interactive: "drag"`): the surface follows the pointer through a rubber band (at most 48 px), stretches along its speed and squashes across it by at most 20% with two deliberately mismatched springs, and settles back like jelly when released. A drag starts only on the surface itself (a press on a button, link or field inside it stays the child's) and takes the pointer once it has travelled 6 px. The click that ends a drag is swallowed (within about 350 ms, and only that gesture's). The motion is written to the individual `translate` and `scale` properties, composed with your own, so an author `transform` is never touched and your `translate` and `scale` are put back at rest.
- **`motion`** picks the spring (`snappy`, `smooth`, `soft`, `jelly`); `motion: false` (or `--liquid-motion: off`) turns all of it off and shows the lens at full strength at once.

Everything is off under `prefers-reduced-motion` (the lens is removed with it, as before) and wherever there is no lens (Safari, Firefox): the press flex of the CSS stays.

### Switching the whole app

Put `data-glass="liquid"` on `<html>` (or on any scope): `glass`, `glass-clear` and, in the `glass` preset, the chrome surfaces (`surface-overlay`, `surface-nav`, `surface-side`: Dialog, Drawer, menus, Topbar, Sidebar) render liquid. The content layer (`surface-card`) stays solid. Remove the attribute to go back to frosted. Limits: the switch is one-way down the tree (a nested `data-glass="frosted"` does not undo an outer `liquid`; use `material` on the component instead), and surfaces already mounted do not load the lens until they remount.

### The lens

Chromium only: it is the one engine that paints `backdrop-filter: url(#filter)`. Components with a glass `material` (Dialog, Drawer, Popover, DropdownMenu, ContextMenu, HoverCard, Topbar, Sidebar, ActionBar, Card) call `useGlassLens` internally. It looks at the `--glass-lens` flag that the liquid utilities set and, only then, imports the engine as a separate chunk; frosted and solid surfaces never load it, so tree-shaking and bundle size are untouched for them. It does nothing on import, is SSR-safe, and releases its filter on unmount.

The map is rasterised from the signed distance function of the rounded rectangle (size, radius and pixel ratio aware). Across a rim, the displacement follows a convex squircle height profile through Snell's law (n = 1.5): zero in the middle, strongest at the edge, pulling the content from just inside the shape. Full coverage is a dome over a superellipse radial coordinate (`r = (|u|^3 + |v|^3)^(1/3)`, `u` and `v` the position over the half size): each pixel is pulled towards the centre along the gradient of `r`, by `A (r / r_corner)^1.5`. The gradient is continuous everywhere, so there is no crease along the diagonals (a field built from the distance to the nearest edge, or from each axis alone, makes the glass read as a four-faced pyramid) and no seam at the centre; `A` is at most 0.55 of the smaller half size and 24 px. The offset at the silhouette (up to about 17 px) makes a backdrop shape that crosses the edge jump there, as in real glass. The first lenses (a Snell-law profile, strength equal to the bevel width) folded back on themselves where the offset fell faster than 1 px per px, which broke straight stripes into a repeating sawtooth along the walls; both profiles now keep the slope under 1, and a test checks it. The veil is adaptive: the lens is blurred wide, its luminance read, and a veil of the ink-contrasting colour is laid only where the backdrop is close to the ink, so over friendly backdrops the body stays clear. The directional specular layers are added on top. Dispersion is off by default (it paints a colour fringe on hard edges); turn it on with `--glass-lens-dispersion: .05` or the option, on surfaces up to 100,000 px squared, where it is naturally strongest at the rim because it scales with the local offset. When a lens is first applied the refraction springs up from nothing (the materialise), and on a pressed control it lifts to 1.35 times for the duration of the press (see Motion); neither runs under reduced motion, where there is no lens.

Budgets: at most 8 lenses alive at once, no lens on a surface over 640,000 px squared (they keep the plain liquid look), dispersion only up to 100,000 px squared, the map is rebuilt at most about ten times a second while a surface resizes (one coalesced pass per frame for all surfaces), and the last 16 maps (displacement and specular) are cached. Opt out with `data-glass-lens="off"` on the element or any ancestor, or `--glass-lens: 0` in CSS. It follows `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors` and `prefers-reduced-motion` live.

Other engines (Safari, Firefox) get the base liquid look without refraction: rim, thickness, saturation, outer shadow. Legibility is the same: the uniform CSS veil is used there. With the lens active the veil is lighter only along the rim (at most the outer 28px), so text placed on the rim of a surface over a black or white backdrop has less contrast than the guarantee below, which is measured away from it.

### Measured cost

Chromium headless with software compositing, device pixel ratio 2, unthrottled frame loop while a photo scrolls under the surface (so every frame re-renders the backdrop). These are relative numbers, not GPU numbers:

| Surface                                                        | Frame time  |
| -------------------------------------------------------------- | ----------- |
| No lens (frosted or liquid)                                    | 0.1 ms      |
| Nav bar 1280x56, lens + specular (dispersion off, the default) | about 6 ms  |
| Dialog 520x320, lens + specular (dispersion off, the default)  | about 16 ms |
| Either with dispersion on                                      | about 2x    |

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

Shared, per theme where light and dark differ: `liquid-regular-blur`, `liquid-clear-blur`, `liquid-saturate`, `liquid-regular-filter`, `liquid-clear-filter`, `liquid-regular-tint`, `liquid-regular-dim`, `liquid-clear-tint`, `liquid-clear-dim`, `liquid-rim`, `liquid-depth`, `liquid-depth-active`, `liquid-halo`, `liquid-shadow`, and the ones a configured surface scales: `liquid-rim-lit`, `liquid-rim-back`, `liquid-rim-ring`, `liquid-shadow-ink`, `liquid-shadow-alpha`. The two `*-filter` tokens are a reference: the utilities compose the same filter from the blur and saturate tokens and the per-surface options. Border, edge-less shadow and fallback reuse `glass-*`. Liquid glass trades veil for transparency, so its measured floors are lower than the frosted 4.8:1 and documented. Without the lens (the fallback, a uniform veil): regular keeps `text-ink` at 4.5:1 and `text-ink-2` at 3.5:1, clear keeps `text-ink` at 4.5:1 and `text-ink-2` at 2:1 over white, black, split and striped backdrops. With the lens (adaptive veil), over a smooth photo-like backdrop `text-ink` keeps 4.5:1 and `text-ink-2` 2:1 on every pixel; over hard fine stripes the worst pixel keeps 2:1 for `text-ink` and the text halo carries the glyphs. Use regular glass, or frosted, for small secondary copy. The halo is not counted in these numbers. The price is the same as for frosted: over a dark backdrop, light liquid glass is pale.

## Sources

- WWDC25 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/): lensing ("bends, shapes, and concentrates light"), specular highlights that respond to geometry, tint adapting to what is behind, Regular vs Clear, glass that "illuminates from within" on press, thicker glass with deeper shadows and stronger lensing.
- Apple Newsroom, [new software design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/): "reflects and refracts its surroundings", specular highlights.
- [liquidglass.dev](https://liquidglass.dev) (gentpan/liquidglass, MIT): ideas for the rim-band bevel, the spring constants of the press, follow and settle motion and the velocity stretch; the code here is our own. The parameter set of the options mirrors what ybouane's liquid-glass playground exposes (names only, no code or constants).
- Apple HIG [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) is JavaScript-rendered and could not be read automatically.
- kube.io, [Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg/): Snell's law, squircle height profile, displacement map encoding, Chromium-only `backdrop-filter: url()`. Dispersion by per-channel displacement is a common technique that is not described there; the implementation here is our own.
