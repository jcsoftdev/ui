# Changelog

## 0.2.0 (Unreleased)

### Accessibility and UX defaults

Fixes the kit-level defaults an accessibility audit of a production app found in 0.1.0, and adds the app-level components it was missing.

- **Status tones.** `danger-soft` was within 1.02:1 of `accent-soft` in both themes, so a danger chip and an accent chip looked the same. It now leans orange-red (light `#ffe0d4`, dark `#431608`); the danger text on it stays at 4.70:1 or more. `warning`, `info` and `success` already had their own soft and ink pairs. Two soft fills cannot be 3:1 apart while the text on them keeps 4.5:1, so the separation is hue and about 1.09:1 luminance; do not rely on the fill alone (the chip label and icons carry the meaning). `StatusToneContrastTest` pins the text contrast of every soft pair. The token source is shared with the web, so `--danger-soft` changes there too.
- **Large font scales.** `Button`, `Chip`, `StatusPill` and `Segmented` labels use up to two lines above a font scale of 1.3 instead of being cut to one. `Segmented` caps a segment at `SegmentedDefaults.wrapWidth` (140dp) so the label wraps while the group keeps scrolling.
- **`count` text style** goes from 11sp with an 11sp line to 12sp with a 14.4sp line, so accents and descenders no longer clip. The web token changes the same way.
- **`Input` content type.** `InputContentType` (`Username`, `NewUsername`, `Email`, `Phone`, `Password`, `NewPassword`, `OneTimeCode`) is a new `contentType` parameter of `Input`; `PasswordInput` takes it too and defaults to `Password`. It maps to Compose `contentType` semantics so autofill and password managers offer the right value. It does not change the keyboard. `placeholder` was already a parameter of `Input`, `PasswordInput`, `TimeInput`, `DateInput` and `Select`.
- **Disabled buttons.** `Button` and `IconButton` no longer dim to 0.45 alpha (a primary label fell to about 1.4:1). A disabled button uses the new `disabledColors` parameter, by default `ButtonDefaults.disabledColors(variant)`: a neutral fill with a label at 4.5:1 or more. Code that passed only `colors` to restyle a disabled button should also pass `disabledColors`.
- **Card border.** `CardDefaults.colors(outlined)` draws the control border (about 3.6:1 against the surface) instead of the hairline; it is on by default when `UiTheme(highContrast)` is on.
- **`FloatingActionButton` and `ExtendedFloatingActionButton`** (`atoms`): 56dp, button role, 48dp target, neutral disabled colors, and the extended one collapses to its icon (the label becomes the description) with the theme motion.
- **`BottomActionBar`** (`navigation`): primary actions pinned to the bottom, padded by the side and bottom insets, above the keyboard, and above a bottom dock with `dockHeight`.
- **`FullScreenModal`** (`overlays`): a full-window modal layer for sub-screens. It hides the app and lower layers from accessibility, moves focus to the header title, exposes it as the pane title and a heading, handles system back and a header back button, and slides up with the theme motion.
- **Auth layer** (`auth`): `AuthScaffold` (dark header band from the theme accent, a sheet that overlaps it or an arc-cut header with `AuthHeaderShape`, a pinned bottom slot above the system bar and keyboard), `AuthTextField` and `AuthPasswordField` (filled pill fields on `Input`, leading icons, reveal), `AuthPrimaryButton`, `AuthLink`, `AuthState`/`AuthProgress` (pure form-state rules), `AuthArcs` (header art) and `LoginScreen` assembling them. All text comes from the caller; colors, shapes, sizes and text styles come from `UiTheme`.
- **Auth motion** (`auth`): `AuthArcs` sway on their own rhythms, lengthen and brighten with progress, dim and turn on the password field, shake with a danger flash on error and carry a comet along every arc on success, and fade around the header text at any font scale. New `AuthFloatingArt`: kit icons and shapes floating in three depth layers with drag parallax and state reactions. `AuthScaffold` (and `LoginScreen`) gain a welcome mode: `expanded`, `welcomeTitle`, `welcomeTagline`, `welcomeAction`, `onBackToWelcome`, with one shared transition and a poster title over an outlined echo (`AuthScaffoldColors.echo`). Every loop stops and every transition cuts when `UiTheme.motion` is off.
- **Auth loading and repeated errors** (`auth`): `LoginScreen` ignores the keyboard's done key and disables both fields while `loading`, and replays the header's error reaction and the error announcement on every failed attempt. `errorKey` (on `LoginScreen`, `AuthScaffold`, `AuthArcs`, `AuthFloatingArt`, `AuthTextField` and `AuthPasswordField`, with `LocalAuthErrorKey` for custom art) is the additive counter behind it.
- **Auth drag**: fast drags on `AuthFloatingArt` add up every pointer delta instead of dropping the ones that arrive in the same frame.
- All new components are separate files that no existing code refers to, so R8 drops them from apps that do not use them.
- Binary note (pre-1.0): recompile. Changed signatures: `Button`, `IconButton` (new `disabledColors`), `Input`, `PasswordInput` (new `contentType`), `CardDefaults.colors`.

### Web parity additions

- `Chip` takes `onRemove` and `removeLabel` (default the new `UiStrings.remove`, "Remove" / "Quitar"): a remove button with a 48dp touch target.
- `Input` takes `size: InputSize` (`Md`, `Lg`); `Lg` is the height of the large button.
- Key and Webhook icons join the generated set.

### Opt-in Liquid features (breaking)

Liquid Glass is now built from values the app passes, so an APK only contains the Liquid code it uses. R8 keeps a feature only when the app names it, because the kit reaches each feature's code through that value and nowhere else. `LiquidReachabilityTest` reads the compiled classes and fails if any kit class outside the Liquid files refers to Liquid code.

- `SurfaceMaterial` is now a sealed class with the values `Solid`, `Glass`, `GlassClear` and `LiquidGlass`.
- `LiquidGlass` takes two optional features:
  - `lens`: `RefractionLens(refraction, profile, dispersion)` or `CrystalLens(refraction, dispersion)`.
  - `interaction`: `LiquidInteraction.Press(motion)` or `LiquidInteraction.Drag(motion)`.
- `Dispersion(amount)` is a parameter of the lens, so a material cannot have dispersion without a lens.
- The look fields of the old `LiquidGlassStyle` keep their names and defaults.
- `LiquidGlass()` with no features is the base material: veil, rim, specular, shadow and no shader.
- `LiquidGlass.Regular`, `Clear`, `Thick` and `Crystal` are presets. Each is built in its own holder on first read.

Measured with a minified release consumer (dex bytes; Liquid classes left by R8):

| Consumer | `perf/compose-liquid-lean` | This change |
| --- | --- | --- |
| No Liquid | 1,209,932; 19 classes, both shaders | 1,175,540; 0 classes, no shader |
| `LiquidGlass()` (base material) | 1,261,692; 41 classes (the old `Liquid`) | 1,188,680; 10 classes, no shader |
| `RefractionLens()` | n/a | 1,204,980; 19 classes, lens shader only |

Behaviour changes:

- **The defaults changed.** `LiquidGlassStyle()` meant a full lens at refraction 1, dispersion 0.03, `Press` and `LiquidMotion.Standard`. `LiquidGlass()` has no lens, no dispersion and no interaction. A custom style therefore maps to `LiquidGlass.Regular.copy(...)`, not to `LiquidGlass(...)`. This also holds for the chrome material passed to `UiTheme(chromeGlass)`.
- A `LiquidGlass` without an `interaction` is static. An `interactionSource` alone no longer animates it.
- `GlassEffectContainer` merges only when its material has a lens.
- There is no subtree-wide style any more. Pass the material to each surface, or set the chrome material with `UiTheme(chromeGlass)`.

### Migration

| Before | After |
| --- | --- |
| `SurfaceMaterial.Liquid` | `LiquidGlass.Regular` |
| `SurfaceMaterial.LiquidClear` | `LiquidGlass.Regular.copy(clear = true)` |
| `LiquidGlassStyle()` / `LiquidGlassStyle.Regular` | `LiquidGlass.Regular` (`LiquidGlass()` is the base material, without the old defaults) |
| `LiquidGlassStyle(field = x, ...)` | `LiquidGlass.Regular.copy(field = x, ...)`, with the lens and interaction fields mapped as below |
| `LiquidGlassStyle.Clear` / `Thick` / `Crystal` | `LiquidGlass.Clear` / `Thick` / `Crystal` |
| `refraction = r, profile = P` | `lens = RefractionLens(r, P, Dispersion())` (`Dispersion()` keeps the old 0.03 default) |
| `profile = LiquidProfile.Convex` | `lens = CrystalLens(r, Dispersion())` |
| `refraction = 0f` | `lens = RefractionLens(refraction = 0f, ...)`: the shader still draws the glint, fresnel and grain, as before. Use `lens = null` only to drop the shader. |
| `dispersion = d` / `dispersion = 0f` | `RefractionLens(..., dispersion = Dispersion(d))` / `RefractionLens(..., dispersion = null)` (also on `CrystalLens`) |
| `interaction = LiquidInteraction.Press` / `Drag` with `motion = m` | `interaction = LiquidInteraction.Press(m)` / `LiquidInteraction.Drag(m)` |
| `interaction = LiquidInteraction.None` | `interaction = null`. In 0.2.0 previews, `None` plus an `interactionSource` still made the press brightening and the materialize ramp; `null` makes neither. To keep them, use `LiquidInteraction.Press(m)` with `swell = 0.dp` in the motion. Kit components are unaffected: they never passed an `interactionSource` to the surface. |
| `UiTheme(glassVariant = GlassVariant.Frosted)` | `UiTheme(chromeGlass = SurfaceMaterial.Glass)` (the default) |
| `UiTheme(glassVariant = GlassVariant.Liquid)` | `UiTheme(chromeGlass = LiquidGlass.Regular)` |
| `UiTheme(glassVariant = GlassVariant.Liquid, liquidGlassStyle = LiquidGlassStyle(...))` | `UiTheme(chromeGlass = LiquidGlass.Regular.copy(...))` |
| `UiTheme.liquidGlassStyle`, `LocalLiquidGlassStyle` | `UiTheme.chromeGlass`; per surface, pass the material |
| `Modifier.material(SurfaceMaterial.Liquid, shape, style = s)`, `MaterialSurface(..., style = s)` | `Modifier.material(s, shape)`, `MaterialSurface(s, ...)` |
| `GlassEffectContainer(style = s)`, `glassEffect(shape, style = s, material = m)` | `GlassEffectContainer(material = s)`, `glassEffect(shape, material = s)` |

`SurfaceMaterial` was an enum and is now a sealed class. Code that treats it as an enum no longer compiles:

- `SurfaceMaterial.entries`, `values()` and `valueOf(...)`. List the values you use yourself.
- `.name` and `.ordinal`. Compare with `==` against `SurfaceMaterial.Solid`, `Glass` or `GlassClear`, or use `is LiquidGlass`.
- An exhaustive `when` over the old constants. Branch on `SurfaceMaterial.Solid`, `Glass` and `GlassClear` with `==`, use `is LiquidGlass` for Liquid, and add an `else` branch.

An app that never used Liquid Glass needs no changes unless it used the enum API above: `Solid`, `Glass`, `GlassClear` and the frosted default are unchanged.

### Liquid Glass

Apple-style glass for the control and navigation layer, mirroring the web kit's 0.3.0 glass work. Content stays solid.

- **`SurfaceMaterial`** (`Solid`, `Glass`, `GlassClear`) and **`UiStyle`** (`Default`, `Glass`). `UiTheme(style = UiStyle.Glass)` turns Sheet, Dialog, Menu, Toaster, TopBar and ActionBar into glass; the default keeps every surface exactly as in 0.1.0.
- **`material` parameter** on `Card`, `Sheet`, `Dialog`, `Menu`, `Toaster`, `TopBar`, `ActionBar`; `Modifier.material` and `MaterialSurface` for any other surface.
- **Real backdrop blur** (tint, dim, saturation, edge highlight, border) from the generated `UiGlass` tokens. `OverlayHost` records the app content once, only while a blurring surface exists, so sheets, dialogs and toasts blur it with no setup. In-content chrome uses `rememberGlassState()`, `Modifier.glassSource` and the `glass` parameter. Android 12 (API 31)+, desktop and iOS blur; Android below API 31, menus (platform popup) and surfaces without a source draw a mostly opaque tint.
- **No glass on glass**: glass inside glass is a near-solid fill.
- **Accessibility**: `UiTheme(reduceTransparency, highContrast)` force opaque surfaces with a border. Defaults read iOS Reduce Transparency and Increase Contrast, and on Android the high-contrast text setting and the Android 14 contrast level (Android has no reduce-transparency setting).
- `UiTheme(backdropBlur = false)` keeps glass as tint everywhere.
- **Liquid variant**: `SurfaceMaterial.Liquid` and `LiquidClear`, `GlassVariant` and `UiTheme(glassVariant)` (default `Frosted`, like the web; `Liquid` is opt in). Lens refraction through a runtime shader (Android 13+, desktop, iOS), dispersion, specular rim, thickness shading, shadow, and press feedback via `interactionSource` (flex only with motion). Whole-surface refraction (a crease-free superellipse height field, exponent 2 to 8 from the sharpest corner, amount 0.9x the half short side capped at 20dp, 5% dome, 3% dispersion), a veil that thins across the bevel, thickness shading and a directional glint, all computed per pixel in the lens shader (no banding), and a 4dp (2dp clear) center blur. API 31-32 fall back to blur plus rim, below 31 to tint plus rim.
- **Configurable Liquid Glass**: `LiquidGlassStyle` (refraction, bevel width, `LiquidProfile` Rim/Full/Dome, dispersion, frost, saturation, brightness, `LiquidTint`, rim, `LiquidSpecular` intensity and angle, fresnel, grain, opacity, `LiquidShadow` opacity/spread/offsetY, `LiquidInteraction` None/Press/Drag, `LiquidMotion`, merge blend) with the presets `LiquidGlassStyle.Regular` (the default, the shipped look), `Clear` and `Thick`. App-wide through `UiTheme(liquidGlassStyle = ...)` / `UiTheme.liquidGlassStyle` / `LocalLiquidGlassStyle`, per surface through the new `style` parameter of `Modifier.material` and `MaterialSurface`. Defaults and presets keep the glass tint and dim at full strength, so the `GlassContrastTest` floors hold; a style that lowers `opacity` or the tint, recolors the tint or raises `brightness` drops that guarantee (`LiquidGlassStyle.preservesContrast`).
- **Motion**: press lift (brightening, swell of 16dp over the width, touch glow, highlight turned toward the finger), a materialize ramp of the refraction on first appearance, and `LiquidInteraction.Drag` velocity squash with mismatched X/Y springs for a jelly settle. Springs are `LiquidMotion` / `LiquidSpring` (`Standard`, `Playful`). All of it is off when the theme motion is off (system animator scale 0, iOS Reduce Motion); the press brightening stays.
- **`GlassEffectContainer` and `Modifier.glassEffect(shape)`**: neighbouring Liquid shapes merge with an SDF smooth union in the lens shader (up to 16 shapes; Android 13+ AGSL, Skia SkSL); further shapes, and every shape without the shader, render as separate Liquid surfaces.
- Lens optics: profiles, fresnel, grain, light angle, size-scaled rim thickness and shadow (the shadow is now a stack of silhouettes, so `offsetY` works the same on every target; default `offsetY` 3dp).
- **Liquid correction pass**: `glassEffect(shape, style, material)` now takes nullable `style` and `material` (default null: the container's, else the theme's `LocalLiquidGlassStyle` and `Liquid`), and `GlassEffectContainer` gives its `style`, `material` and `glass` to children that fall back to separate surfaces; a child that asks for a different look is its own surface instead of merging (precedence: child explicit, container, theme). Merged slots are released when a child is abandoned and handed to children that were over the cap. Swell and squash keep the refracted backdrop aligned under the scaled glass. Drag: one touch source of truth, a scroll that takes over ends the touch (no flicker or squash), all pointers tracked, squash relaxes when the finger rests. Fewer per-frame allocations (cached outline, lens effect, merged geometry and shadow paths, cached springs, materialize ramp plays once per surface instance). The rim depth is capped at 75% of the half short side; `preservesContrast` also bounds `rim` and specular intensity, and `LiquidContrastRenderTest` measures contrast on rendered pixels. The Liquid shadow is cast once for the merged shapes, also for free-form outlines, and never under the glass. Changed signature: `glassEffect` (`style`/`material` now `LiquidGlassStyle?`/`SurfaceMaterial?`; source compatible, binary incompatible, pre-1.0).
- New public signatures: `LiquidGlassStyle` (+ `Regular`, `Clear`, `Thick`), `LiquidProfile`, `LiquidInteraction`, `LiquidMotion` (+ `Standard`, `Playful`), `LiquidSpring`, `LiquidTint`, `LiquidSpecular`, `LiquidShadow`, `LocalLiquidGlassStyle`, `UiTheme.liquidGlassStyle`, `GlassEffectContainer`, `glassEffect`. Changed: `UiTheme` (new `liquidGlassStyle`), `Modifier.material` and `MaterialSurface` (new `style`). The style classes are data classes, so adding a field later changes their binary signature (pre-1.0).
- New `TopBar`, `ActionBar`, `BarColors`, `BarDefaults`.
- **Lean Liquid path**: solid, nested and frosted surfaces no longer read the Liquid style or allocate any Liquid state. A glass surface makes its backdrop layer on the first draw that blurs (tint-only surfaces never hold one), and the lens engine, its input buffers and the rim brushes only exist on Liquid surfaces that use them. Press and None surfaces skip the drag squash state and effects; a surface without an interaction source starts no collector. Strokes, the frosted edge gradient and the directional rim sweeps are cached between draws. Tokens of a custom `LiquidGlassStyle` are remembered, so recomposing a caller no longer updates the node and rebuilds its lens. The Skia lens engine compiles the merge shader only when a `GlassEffectContainer` merges, and both engines keep the blur that feeds the lens while its radius holds. No API change; frosted surfaces also stop padding their backdrop for a convex Liquid style they never draw.
- **Per-feature cost**: a Liquid surface makes its press and spring state only when something can move it (an `interactionSource`, `LiquidInteraction.Drag`, or the materialize ramp with motion on). The lens shader skips the two dispersion samples when `dispersion` is 0, and skips the glint, fresnel, touch glow and grain terms when they are off, with the same output. `LiquidGlassStyle.Clear`, `Thick`, `Crystal` and `LiquidMotion.Playful` live in their own file and are built on first read, so R8 drops the presets an app never names.
- Binary note (pre-1.0, no shims): recompile against 0.2.0. Changed signatures: `UiTheme` (new `style`, `reduceTransparency`, `highContrast`, `backdropBlur`, `glassVariant`), `Card`, `Dialog`, `Menu`, `Sheet` and `Toaster` (new `material`), `Modifier.material` and `MaterialSurface` (new `interactionSource`). All new parameters have defaults, so source stays compatible.
