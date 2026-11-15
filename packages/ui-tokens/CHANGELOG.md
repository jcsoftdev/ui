# Changelog

Versions are published in lockstep with `@jcsoftdev/ui`; dates are the release commit dates. The package
was extracted on 2026-10-12 (already at 0.2.0 in `package.json`) and its version first changed at 0.4.0,
so everything before that is listed under 0.4.0. Versions 0.5.0, 0.7.0, 0.7.1 and 0.8.0 have no
user-facing change to this package. Entries come from `git log` of `packages/ui-tokens`.

## 0.9.0 (2026-11-04)

No changes to this package.

## 0.8.0 (2026-11-04)

No changes to this package.

## 0.7.1 (2026-11-03)

No changes to this package.

## 0.7.0 (2026-11-03)

No changes to this package.

## 0.6.0 (2026-10-30)

### Added

- **`--control-height-md` token** shared by every md control.
- **`data-density="auto"`**, which follows the pointer type.
- **Container breakpoint tokens**: a `containers` section (`--container-page-m`, `--container-page-w`,
  `--container-page-xw` at 720, 1280 and 1600).

### Changed

- **Breaking:** tighter product type scale, and mobile titles are no longer larger than desktop
  (for example `kpi-number` 30 to 24 px, `page-title` 26 to 22 px, `m-title` 34 to 22 px).

## 0.5.0 (2026-10-23)

No changes to this package.

## 0.4.0 (2026-10-21)

### Added

- **`@jcsoftdev/ui-tokens`**: design tokens and the `ui-theme` CLI, extracted from `@jcsoftdev/ui`.
- **`createTheme`**: a WCAG AA theme generator, with `toCss`, `applyTheme` and `ui-theme generate`.
- **Named tone palettes** emitted from `tonePalettes` in `tokens.json`.
- **`--touch-target` density token**, used for interactive chips.

### Changed

- **Breaking (`@jcsoftdev/ui`):** Liquid Glass is opt-in through `LiquidGlass` and `liquidStyle`
  (commit touched this package's `base.css`).

### Fixed

- `ui-theme build` can skip Kotlin output with `--no-kotlin`.
- `data-accent` presets stay ahead of generated dark rules; `surface-2` and float pairs are covered;
  `applyTheme` isolates its styles.
- `danger-soft` is distinguishable from `accent-soft`, gives the count room, and keeps 4.5:1 for
  `ink-3` text on it.
- The theme no longer emits self-referencing variables into Tailwind's theme layer.
