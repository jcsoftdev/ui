# Changelog

Versions are published in lockstep with `@jcsoftdev/ui`; dates are the release commit dates. The package
was added on 2026-10-13 (already at 0.2.0 in `package.json`) and its version first changed at 0.4.0, so
everything before that is listed under 0.4.0. Versions 0.5.0 to 0.8.0 have no user-facing change to this
package. Entries come from `git log` of `packages/ui-core`, summarized by theme.

## 0.9.0 (2026-11-04)

### Fixed

- The Liquid Glass crystal lens mirrors the per-side lens room so the lens maps stay in parity.

## 0.8.0 (2026-11-04)

No changes to this package.

## 0.7.1 (2026-11-03)

No changes to this package.

## 0.7.0 (2026-11-03)

No changes to this package.

## 0.6.0 (2026-10-30)

No changes to this package.

## 0.5.0 (2026-10-23)

No changes to this package.

## 0.4.0 (2026-10-21)

### Added

- **Interaction behaviours**: focus, roving focus, popper, dismiss layers, typeahead and state;
  presence, scroll lock, hide-others and hover intent; pointer drag, press repeat, segmented input,
  file drop and OTP; listbox, menu and command score; tree, virtual list, sortable and disclosure,
  with RTL and announcement labels.
- **Content**: `sanitize-html`, markdown, rich text and xlsx; observe, clipboard, number, date and
  context helpers; emoji search and grid model.
- **Liquid Glass engine**, split per feature with a lazy `attachLiquid`.
- **Chart maths**: scale, axis, format, path, stack, color scale, palette, downsample and category
  axis; time scale with locale and time zone options and `chart/time-range`; polar, hierarchy, sankey
  and chord layouts; pan-zoom, brush and shape-morph; slope, waterfall and bullet; stream, swarm and
  distribution layouts; lanes, heatmap scale and honeycomb; geo projections, hex tiles, globe math and
  lazy topology data.
- **Data grid behaviours** (`grid/*`): model, sort, columns, pin, virtual, keyboard, select, resize,
  reorder, edit (editor kinds, locale-aware number and date parsing, async validation), range,
  clipboard, fill, history, filter, group, pivot and export, plus formula parsing and evaluation.

### Changed

- Chart currency has no default and warns once; data grid currency columns must name their currency.

### Fixed

- Markdown and sanitizer hardening: quadratic regexes removed, nesting capped, link scans bounded,
  hrefs hiding a scheme behind Unicode whitespace rejected, all named entities decoded, dropped and
  replaced content sanitized, Trusted Types tolerated.
- Table columns capped; list and heading scans kept linear; press-repeat stops when disabled
  mid-hold; file inputs reject extra files and match `accept` loosely.
- Time-axis domain no longer overflows the stack on very large date sets; time-zone wall times inside
  a daylight saving gap resolve forward.
- Hierarchy ids escape separators so names containing a slash cannot collide; map topologies ship
  as JS modules so no JSON import attribute is needed.
- Grid formatting and sorting are locale-aware; formula parsing and evaluation are bounded.
- Liquid Glass: lens maps sample at the effective ratio, a lens's pending tasks drop when it is undone,
  and the lens map cost is bounded on high-density phones.
- Stick-to-bottom keeps its direction across a coalesced scroll event.
