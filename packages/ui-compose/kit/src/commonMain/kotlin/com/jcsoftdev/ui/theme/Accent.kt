package com.jcsoftdev.ui.theme

import androidx.compose.ui.graphics.Color
import kotlin.math.abs

/**
 * Resolves [accent] to a palette: an id from [UiPalettes.ids] wins, a `#rrggbb` hex picks the closest palette
 * accent (or [base] itself, which has no palette and returns null). Anything else keeps the base accent.
 */
internal fun resolveAccent(
    accent: String?,
    dark: Boolean,
    base: Color,
): AccentPalette? {
    if (accent == null) return null
    val find = if (dark) UiPalettes::dark else UiPalettes::light
    if (accent in UiPalettes.ids) return find(accent)
    val target = parseHex(accent) ?: return null
    val nearestId =
        UiPalettes.ids
            .map { id -> id to UiPalettes.light(id)!!.accent }
            .plus("" to base)
            .minBy { (_, color) -> distance(color, target) }
            .first
    return find(nearestId)
}

internal fun ThemeColors.withPalette(palette: AccentPalette?): ThemeColors =
    if (palette == null) {
        this
    } else {
        copy(
            accent = palette.accent,
            onAccent = palette.onAccent,
            accentInk = palette.accentInk,
            accentWord = palette.accentWord,
            accentSoft = palette.accentSoft,
            accentLine = palette.accentLine,
            accent2 = palette.accent2,
        )
    }

internal fun parseHex(hex: String): Color? {
    val digits = hex.trim().removePrefix("#")
    if (digits.length != 6) return null
    val value = digits.toLongOrNull(16) ?: return null
    return Color((0xFF000000 or value).toInt())
}

private fun distance(
    a: Color,
    b: Color,
): Float = abs(a.red - b.red) + abs(a.green - b.green) + abs(a.blue - b.blue)
