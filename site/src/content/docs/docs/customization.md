---
title: Customization
description: Make every component your own - CSS variable overrides, classNames per part, variant maps, createCn / extendCn for custom tokens and headless primitives for full control.
section: Theming
---

The kit does not force its look. Pick the lowest level that gets you what you want; each level below is more work and gives more control.

1. **Variables**: remap tokens with CSS custom properties. No component code changes.
2. **`classNames` per part**: restyle one element of a component.
3. **Variant maps**: reuse or extend the classes behind `variant`, `tone` and `size`.
4. **Headless primitives**: keep the behavior and accessibility, write all the markup and styles yourself.

## 1. Override CSS variables

Components only read semantic tokens (`bg`, `surface`, `ink`, `accent`, `--radius-card`, `--control-height`, ...). Override them on any element and its subtree follows, in light and dark:

```css
/* app/globals.css, after the kit imports */
:root {
  --accent: #6d28d9;
  --radius-card: 6px;
  --font-sans: "Inter", system-ui, sans-serif;
}

/* a different value in dark mode (follows prefers-color-scheme and [data-theme]) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --accent: #a78bfa;
  }
}
:root[data-theme="dark"] {
  --accent: #a78bfa;
}
```

Density and touch sizing work the same way. `data-density="touch"` (or `compact`, `comfortable`, or `auto` to follow the pointer type) rescales `--control-height`, `--input-height` and the paddings.

Specificity matters: the kit sets density, accent and style values on attribute selectors such as `:root[data-density="touch"]`, which beat a plain `:root` or `[data-density="touch"]` rule. Match the kit's selector (or higher) and load your CSS after the kit's:

```css
/* loaded after the kit's styles */
:root[data-density="touch"] {
  --control-height: 48px;
}
```

Two caveats:

- **`data-accent`**: when an `<html data-accent="menta">` (or any accent preset) is set, the preset's `:root[data-accent="menta"]` rule beats a plain `:root { --accent }`. Override with the same selector (`:root[data-accent="menta"] { --accent: ... }`) or drop the attribute and use your own value only.
- **`data-style` presets** set `--radius-*` through `--radius-*-override` variables. To change a radius under a preset, set the override, for example `:root[data-style] { --radius-card-override: 6px; }`; a plain `--radius-card` is replaced by the preset.

For a whole new look, copy `tokens/default.json`, edit it and run `npx ui-theme build my-tokens.json --out src/theme`. See [Theming and presets](/docs/theming/) for presets, precedence and the token file shape.

### Font sizes

Dense UI text uses a size-only scale: `text-fs-95`, `text-fs-100`, `text-fs-105`, `text-fs-110`, `text-fs-115`, `text-fs-120`, `text-fs-125`, `text-fs-130`, `text-fs-140`, `text-fs-150`, `text-fs-160`, `text-fs-220`, `text-fs-300`, `text-fs-440` (the number is the pixel size times 10). They set `font-size` only, so weight and line height stay with the component. Redefine them in your own `@theme` block to rescale every component:

```css
@theme inline {
  --text-fs-120: 13px;
}
```

## 2. `classNames` per part

Components made of more than one styled element accept the same two props:

- `className` targets the **root** element, as before. It is merged last, so it beats `classNames.root` on a conflicting utility (order: kit < `classNames.root` < `className`).
- `classNames={{ part: "..." }}` targets any other part. The part names are exported as a type per component (`ToasterPart`, `DialogContentPart`, `FieldPart`, ...), so your editor completes them.

Classes are merged with `cn`, so on a conflicting utility **yours wins** over the kit's (`classNames.<part>` beats the kit; `className` beats `classNames.root`):

```tsx
<Switch
  classNames={{
    track: "bg-slate-300 group-data-[state=checked]:bg-emerald-500",
    thumb: "rounded-md",
  }}
/>

<Banner tone="warning" title="Heads up" classNames={{ title: "uppercase tracking-wide" }}>
  ...
</Banner>
```

Rules that hold across the kit:

- Single-part components forward `className`, the rest of the DOM props and the `ref`.
- Compound components (`Card`, `CardHeader`, `Tabs`, `TabsTrigger`, `DropdownMenuItem`, ...) take `className` on each piece instead of a `classNames` object.
- Portaled parts (dialog scrim, close button, toast list) are reached through `classNames` too, since they live outside the root.
- `slideClassName` on `Carousel` (from earlier releases) still sets the default slide width, and `classNames.slide` adds to it. `DialogContent` and `DrawerContent` use `classNames.overlay` and `classNames.close`; `className` targets the content element (`classNames.root`).

### Part names

The same part keeps the same name across components:

| Part               | Meaning                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `root`             | The outermost element, the same node `className` targets (for `DialogContent` and `DrawerContent`, the content panel) |
| `title`            | Heading text (`Banner`, `Toaster`, `Dropzone`, `FloatingToc` ...)                                                     |
| `description`      | Secondary text below a title                                                                                          |
| `label`            | Short text beside a control or marker                                                                                 |
| `icon`             | A leading or decorative icon                                                                                          |
| `dot`              | The coloured dot (`Led`, `StatusDot`, `StatusPill`)                                                                   |
| `header`           | The clickable header row of `ToolCall`, or the heading row of `CodeBlock`                                             |
| `body`             | The content area                                                                                                      |
| `overlay`, `close` | Scrim and close button of overlays                                                                                    |
| `action`           | An action slot                                                                                                        |

`Command.Group` headings are rendered by the primitive; style them from the group with a child selector, for example `classNames={{ group: "[&_[data-ui-command-group-heading]]:uppercase" }}` on `CommandPalette`.

## 3. Variant maps

The classes behind a variant are plain exported objects, so you can read them, extend them or reuse them on other elements:

```tsx
import { Button, buttonClasses, buttonVariantClasses } from "@jcsoftdev/ui/atoms/button";

// the kit's look on a router link, without wrapping it in <Button>
<Link className={buttonClasses({ variant: "primary", size: "sm" })} to="/new">
  New
</Link>;

// a custom variant next to the built-in ones
const variants = {
  ...buttonVariantClasses,
  brand: "bg-fuchsia-600 text-white hover:bg-fuchsia-700",
};
<Button className={variants.brand}>Brand</Button>;
```

Also exported: `buttonSizeClasses`, `chipToneClasses` (Chip), `eventToneClasses` (EventBlock), `dayChipToneClasses` (DayChip). For any other `variant` or `tone` you can always pass `className`: it is merged last, so it overrides the variant's classes. The maps are typed `Readonly<Record<...>>`; spread them into a new object to extend them.

## 4. Custom tokens in your own class merging

`cn` knows the kit's theme tokens (`text-meta`, `h-control`, `rounded-card`, ...). If you add your own, create an instance that knows them too, so `text-hero` and `text-lg` conflict instead of both being kept:

```ts
import { createCn, extendCn, cn as kitCn } from "@jcsoftdev/ui/utils";

export const cn = createCn({
  theme: { text: ["hero"], spacing: ["gutter"], radius: ["blob"], shadow: ["glow"] },
});

// or start from the kit's configuration
export const cn2 = extendCn(kitCn, { theme: { text: ["hero"] } });
```

Use that instance in your own components and wrappers. The kit's internal merge always uses the default `cn`; a custom-token class you pass through `className` or `classNames` still applies, but is not de-duplicated against the kit's own class for the same property. When that matters, override the CSS variable (level 1) instead.

## 5. Headless primitives

When classes are not enough, build on the same behavior without the kit's markup: focus management, dismissal, roving focus, positioning and ARIA are in the unstyled primitives (dialog, popover, menu, command and more) that the styled components are made of. They are published under `@jcsoftdev/ui/primitives`; see [Headless primitives](/docs/primitives) for the full list, a minimal unstyled example of each, data attributes and CSS variables.
