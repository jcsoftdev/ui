package com.jcsoftdev.ui.auth

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of [AuthArcs]: the resting [arc], the [highlight] that sweeps along them on success, and the [error] tint. */
@Immutable
public class AuthArcsColors(
    public val arc: Color,
    public val highlight: Color,
    public val error: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        arc: Color = this.arc,
        highlight: Color = this.highlight,
        error: Color = this.error,
    ): AuthArcsColors = AuthArcsColors(arc, highlight, error)
}

/** Default colors and metrics of [AuthArcs]; the arcs follow the content color of the header they sit in. */
public object AuthArcsDefaults {
    /** Arcs tinted by the surrounding content color (the header text color inside an [AuthScaffold]) and the accent; errors use the danger color. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthArcsColors {
        val c = UiTheme.colors
        val content = LocalContentColor.current.let { if (it == Color.Unspecified) c.ink else it }
        return AuthArcsColors(lerp(content, c.accent, 0.4f), content, c.danger)
    }

    /** Number of concentric arcs. */
    public const val RingCount: Int = 5

    /** Stroke width of every arc. */
    public val strokeWidth: Dp = 1.dp
}

/**
 * Thin concentric arcs sweeping the top-right corner of its box, the default header art of [AuthScaffold]. One static frame
 * is drawn from [state] and [progress]: brightness and length follow [AuthProgress.emphasis] and [AuthProgress.sweepDegrees],
 * the password field turns the arcs, an error tints them with the danger color and success draws them in the highlight color.
 * Decorative: hidden from accessibility.
 *
 * Motion is not wired yet. The place for it is the [AuthArcsFrame] values below: drift, jitter, flash and sweep are meant to
 * replace those constants, gated on `UiTheme.motion.enabled` (the static frame stays the reduced-motion look).
 */
@Composable
public fun AuthArcs(
    state: AuthState,
    progress: Float,
    modifier: Modifier = Modifier,
    colors: AuthArcsColors = AuthArcsDefaults.colors(),
    ringCount: Int = AuthArcsDefaults.RingCount,
    strokeWidth: Dp = AuthArcsDefaults.strokeWidth,
) {
    val frame = AuthArcsFrame.of(state, progress)
    Canvas(modifier.clearAndSetSemantics {}) {
        val centerX = size.width * 0.98f + frame.offsetDp.dp.toPx()
        val centerY = size.height * 0.04f
        val first = size.width * 0.28f
        val step = size.width * 0.1f
        val stroke = Stroke(strokeWidth.toPx(), cap = StrokeCap.Round)
        for (i in 0 until ringCount) {
            val radius = first + i * step
            val start = 90f + frame.turnDegrees
            val alpha = (frame.emphasis * (1f - i * 0.13f)).coerceIn(0f, 1f)
            val color = if (frame.highlighted) colors.highlight else lerp(colors.arc, colors.error, frame.errorTint).copy(alpha = alpha)
            drawArc(
                color,
                start,
                frame.sweepDegrees,
                false,
                Offset(centerX - radius, centerY - radius),
                Size(radius * 2, radius * 2),
                style = stroke,
            )
        }
    }
}

/** What one frame of [AuthArcs] shows; the values a motion layer animates (offset, turn, tint) sit here. */
internal class AuthArcsFrame(
    val emphasis: Float,
    val sweepDegrees: Float,
    val turnDegrees: Float,
    val offsetDp: Float,
    val errorTint: Float,
    val highlighted: Boolean,
) {
    companion object {
        fun of(
            state: AuthState,
            progress: Float,
        ): AuthArcsFrame =
            AuthArcsFrame(
                emphasis = AuthProgress.emphasis(state, progress),
                sweepDegrees = AuthProgress.sweepDegrees(progress),
                turnDegrees = if (state == AuthState.Password) 14f else 0f,
                offsetDp = 0f,
                errorTint = if (state == AuthState.Error) 1f else 0f,
                highlighted = state == AuthState.Success,
            )
    }
}
