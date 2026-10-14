# Writing a chart element

How a `ui-*` chart (bar, line, donut, ...) is built on the shared chart base. Read
`contributing-elements.md` first: the folder layout, CSS rules, size budgets and tests apply here
too. This page covers what is specific to charts.

Charts are **light-DOM SVG composites**. A chart element extends `ChartElement`
(`src/internal/chart-base.ts`), implements one method, `draw()`, and gets sizing, states,
accessibility, hover and keyboard from the base. Legend, tooltip, data table, export and breadcrumb
are **separate opt-in elements** that bind to the chart through a small protocol. A chart never
imports them, so it never pays for them.

## The pieces

| File | Role | Loaded |
| --- | --- | --- |
| `internal/chart-base.ts` (+ `.css`) | `ChartElement`, the draw contract, hover/selection fields, sizing | eager, by every chart |
| `internal/chart-protocol.ts` | types, event names, `bindChart()`; no DOM code of its own | the base and every part |
| `internal/chart-dom.ts` | `svg()`, `join()`, `swatch()`, `SR_ONLY` | the base and the parts |
| `internal/chart-hit.ts` | `nearestX()`, `nearestPoint()`: snapping helpers for `hit` | only by charts that import it |
| `internal/chart-interact.ts` (+ `.css`) | pointer, touch, keyboard, hover/selection state, live region, series toggles | lazy, on first `focusin` or `pointerenter` |
| `internal/chart-state.ts` (+ `.css`) | the loading and empty screens | lazy, on first use |
| `internal/chart-table.ts` | `renderTable()` and the screen-reader table | lazy, after the first draw |
| `ui-core/chart/format` | `resolveFormat()` for `context.format` | lazy `import()` with the first draw (free if the chart imports it for its axes) |
| `internal/chart-export.ts` | SVG/PNG/CSV/XLSX writers | only by `ui-chart-export-menu`, via `import()` |

| Tag | What it is | Eager gzip |
| --- | --- | --- |
| `ui-chart-frame` | the base as an element, with a `render(ctx)` property | 4.9 KB |
| `ui-sparkline` | the smallest real chart on the base | 6.7 KB |
| `ui-chart-legend` | toggle buttons per series, hover dims the rest | 2.6 KB |
| `ui-chart-tooltip` | floating card or docked panel | 4.2 KB |
| `ui-chart-data-table` | the snapshot as a real `<table>` | 1.8 KB |
| `ui-chart-export-menu` | menu button (ui-core `menu`); SVG, PNG, CSV, XLSX | 6.7 KB |
| `ui-chart-breadcrumb` | drill-down path, `nav` with `aria-current` | 1.5 KB |

A chart adds only its own geometry and the ui-core modules it uses (`chart/scale`, `chart/path`,
`chart/axis`...). Anything optional is a part or a lazy `import()`. Never import a part from a
chart, and never import another chart's entry (the tree-shake check fails the build). Share code
through `internal/`.

## A chart in one screen

```ts
import { bandScale } from "@jcsoftdev/ui-core/chart/scale";
import { type DefineOptions, defineElement } from "../internal/base.js";
import { CHART_ATTRIBUTES, ChartElement, type DrawContext, type DrawResult, svg } from "../internal/chart-base.js";

export class UiBar extends ChartElement {
  static override observedAttributes = [...CHART_ATTRIBUTES, "horizontal"]; // always extend
  #data: readonly { name: string; value: number }[] = [];
  get data() { return this.#data; }
  set data(value) { this.#data = value; this.requestDraw(); }

  protected override isEmpty() { return this.#data.length === 0; }

  protected override draw({ svg: root, width, height, format, color, animate }: DrawContext): DrawResult {
    const band = bandScale({ count: this.#data.length, range: [0, width] });
    const marks = this.#data.map((d, i) => {
      // ... append the visible bars to `root`, animating only when `animate` is true ...
      const el = svg("rect", { x: band.start(i), y: 0, width: band.step, height, fill: "transparent" });
      root.append(el); // a full-band hit area, also the keyboard target
      return { el, label: `${d.name}: ${format(d.value)}` };
    });
    return {
      summary: "...",                         // one sentence for screen readers
      marks,                                  // one focusable mark per category
      hit: (x) => band.indexAt(x),            // pixel to mark index; this is all the pointer needs
      hover: (i) => ({ title: this.#data[i].name, rows: [/* TooltipRow */], x: band.center(i), y: 0 }),
      snapshot: () => ({ title: "...", categoryHeader: "...", categories: [...], series: [...] }),
    };
  }
}
export const defineBar = (options?: DefineOptions) => defineElement("bar", UiBar, options);
```

**A chart implements two functions for input, `hit` and `hover`, and nothing else.** Pointer,
touch, keyboard, selection, the tooltip and the docked panel all run on those two. Do not add
`pointerenter`, `click` or `touchstart` listeners to marks.

## The draw contract

`draw(context)` returns a `DrawResult`; every field is optional.

### Phases and `previous`

`context.phase` says why the draw runs:

- `"enter"`: the first draw, and the first after a loading or empty state. The SVG is empty. Play the
  entry animation (`context.animate` is true only here, with motion allowed and no `animate="off"`).
- `"update"`: new data (`requestDraw()`, a data attribute, a legend toggle), or a transient frame
  (below). No entry animation. A chart that wants to morph reads `context.previous`, the
  `DrawResult` of the last draw, to reuse its scales.
- `"resize"`: only the size changed. Redraw to the new size; do not animate and do not touch data.

Hover and focus survive every phase (see below), so a draw never has to restore them.

### Motion, hover and transient frames

- `context.motion` is false when the user prefers reduced motion or the chart has `animate="off"`.
  `animate` is the entry animation (phase `enter` and `motion`); `motion` is for **data-to-data
  transitions**: tween from `previous` only when it is true, otherwise jump.
- `context.hover` is the index of the mark whose details are shown (hovered, keyboard-focused or
  pinned), or `null`. A chart that redraws from scratch draws its crosshair or highlight from it, so
  it survives a non-retained redraw.
- `requestDraw("transient")` is for frames that change how the chart looks but not what it says: a
  tween, a pan, a brush in progress. It skips the snapshot (no new revision, so `chartSnapshot` stays
  cached), the table sync and the `chart-data` event; `context.transient` is true and the phase is
  `"update"`. Calls in the same frame run once, and a normal `requestDraw()` in that frame still
  emits one `chart-data`. Thirty transient frames emit zero `chart-data` events. Use `requestDraw("size")`
  to re-lay out without touching data.

### Retained rendering and `join()`

By default the SVG is cleared before every draw and you rebuild it. That is simple and fine up to a
few hundred marks. For more, opt in with
`static override retain = true` or `context.retain()`: from then on the SVG is **not** cleared after
`enter`, and you reconcile with the keyed `join`:

```ts
import { join, svg } from "../internal/chart-base.js";

join(
  group,                                   // an element only this join writes to
  rows,                                    // the items, in drawing order
  (row) => row.id,                         // key: the same key keeps the same element
  () => svg("circle", { r: 2 }),           // enter: build once
  (el, row, i) => el.setAttribute("cx", `${x(i)}`), // update: runs for new and kept elements
  (el) => el.remove(),                     // exit (optional; this is the default)
);
```

`join` also keeps the elements in item order and returns them. Use it for the marks and put them in
`marks` as usual; a mark that is kept keeps its focus and its `data-active` flag. Measured with 10k
circles on a data redraw (median of 5 frames, layout and paint included): see the E16 pull request.

Keys must be unique. An item whose key repeats an earlier one gets no element of its own (it maps to
the first one, so nothing leaks) and `join()` logs one warning per parent.

### Thousands of marks: the canvas layer

Above roughly 5k marks, SVG nodes cost more than they are worth. Draw them on a canvas instead:

```ts
const g = context.canvas();          // a 2D context the size of the drawing, under the SVG
g.fillStyle = context.color(0);
for (const p of points) g.fillRect(p.x, p.y, 2, 2);
```

`canvas()` creates the `<canvas>` on first use, sets the bitmap to the device pixel ratio, scales the
context, clears it, and removes the layer in any draw that does not call it. It also redraws when the
device pixel ratio changes (a window dragged to another screen, browser zoom), so the layer stays
sharp. The SVG stays on top for
axes and hit areas. A canvas is invisible to assistive tech, so name the marks with **virtual
marks**:

```ts
marks: {
  count: points.length,
  label: (i) => `${points[i].name}: ${format(points[i].value)}`,
  element: (i) => highlightCircle(i),  // optional: an SVG element to flag with data-active
}
```

Virtual marks get one focus target, a hidden `role="listbox"` proxy, whose `aria-activedescendant`
points at a single `role="option"` rendered for the current mark (`aria-posinset`, `aria-setsize`).
Arrow keys, Home and End move it with no per-mark element, and hover, the tooltip and `select()`
work as for real marks. PNG export paints the canvas layer under the SVG.

### Snapshot

`snapshot` should be a function. The base calls it the first time something reads
`chart.chartSnapshot` after a data change, caches it for that revision and never computes it for a
resize. Reading it twice runs your function once. The screen-reader table asks for it a quarter of a
second after the data last changed, so a stream of updates builds it once. The `chart-data` event
carries `{ revision }` (or `null` for the loading and empty states).

## What the base gives you

- **Sizing.** A `ResizeObserver` on the drawing box. `height` is a number (default 240), or `fill` to
  take the parent's definite height (minimum 120). `aspect-ratio` wins over a pixel height. The SVG
  is absolutely positioned, so drawing can never grow the box (no resize loop).
- **Intrinsic height.** A chart that cannot use 240px sizes itself through the base, never by
  touching the host. Either set `static override defaultHeight = 320` (or
  `(el) => el.getAttribute("orientation") === "horizontal" ? 200 : 320`, read on every draw, so an
  attribute change re-evaluates it) or return `naturalHeight` from `draw()` when the content decides
  (rows, tree depth). The base applies it to the inner drawing part and, for `naturalHeight`, redraws
  once to the new size (at most twice in a row, so it cannot loop). An explicit `height`,
  `height="fill"` (use it with a CSS height on the host) or `aspect-ratio` always wins.
  **Never write attributes (or inline styles) on the host, in `connectedCallback` or anywhere
  else; use the hook.** Writing `height` there mutates the consumer's DOM and fights their own value.
- **Theme.** The base watches the theme and redraws every chart as an `update` (with
  `context.transient` true, so no `chart-data`). Sources: `data-theme`, `class` and `style` on
  `<html>` and on the nearest `[data-theme]` ancestor, and `prefers-color-scheme`. One shared
  `MutationObserver` and one media listener serve all charts (ref-counted, released on
  disconnect). `context.themeVersion` is a counter that moves on each change: a painter that caches
  resolved colors (a canvas cannot use `var()`) drops its cache when it differs from the last
  draw. SVG marks that use CSS variables need nothing.
- **States.** `loading` (with `skeleton="bars|line|ring"`) and `empty` (or `isEmpty()`) replace the
  drawing; `draw()` is not called and `chart-data` fires with `null`. The code and stylesheet are a
  lazy chunk. The SVG object is kept, so `setup()` does not run again afterwards. If a mark had
  focus, focus moves to the drawing frame, not to the page.
- **Theming.** Colors are CSS variables. Use `context.color(i)` (the `palette` property or
  attribute, else the `--chart-cat-*` tokens) and write them through `style` or `fill`.
- **Locale, time zone and currency.** Attributes `locale` and `time-zone`; `locale` falls back to the
  closest `[lang]`, then the browser. `context.format` is ui-core's `resolveFormat` bound to them
  (`value-format` and `currency` pick the preset). **The `currency` preset has no default currency:
  set the `currency` attribute (ISO 4217, e.g. `USD`). Without it values show as plain numbers and a
  warning is logged once outside production.** For dates use ui-core's `formatDate`,
  `shortMonth`... with `{ locale: context.locale, timeZone: context.timeZone }`, or pass them to
  `category-axis-time` and `scale-time`. Never write a locale into a chart; the ui-core default
  (`es-PE`) must never be reached.
- **Reduced motion.** Gate every `element.animate()` on `context.animate`. CSS transitions need a
  `prefers-reduced-motion: reduce` override.
- **Accessible name and description.** The SVG is `role="group"` (or `img` without marks) named by
  `label` (or `DrawResult.label`, or `labels.chart`, "Chart"), with `aria-roledescription` from
  `labels.roledescription` ("chart"), described by `description` or `summary`. Mark purely visual
  elements `aria-hidden="true"`; marks get `role="img"` and their `label`. Both strings are in
  `chart.labels`, so a Spanish page sets `{ chart: "Gráfico", roledescription: "gráfico" }`.
- **Screen-reader table.** From `snapshot`, lazily, unless a `ui-chart-data-table` is present or
  `table="off"`. At most 500 rows, then a row "N more rows; use export to get them all"
  (`labels.more`). It is rebuilt only when the snapshot changed.
- **`setup(svg, signal)` / `teardown()`.** `setup` runs once per connection, when the SVG exists the
  first time; add listeners with `{ signal }` and they are gone on disconnect. Redraws, states and
  resizes never call it again, so listeners cannot pile up.
- **`touch-action`.** `static touchAction = "pan-y"` (the default: the page still scrolls
  vertically). Set it to `"none"` for a chart that pans or zooms by touch, or give the element a
  `touch-action` attribute.

## Pointer, touch and keyboard

All input lives in a lazy chunk, fetched on the first `focusin` or `pointerenter`. The events that
arrive while it loads are queued and replayed, so the first Tab or tap works.

- **Hit testing.** One listener on the drawing calls `hit(x, y, target, radius)`. `x` and `y` are
  in drawing units, already corrected for CSS zoom or transforms (`svg.width / box.width`), `target`
  is the element under the pointer, and `radius` is how far a pointer may miss: 12px for a mouse and
  the `--touch-target` token (44px in touch density; 44px if the token is 0) for a finger or pen.
  Return a mark index, or -1. Bars use the band (`band.indexAt(x)`); line and scatter charts snap
  with `nearestX(points, x)` (nearest column) or `nearestPoint(points, x, y, radius)` (nearest point
  within the radius) from `internal/chart-hit.ts`, so a 2px line is easy to hit.
- **Gesture arbitration.** The chart's own gesture code (a brush, a pan, a drag, a draw-to-select)
  wins over selection. The base ignores `pointerdown`, `pointerup`, `click`, `dblclick` and
  `keydown` when `event.defaultPrevented` is set, and a mouse or touch press whose `pointerdown` or
  `pointerup` was prevented never becomes a selection, a drill or the click that follows it. So call
  `preventDefault()` in a listener on the SVG (added in `setup()`, which runs on the SVG before the
  base's listener on the drawing) for the events your gesture owns. The pointer, touch and keyboard
  paths all honor it.
- **Hover** (mouse, and a pen in range). `chart-hover` fires once per change of mark or content,
  never per pixel. A redraw keeps the hovered mark: the base re-runs `hit`/`hover` at the last
  pointer position, with the element under it (`elementFromPoint`, in the chart's own root) as the
  `target` and the pointer's own radius, and emits only if the mark or its content changed. No
  leave/enter pair. A chart whose `hit` reads the target (a map, a treemap, a Sankey) keeps its
  tooltip across a redraw.
- **Touch and pen taps pin a mark.** A tap selects the mark under the finger and its details stay
  shown. Tapping the same mark again, tapping outside the chart or pressing Escape clears it; tapping
  another mark moves the pin. A swipe never selects: the drawing is `touch-action: pan-y`, and a
  press that moves more than 10px or is cancelled by the browser is not a tap. Touch never
  hovers.
- **Selection.** `chart.select(index | null)` (the first call loads the chunk, so it settles a moment
  later), `chart.selected`, the `chart-select` event (`{ index, category } | null`) and
  `[data-selected]` on the mark. A mouse click, Enter and Space toggle it; the pinned mark keeps
  `[data-active]` and its details while pinned. A **polite live region** announces the pinned mark
  once per change (`Wed, Sales 1,500`). Selection is by mark index and is dropped if that mark no
  longer exists.
- **Drill-down.** `chart.drill(index)`, double click and Shift+Enter fire `chart-drill`
  (`{ index, category }`). The chart (or the app) decides what drilling means.
- **Mark index and category index.** `hit`, `hover`, `marks` and the events use the **mark index**
  (what you `hit`). When marks are not categories (a stacked or grouped bar has several marks per
  category), return `category` in `hover` and the events and `HoverInfo` carry both.
- **Keyboard.** `marks` become a roving tab stop: one Tab stop, arrows/Home/End move without
  wrapping, focus shows the details (`:focus-visible` only), Escape clears the hover and then the
  selection. Enter and Space toggle the selection; Shift+Enter drills.
- **2D and hierarchical keyboard navigation.** Without more, the arrows walk the marks in reading
  order. Return `nav(index, intent)` from `draw()` for a grid, a treemap or a tree, with `intent` one
  of `left`, `right`, `up`, `down` (`left` and `right` are swapped in a right-to-left page), `home`,
  `end`, `parent` (Backspace) and `child` (sent after Shift+Enter fires `chart-drill`). Return the
  mark to go to; returning the same index, `-1` or `undefined` stays. It is only a lookup on your
  data, so it works for virtual marks too. `nav` receives every arrow, Home and End key once it
  exists, so handle all of them.
- **Redraw and the keyboard.** Focus and the hovered mark survive a redraw; the base re-focuses the same index silently
  (nothing is re-announced) and keeps focus in the chart when the focused mark disappears.
  Highlight the active mark with `[data-active]` and the pinned one with `[data-selected]`; dim by
  `data-series`.

## The protocol with the parts

A part finds its chart with `for="id"` or the closest ancestor chart, through `bindChart()` (parts
and charts can be defined in any order). `bindChart` keeps listening for `chart-ready`, so when the
chart is replaced (a new element with the same id, a part moved under another chart) the part
detaches from the old one and attaches to the new one. Limit: the lookup stays in the part's own
root, so a part inside a shadow root cannot reach a chart outside it, and the reverse. The chart
publishes:

- `chart.chartSnapshot` (legend, data table, export), `chart-data` after a redraw for new data, not
  after a resize or a transient frame;
- `chart-hover` with a `HoverInfo | null`: `{ index, category, x, y, title, rows, body?, side?,
  source, pinned }`, with `x`/`y` relative to `chart.drawing`. `source` is `pointer`, `keyboard` or
  `touch`; `pinned` is true when it is the selected mark rather than a transient hover;
- `chart-select`, `chart-drill`, and `chart-series` when `toggleSeries(id)` or `highlight(id)`
  changes. Your `draw()` must skip `this.isHidden(series.id)` series and set `data-series="<id>"` on
  a series' marks to be dimmed.

A new part follows the same rules: import `chart-protocol` only, never the base.

### Legend items, columns and scales

The snapshot separates what the **table and export** list from what the **legend** toggles:

- `series` are the columns of the data table, CSV and XLSX.
- `legend?: { id, name, color, shape? }[]` are the legend items. Omit it and the legend lists one item
  per series. Use it when the toggles are not columns: the slices of a donut, the categories of a map.
  `toggleSeries(id)`, `isHidden(id)`, `chart-series` and the "last visible item stays" rule are keyed
  by the legend ids; the table and CSV are unchanged.
- `scale?: { min, max, colors, stops?, format?, label? }` is a continuous scale (a heatmap, a
  choropleth). `ui-chart-legend` then draws a gradient bar between the formatted `min` and `max`
  (`colors` evenly spaced, or at `stops`, 0 to 1), named `label: min to max` for assistive tech,
  instead of items. The drawing code is a lazy chunk.

### The tooltip: floating or docked

`ui-chart-tooltip` binds to the chart it sits in or the one `for` names, and **does not move itself
into the chart**: it can live anywhere. Two layouts, chosen by the chart's width and the pointer:

- **Floating** (a wide chart, fine pointer): a manual popover in the top layer, placed in viewport
  coordinates from the drawing's box, so no `overflow` ancestor can clip it. It never takes the
  pointer and stays inside the drawing. It follows the chart: scrolling the page or any scroll
  container, or a visual viewport change (pinch zoom, the mobile keyboard), re-places it, at most once
  per frame and without sliding; it hides (`data-offscreen`) while the chart is out of view.
  `HoverContent.side` is `left`, `right`, `top` or `bottom`, flipped when there is no room. This code
  is a lazy chunk loaded the first time the card floats.
- **Docked** (the chart is at most 480px wide, or the primary pointer is coarse, or `dock="always"`):
  a full-width panel in the flow under the drawing, at least 14px text, a pinned
  mark keeps it open. Its height is reserved so showing it moves nothing: publish
  `DrawResult.maxHoverRows` (the most rows `hover()` ever returns) and the panel is exactly tall
  enough for that many (it scrolls if a body or an emphasis row needs more); without it the panel
  has a 6.5em minimum and may grow. A finger
  never covers it because it is outside the drawing.

### Export

The export menu serializes a clone of the SVG: interactive wiring (`tabindex`, `role`, `aria-*`) is
stripped, the paint is baked in without the selection, hover and dim state (`data-selected`,
`data-active`, `data-dim`), and the background comes from the chart's own container (the first opaque
ancestor background, else white). What a standalone file cannot load is left out: external `<image>`
and `<use href>` elements, CSS `url()` to anything but a data URL or a fragment (the value becomes
`none`; `url(#gradient)` stays), and `javascript:` links. Each is listed once in the `export`
event's `detail.dropped` (never an empty string) and warned in the console. CSV quotes any field containing `,` `;` `"` CR LF or tab, and neutralizes text that starts
like a formula (`=`, `+`, `-`, `@`) with a leading `'`, except plain numeric strings such as `-5`.

## Tests

Add a few browser tests in the style of `test/chart-base.browser.test.ts`, which drives tiny fixture
charts (`test/chart-fixture.ts`):

- the AX tree: `ax("group", label)`, `ax("image", mark label)` (Chromium names SVG `role="img"`
  `image`);
- the keyboard: one tab stop, arrows, Home/End, Escape; the interaction chunk loads on the first
  focus, so allow a beat (`await wait(80)`) after the first Tab;
- touch: dispatch `pointerdown`/`pointerup` with `pointerType: "touch"` for a tap, with a `pointermove`
  past 10px for a swipe;
- the tooltip does not flicker: dispatch a `pointermove` sweep, assert one `chart-hover` per mark in
  order, one open/close toggle, the card inside the drawing and not under the pointer. Park the real
  mouse in a corner in `beforeEach`, or the browser hovers your chart with the last test's position;
- locale: `locale="de-DE"` changes the text; nothing is `es-PE`.

Golden values for any geometry belong in ui-core, next to the math.
