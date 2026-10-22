package com.jcsoftdev.ui.auth

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import com.jcsoftdev.ui.theme.ThemeColors

/**
 * The header band: near black with the accent's hue kept as a faint tint, so every accent still reads as the brand. In a dark
 * theme the band and the sheet are close in tone, so the sheet draws a hairline edge there ([authNeedsSheetEdge]).
 */
internal fun authHeaderColor(c: ThemeColors): Color {
    val darkest = if (c.bg.luminance() > 0.5f) c.ink else c.bg
    return lerp(c.accent, darkest, HEADER_DARKNESS)
}

/** True when the band and the sheet are too close in tone to part on their own, so the sheet draws a hairline edge. */
internal fun authNeedsSheetEdge(
    header: Color,
    sheet: Color,
): Boolean = contrast(header, sheet) < SHEET_EDGE_BELOW

/** The theme tone that reads best on [background]: `surface` or `ink`, whichever contrasts more. */
internal fun authOnColor(
    background: Color,
    c: ThemeColors,
): Color = if (contrast(c.surface, background) >= contrast(c.ink, background)) c.surface else c.ink

/** The welcome title's highlight swash: the accent pulled toward the sheet until the title ink keeps 4.5:1 over it. */
internal fun authHighlightColor(c: ThemeColors): Color = atLeast(c.accent, c.ink, c.surface, 4.5f)

/** A solid floating piece in [color] (an accent): pulled toward the header content color [paper] until it keeps 3:1 on [header]. */
internal fun authPieceFill(
    color: Color,
    header: Color,
    paper: Color,
): Color = atLeast(color, header, paper, 3f)

/** The resting edge of the auth fields: the control outline, pulled toward the ink until it keeps 3:1 against the sheet. */
internal fun authFieldEdgeColor(c: ThemeColors): Color = atLeast(c.lineControl, c.surface, c.ink, 3f)

/**
 * [color] moved toward [toward] in small steps until it contrasts [minimum] with [against]; unchanged when it already does.
 * Keeps art (3:1 for graphics), edges and highlights above the bar whatever the theme.
 */
internal fun atLeast(
    color: Color,
    against: Color,
    toward: Color,
    minimum: Float,
): Color {
    var share = 0f
    var out = color
    while (contrast(out, against) < minimum && share < 1f) {
        share = (share + 0.05f).coerceAtMost(1f)
        out = lerp(color, toward, share)
    }
    return out
}

internal fun contrast(
    a: Color,
    b: Color,
): Float {
    val hi = maxOf(a.luminance(), b.luminance())
    val lo = minOf(a.luminance(), b.luminance())
    return (hi + 0.05f) / (lo + 0.05f)
}

/** How far the band is pulled from the accent toward the darkest theme tone. */
private const val HEADER_DARKNESS = 0.86f

/** Below this ratio between band and sheet the sheet gets its hairline edge. */
private const val SHEET_EDGE_BELOW = 1.6f
