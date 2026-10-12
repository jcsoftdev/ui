# Changelog

## 0.2.0 (Unreleased)

### Liquid Glass

Apple-style glass for the control and navigation layer, mirroring the web kit's 0.3.0 glass work. Content stays solid.

- **`SurfaceMaterial`** (`Solid`, `Glass`, `GlassClear`) and **`UiStyle`** (`Default`, `Glass`). `UiTheme(style = UiStyle.Glass)` turns Sheet, Dialog, Menu, Toaster, TopBar and ActionBar into glass; the default keeps every surface exactly as in 0.1.0.
- **`material` parameter** on `Card`, `Sheet`, `Dialog`, `Menu`, `Toaster`, `TopBar`, `ActionBar`; `Modifier.material` and `MaterialSurface` for any other surface.
- **Real backdrop blur** (tint, dim, saturation, edge highlight, border) from the generated `UiGlass` tokens. `OverlayHost` records the app content once, only while a blurring surface exists, so sheets, dialogs and toasts blur it with no setup. In-content chrome uses `rememberGlassState()`, `Modifier.glassSource` and the `glass` parameter. Android 12 (API 31)+, desktop and iOS blur; Android below API 31, menus (platform popup) and surfaces without a source draw a mostly opaque tint.
- **No glass on glass**: glass inside glass is a near-solid fill.
- **Accessibility**: `UiTheme(reduceTransparency, highContrast)` force opaque surfaces with a border. Defaults read iOS Reduce Transparency and Increase Contrast, and on Android the high-contrast text setting and the Android 14 contrast level (Android has no reduce-transparency setting).
- `UiTheme(backdropBlur = false)` keeps glass as tint everywhere.
- **Liquid variant**: `SurfaceMaterial.Liquid` and `LiquidClear`, `GlassVariant` and `UiTheme(glassVariant)` (default `Frosted`, like the web; `Liquid` is opt in). Lens refraction through a runtime shader (Android 13+, desktop, iOS), dispersion, specular rim, thickness shading, shadow, and press feedback via `interactionSource` (flex only with motion). API 31-32 fall back to blur plus rim, below 31 to tint plus rim.
- New `TopBar`, `ActionBar`, `BarColors`, `BarDefaults`.
- Binary note (pre-1.0, no shims): recompile against 0.2.0. Changed signatures: `UiTheme` (new `style`, `reduceTransparency`, `highContrast`, `backdropBlur`, `glassVariant`), `Card`, `Dialog`, `Menu`, `Sheet` and `Toaster` (new `material`), `Modifier.material` and `MaterialSurface` (new `interactionSource`). All new parameters have defaults, so source stays compatible.
