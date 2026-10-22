package com.jcsoftdev.ui.auth

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import com.jcsoftdev.ui.theme.ThemeColors

/** The header band: the accent pulled toward the darkest tone of the theme, so it stays dark in light and dark themes with any accent. */
internal fun authHeaderColor(c: ThemeColors): Color {
    val darkest = if (c.bg.luminance() > 0.5f) c.ink else c.bg
    return lerp(c.accent, darkest, 0.62f)
}

/** The theme tone that reads best on [background]: `surface` or `ink`, whichever contrasts more. */
internal fun authOnColor(
    background: Color,
    c: ThemeColors,
): Color = if (contrast(c.surface, background) >= contrast(c.ink, background)) c.surface else c.ink

internal fun contrast(
    a: Color,
    b: Color,
): Float {
    val hi = maxOf(a.luminance(), b.luminance())
    val lo = minOf(a.luminance(), b.luminance())
    return (hi + 0.05f) / (lo + 0.05f)
}
