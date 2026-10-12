package com.jcsoftdev.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.foundation.LocalMotion
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.foundation.rememberSystemMotion
import com.jcsoftdev.ui.glass.GlassVariant
import com.jcsoftdev.ui.glass.LocalBackdropBlur
import com.jcsoftdev.ui.glass.LocalGlassVariant
import com.jcsoftdev.ui.glass.LocalHighContrast
import com.jcsoftdev.ui.glass.LocalReduceTransparency
import com.jcsoftdev.ui.glass.LocalUiDark
import com.jcsoftdev.ui.glass.LocalUiStyle
import com.jcsoftdev.ui.glass.rememberSystemHighContrast
import com.jcsoftdev.ui.glass.rememberSystemReduceTransparency
import com.jcsoftdev.ui.overlays.OverlayHost

private val LocalColors = staticCompositionLocalOf { UiColors.Light }
internal val LocalShapes = staticCompositionLocalOf { ThemeShapes.Default }
internal val LocalSizes = staticCompositionLocalOf { ThemeSizes.Default }
private val LocalTypography = staticCompositionLocalOf { ThemeTypography.Default }
private val LocalFontFamily = staticCompositionLocalOf<FontFamily> { FontFamily.Default }

/** Reads the active theme the way the web reads its CSS variables. */
public object UiTheme {
    public val colors: ThemeColors
        @Composable @ReadOnlyComposable
        get() = LocalColors.current

    public val shapes: ThemeShapes
        @Composable @ReadOnlyComposable
        get() = LocalShapes.current

    public val sizes: ThemeSizes
        @Composable @ReadOnlyComposable
        get() = LocalSizes.current

    public val typography: ThemeTypography
        @Composable @ReadOnlyComposable
        get() = LocalTypography.current

    public val fontFamily: FontFamily
        @Composable @ReadOnlyComposable
        get() = LocalFontFamily.current

    public val strings: UiStrings
        @Composable @ReadOnlyComposable
        get() = LocalUiStrings.current

    public val motion: Motion
        @Composable @ReadOnlyComposable
        get() = LocalMotion.current

    /** The chrome look: [UiStyle.Default] is opaque, [UiStyle.Glass] turns the control and navigation layer into glass (frosted by default, see `glassVariant`). */
    public val style: UiStyle
        @Composable @ReadOnlyComposable
        get() = LocalUiStyle.current

    /** True when surfaces must not be translucent; glass is drawn opaque with a border. */
    public val reduceTransparency: Boolean
        @Composable @ReadOnlyComposable
        get() = LocalReduceTransparency.current

    /** True when contrast is increased; glass is drawn opaque with a stronger border. */
    public val highContrast: Boolean
        @Composable @ReadOnlyComposable
        get() = LocalHighContrast.current

    /** A token text style (for example [UiTypography.body]) with the theme font and a line height of at least 1.2x. */
    @Composable
    @ReadOnlyComposable
    public fun text(style: TextStyle): TextStyle = style.withMinLineHeight().copy(fontFamily = LocalFontFamily.current)
}

/**
 * Provides the token theme to [content] and hosts the overlays ([com.jcsoftdev.ui.overlays.Sheet], dialogs, toasts) above it,
 * so give the outermost one the whole screen. A `UiTheme` nested inside another reuses its overlay host and does not fill.
 *
 * @param colors base colors; pass a [copy] of [UiColors] to override single tokens.
 * @param accent a palette id from [UiPalettes.ids] or a `#rrggbb` brand color, matched to the closest palette. Null keeps the accent of [colors].
 * @param fontFamily replaces the bundled Figtree family.
 * @param motion defaults to the system animator duration scale; scale 0 turns every transition into a jump cut.
 * @param shapes corner shapes by role; pass `ThemeShapes.Default.copy(...)` to change some.
 * @param sizes spacing, control heights, minimum touch target and disabled opacity; pass `ThemeSizes.Default.copy(...)`.
 * @param typography text styles by role; pass `ThemeTypography.Default.copy(...)`. The font family is [fontFamily].
 * @param strings fallback labels of the kit ([UiStrings.En] or [UiStrings.Es]); an explicit label parameter on a component wins.
 * @param style [UiStyle.Glass] makes the control and navigation layer Liquid Glass (see [com.jcsoftdev.ui.glass.SurfaceMaterial]);
 * the default keeps every surface opaque. A component's own `material` parameter wins over it.
 * @param reduceTransparency forces opaque surfaces; defaults to the OS setting where one exists (iOS Reduce Transparency;
 * Android has none).
 * @param highContrast forces opaque surfaces with a stronger border; defaults to the OS setting (iOS Increase Contrast,
 * Android high-contrast text and the Android 14 contrast level).
 * @param backdropBlur false keeps glass as the translucent tint everywhere (no backdrop capture or blur), for example to save
 * battery or GPU; the platform check (Android below API 31) already does this on its own.
 * @param glassVariant which glass chrome surfaces get with [UiStyle.Glass] and no `material`: [GlassVariant.Frosted] (default, blur
 * only, like the web preset) or [GlassVariant.Liquid] (opt in, the lensed Apple look). An explicit `material` is never changed by it.
 *
 * It also installs the [OverlayHost] that sheets, dialogs and toasts draw in; headless code can use [OverlayHost] without a
 * `UiTheme`.
 *
 * Every group is independent, so overriding one (for example only `colors.accent`) leaves the rest of the kit look unchanged.
 * Single components can still deviate through their `XDefaults` parameters. The small glyphs drawn inside components (spinner,
 * check mark, chevron, eye, plus/minus) keep fixed proportions and take the content color.
 */
@Composable
public fun UiTheme(
    dark: Boolean = isSystemInDarkTheme(),
    colors: ThemeColors = if (dark) UiColors.Dark else UiColors.Light,
    accent: String? = null,
    fontFamily: FontFamily? = null,
    motion: Motion = rememberSystemMotion(),
    shapes: ThemeShapes = ThemeShapes.Default,
    sizes: ThemeSizes = ThemeSizes.Default,
    typography: ThemeTypography = ThemeTypography.Default,
    strings: UiStrings = UiStrings.En,
    style: UiStyle = UiStyle.Default,
    reduceTransparency: Boolean = rememberSystemReduceTransparency(),
    highContrast: Boolean = rememberSystemHighContrast(),
    backdropBlur: Boolean = true,
    glassVariant: GlassVariant = GlassVariant.Frosted,
    content: @Composable () -> Unit,
) {
    val themed = remember(colors, accent, dark) { colors.withPalette(resolveAccent(accent, dark, colors.accent)) }
    val font = fontFamily ?: rememberFigtree()
    CompositionLocalProvider(
        LocalColors provides themed,
        LocalFontFamily provides font,
        LocalMotion provides motion,
        LocalShapes provides shapes,
        LocalSizes provides sizes,
        LocalTypography provides typography,
        LocalUiStrings provides strings,
        LocalUiDark provides dark,
        LocalUiStyle provides style,
        LocalReduceTransparency provides reduceTransparency,
        LocalHighContrast provides highContrast,
        LocalBackdropBlur provides backdropBlur,
        LocalGlassVariant provides glassVariant,
    ) {
        OverlayHost(content = content)
    }
}
