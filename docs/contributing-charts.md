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

| File | Role | Imported by |
| --- | --- | --- |
| `internal/chart-base.ts` (+ `.css`) | `ChartElement`, `svg()`, the draw contract | every chart element |
| `internal/chart-protocol.ts` | types, event names, `bindChart()`; no DOM code of its own | the base and every part |
| `internal/chart-dom.ts` | `svg()` builder, `swatch()` | the base, legend, tooltip |
| `internal/chart-table.ts` | `renderTable()` | data table, and lazily by the base |
| `internal/chart-export.ts` | SVG/PNG/CSV/XLSX writers | only by `ui-chart-export-menu`, via `import()` |

| Tag | What it is | Eager gzip |
| --- | --- | --- |
| `ui-chart-frame` | the base as an element, with a `render(ctx)` property | 5.0 KB |
| `ui-sparkline` | the smallest real chart on the base | 8.0 KB |
| `ui-chart-legend` | toggle buttons per series, hover dims the rest | 2.3 KB |
| `ui-chart-tooltip` | hover card, `computePlacement`, `pointer-events: none` | 3.3 KB |
| `ui-chart-data-table` | the snapshot as a real `<table>` | 1.4 KB |
| `ui-chart-export-menu` | menu button (ui-core `menu`); SVG, PNG, CSV, XLSX | 6.4 KB |
| `ui-chart-breadcrumb` | drill-down path, `nav` with `aria-current` | 1.5 KB |

The base itself is about 5 KB gzip: the shell (sizing, states, a11y, hover, keyboard), its CSS, and
ui-core `chart/format`, `chart/palette` and `roving`. A chart adds only its own geometry and the
ui-core modules it uses (`chart/scale`, `chart/path`, `chart/axis`...). Expect a chart to land
between 7 and 12 KB. Anything optional is a part or a lazy `import()`:

- the screen-reader table is built by a lazy chunk (`chart-table`, 0.3 KB) after the first draw;
- the export writers load on the first export, the XLSX writer only when XLSX is chosen;
- never import a part from a chart, and never import another chart's entry (the tree-shake check
  fails the build). Share code through `internal/`.

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

  protected override draw({ svg: root, width, height, format, color }: DrawContext): DrawResult {
    const band = bandScale({ count: this.#data.length, range: [0, width] });
    const marks = this.#data.map((d, i) => {
      // ... append the visible bars to `root` ...
      const el = svg("rect", { x: band.start(i), y: 0, width: band.step, height, fill: "transparent" });
      root.append(el); // a full-band hit area, also the keyboard target
      return { el, label: `${d.name}: ${format(d.value)}` };
    });
    return {
      summary: "...",                      // one sentence for screen readers
      marks,                               // one focusable mark per category
      hit: (x) => band.indexAt(x),         // pixel to mark index; must have no gaps
      hover: (i) => ({ title: this.#data[i].name, rows: [/* TooltipRow */], x: band.center(i), y: 0 }),
      snapshot: () => ({ title: "...", categoryHeader: "...", categories: [...], series: [...] }),
    };
  }
}
export const defineBar = (options?: DefineOptions) => defineElement("bar", UiBar, options);
```

`draw()` receives an empty `<svg>` already sized to the drawing area and returns what the opt-in
parts and the keyboard need. All fields of the result are optional.

## What the base gives you

- **Sizing.** A `ResizeObserver` on the drawing box. `height` is a number (default 240), or `fill` to
  take the parent's definite height (minimum 120). `aspect-ratio` wins over a pixel height. The
  SVG is absolutely positioned inside the box, so drawing can never grow the box (no resize loop).
  A resize redraws with `context.animate === false`.
- **States.** `loading` (with `skeleton="bars|line|ring"`) and `empty` (or `isEmpty()`) replace the
  drawing; `draw()` is not called. Text comes from `labels`.
- **Theming.** Colors are CSS variables. Use `context.color(i)` (the `palette` property or
  attribute, else the `--chart-cat-*` tokens) and write them through `style` or `fill`, as
  `var()` references. CSS lives in your element's own `.css`, from tokens only.
- **Locale and time zone** (as in ui-core C6a). Attributes `locale` and `time-zone`; `locale`
  falls back to the closest `[lang]`, then the browser. `context.format` is `resolveFormat` bound
  to them (`value-format` and `currency` pick the preset). Use `this.formatDate(date)` for dates, or
  pass `context.locale` / `context.timeZone` to ui-core's `category-axis-time` and `scale-time`.
  Never write a locale into a chart; the ui-core default (`es-PE`) must never be reached.
- **Reduced motion.** `context.animate` is true only for a data change, with motion allowed and no
  `animate="off"`. Gate every `element.animate()` on it. Transitions in CSS need a
  `prefers-reduced-motion: reduce` override.
- **Accessible name and description.** The SVG is `role="group"` (or `img` when there are no marks)
  named by `label`, described by `description` or `summary`. Mark every purely visual element
  `aria-hidden="true"`; marks get `role="img"` and their `label`.
- **Screen-reader table.** From `snapshot`, built lazily, unless a `ui-chart-data-table` is present
  (it takes over) or `table="off"`.
- **Pointer.** One `pointermove` listener on the drawing calls `hit(x, y)`. There are no per-mark
  `pointerenter`/`pointerleave` listeners, so gaps between marks cannot cause enter/leave loops.
  `hit` must cover the whole drawing (nearest category), never return `-1` between marks. The
  `chart-hover` event fires once per index change, not per pixel. Touch keeps the hover until the
  next press elsewhere.
- **Keyboard.** `marks` become a roving tab stop: one Tab stop, arrows/Home/End move without
  wrapping, focus shows the tooltip (`:focus-visible` only), Escape dismisses it. Focus survives a
  redraw by index. Highlight the active mark with `[data-active]`; dim by `data-series`.

## The protocol with the parts

A part finds its chart with `for="id"` or the closest ancestor chart, through `bindChart()` (parts
and charts can be defined in any order). The chart publishes:

- `chart.chartSnapshot` (legend, data table, export), emitted as `chart-data` after a redraw for new
  data, not after a resize;
- `chart-hover` with a `HoverInfo | null`: `{ index, x, y, title, rows, body?, side?, source }`,
  with `x`/`y` relative to `chart.drawing`;
- `chart-series` when `toggleSeries(id)` or `highlight(id)` changes. Your `draw()` must skip
  `this.isHidden(series.id)` series and set `data-series="<id>"` on a series' marks to be dimmed.

A new part follows the same rules: import `chart-protocol` only, never the base.

## Tests

Add a few browser tests in the style of `test/chart-base.browser.test.ts`, which drives a tiny
fixture chart (`test/chart-fixture.ts`):

- the AX tree: `ax("group", label)`, `ax("image", mark label)` (Chromium names SVG `role="img"`
  `image`);
- the keyboard: one tab stop, arrows, Home/End, Escape;
- the tooltip does not flicker: dispatch a `pointermove` sweep, assert one `chart-hover` per
  category in order, one open/close toggle, the card inside the drawing and not under the pointer;
- locale: `locale="de-DE"` changes the text; nothing is `es-PE`.

Golden values for any geometry belong in ui-core, next to the math.
