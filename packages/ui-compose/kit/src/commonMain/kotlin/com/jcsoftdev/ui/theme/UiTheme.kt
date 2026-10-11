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

    public val motion: Motion
        @Composable @ReadOnlyComposable
        get() = LocalMotion.current

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
    ) {
        OverlayHost(content = content)
    }
}
