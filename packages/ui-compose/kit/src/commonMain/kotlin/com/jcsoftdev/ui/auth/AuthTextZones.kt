package com.jcsoftdev.ui.auth

import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.layout.LayoutCoordinates

/**
 * Where the header text sits inside the header art, so the built-in art can clear it. [login] is the title block of the
 * sign-in header, [welcome] the welcome block, and [welcomeFraction] how far the screen is into the welcome mode.
 */
@Stable
internal class AuthTextZones {
    var login: Rect by mutableStateOf(Rect.Zero)
    var welcome: Rect by mutableStateOf(Rect.Zero)
    var welcomeFraction: State<Float> = mutableFloatStateOf(0f)

    /** The scaffold's own coordinates, the frame the zones are measured in; not observed, only read when a zone moves. */
    var root: LayoutCoordinates? = null

    /**
     * Height of the band above the text that art can fill freely: the whole box on the sign-in header, the space above the
     * welcome block in welcome mode, never less than [minimum].
     */
    fun freeBand(
        height: Float,
        minimum: Float,
    ): Float {
        val f = welcomeFraction.value
        if (f <= 0f || welcome.isEmpty) return height
        val top = welcome.top.coerceAtLeast(minimum)
        return height + (top - height) * f
    }
}

/** Provided by [AuthScaffold] to its art; null outside a scaffold, where nothing is cleared. */
internal val LocalAuthTextZones = staticCompositionLocalOf<AuthTextZones?> { null }

/**
 * A rectangle with soft edges that erases what was drawn under it (`DstOut`), built once per zone and size. Draw it on an
 * offscreen layer, after the art, with the share of the art to remove.
 */
internal class FeatheredEraser(
    rect: Rect,
    feather: Float,
) {
    private val core = rect
    private val pieces: List<Pair<Rect, Brush>>

    init {
        val f = feather.coerceAtLeast(1f)
        val l = rect.left
        val t = rect.top
        val r = rect.right
        val b = rect.bottom
        val solid = Color.Black
        val clear = Color.Transparent
        pieces =
            if (rect.isEmpty) {
                emptyList()
            } else {
                listOf(
                    Rect(l, t - f, r, t) to Brush.verticalGradient(listOf(clear, solid), t - f, t),
                    Rect(l, b, r, b + f) to Brush.verticalGradient(listOf(solid, clear), b, b + f),
                    Rect(l - f, t, l, b) to Brush.horizontalGradient(listOf(clear, solid), l - f, l),
                    Rect(r, t, r + f, b) to Brush.horizontalGradient(listOf(solid, clear), r, r + f),
                    Rect(l - f, t - f, l, t) to Brush.radialGradient(listOf(solid, clear), Offset(l, t), f),
                    Rect(r, t - f, r + f, t) to Brush.radialGradient(listOf(solid, clear), Offset(r, t), f),
                    Rect(l - f, b, l, b + f) to Brush.radialGradient(listOf(solid, clear), Offset(l, b), f),
                    Rect(r, b, r + f, b + f) to Brush.radialGradient(listOf(solid, clear), Offset(r, b), f),
                )
            }
    }

    fun DrawScope.erase(strength: Float) {
        if (strength <= 0f || core.isEmpty) return
        val share = strength.coerceAtMost(1f)
        drawRect(Color.Black, core.topLeft, core.size, alpha = share, blendMode = BlendMode.DstOut)
        for (i in pieces.indices) {
            val (area, brush) = pieces[i]
            drawRect(brush, area.topLeft, Size(area.width, area.height), alpha = share, blendMode = BlendMode.DstOut)
        }
    }
}
