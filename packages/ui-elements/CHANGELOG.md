# Changelog

Versions are published in lockstep with `@jcsoftdev/ui`; dates are the release commit dates. The package
was added on 2026-10-13 (already at 0.2.0 in `package.json`) and its version first changed at 0.4.0, so
everything before that is listed under 0.4.0. Versions 0.5.0 (one fix) to 0.8.0 have almost no
user-facing change to this package. Entries come from `git log` of `packages/ui-elements` (about 135
feat, fix and perf commits), summarized by theme.

## 0.9.0 (2026-11-04)

### Added

- **`AlarmClock` and `Hourglass` icon glyphs** in the `ui-icon` registry.

## 0.8.0 (2026-11-04)

No changes to this package.

## 0.7.1 (2026-11-03)

No changes to this package.

## 0.7.0 (2026-11-03)

No changes to this package.

## 0.6.0 (2026-10-30)

No changes to this package.

## 0.5.0 (2026-10-23)

### Fixed

- Glyph modules are generated for the `Eye`, `Mail`, `House` and `GraduationCap` icons.

## 0.4.0 (2026-10-21)

### Added

- **Core custom elements**: button, input, checkbox, switch, radio-group, dialog, popover, tooltip,
  tabs and toast, on an element generator and a `FormElement` base.
- **Forms and display**: label, field, form-grid, input-icon, textarea, native-select, radio-button-group;
  avatar, chip, led, status-dot, status-pill, progress, meter, trend-chip; slider, number-stepper,
  pin-input, rating, time-input, dropzone; number-value, big-date, kpi, pressable, highlight-line.
- **Layout and navigation**: card, cell, cols, description-list, page-header, settings-row; segmented,
  stepper, floating-toc, app-shell, sidebar, topbar; toolbar, action-bar, confirm-action,
  item-card-group, kpi-group, responsive-list, timeline and table.
- **States and feedback**: empty, error, forbidden and offline states, banner, skeleton, loader and
  text shimmer.
- **Overlays and menus**: dropdown-menu, context-menu, select, inline-select, command-palette, drawer,
  hover-card.
- **Calendar**: day-chip, event-block, month-view, week-view and timeline-view.
- **Icons**: `ui-icon` with a lazy per-glyph registry, static per-glyph entries, and key and webhook
  glyphs.
- **Rich content and AI chat**: code-block, markdown, rich-text-view, rich-text-editor, chain-of-thought,
  tool-call, chat-list, conversation, message-actions, attachments, carousel, resizable, file-tree,
  kanban, scrolly, emoji-reaction, emoji-reaction-bar and emoji-picker, logo-mark and logo-forge.
- **Data grid** (`ui-data-grid`): virtual rows and columns, APG keyboard, pin, resize, reorder, sort,
  selection, inline cell editing (lazy editors, validation, type-to-edit), batched writes, history, range
  selection, clipboard, fill, formulas, formula bar and row creation.
- **Charts**: a chart base (draw phases, retained rendering, virtual marks, transient draws, gesture
  arbitration, natural-height and theme hooks), tooltip in the top layer with a docked panel for coarse
  pointers, legend (including gradient scales), data table, breadcrumb, export menu and sparkline;
  cartesian, scatter, bubble, histogram, lollipop, stock, candlestick, timeline, heatmap, gantt;
  donut, pie, gauge, fill-gauge, radar, radial-bar, polar-area, parliament; hierarchy (sunburst,
  treemap, icicle, hierarchy-morph) and tree chart; sankey, chord, funnel; slope, range-area,
  waterfall, bullet, dumbbell, stream-graph, beeswarm, hbars, bar-race; box-plot, violin, raincloud;
  unit charts and chart-grid; choropleth, hex tile, bubble map and globe; crossfilter charts.
- **`--touch-target`**: the interactive chip grows to the touch target under `data-density="touch"`.

### Changed

- Smaller first loads: chart painters, time axis, zoom gestures, theme observer, stock and gantt data
  tables, globe renderer and brush are loaded on demand; the sparkline has its own path code.
- The CSS minifier drops the space after property colons.

### Fixed

- Hardening after review across the data grid (axe structure, pin cap, locale, persistence, history and
  range accessibility), charts (non-finite values, large data, DST-safe clock ticks, date-only parsing,
  touch gestures), rich text (inert seed sources), the bash highlighter, tool-call, chat-list and drawer
  swipe.
- Chart export strips interactive attributes and selection styling and reports dropped images; focus
  returns to the export menu button after light dismiss.
- The CSS minifier keeps quoted strings and `url()` intact.
- Carousel index stays steady until a programmatic scroll lands; kanban, tree and resizable edge
  cases; select, command palette and menu review findings; stepper, time and pin input values and
  duplicate input events.
