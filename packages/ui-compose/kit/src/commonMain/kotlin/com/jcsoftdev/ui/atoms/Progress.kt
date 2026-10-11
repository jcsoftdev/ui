package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

private const val SEGMENT = 0.4f

/** Colors of a [Progress] bar: the moving part and its track. */
@Immutable
public class ProgressColors(
    public val indicator: Color,
    public val track: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        indicator: Color = this.indicator,
        track: Color = this.track,
    ): ProgressColors = ProgressColors(indicator, track)
}

/** Default colors, height and shape of [Progress]. */
public object ProgressDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): ProgressColors {
        val c = UiTheme.colors
        return ProgressColors(c.accent, c.track)
    }

    /** Bar height. */
    public val height: Dp = 6.dp

    /** Pill shape of the track. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.pill
}

/** Determinate bar: [value] is clamped to 0..[max]. */
@Composable
public fun Progress(
    value: Float,
    modifier: Modifier = Modifier,
    max: Float = 100f,
    colors: ProgressColors = ProgressDefaults.colors(),
    height: Dp = ProgressDefaults.height,
    shape: Shape = ProgressDefaults.shape,
) {
    val fraction = progressFraction(value, max)
    val shown = animateFloatAsState(fraction, UiTheme.motion.tween(Motion.STANDARD), label = "progress")
    Bar(modifier, ProgressBarRangeInfo(fraction * max.coerceAtLeast(0f), 0f..max.coerceAtLeast(0f)), colors.track, height, shape) {
        drawRect(colors.indicator, size = Size(size.width * shown.value, size.height))
    }
}

/** Indeterminate bar; with animations removed in the system settings it shows a static segment. */
@Composable
public fun Progress(
    modifier: Modifier = Modifier,
    colors: ProgressColors = ProgressDefaults.colors(),
    height: Dp = ProgressDefaults.height,
    shape: Shape = ProgressDefaults.shape,
) {
    val phase = rememberLoopPhase(1400)
    Bar(modifier, ProgressBarRangeInfo.Indeterminate, colors.track, height, shape) {
        val x = (phase.value * (1f + SEGMENT) - SEGMENT) * size.width
        drawRect(colors.indicator, Offset(x, 0f), Size(size.width * SEGMENT, size.height))
    }
}

@Composable
private fun Bar(
    modifier: Modifier,
    info: ProgressBarRangeInfo,
    track: Color,
    height: Dp,
    shape: Shape,
    draw: androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit,
) {
    androidx.compose.foundation.layout.Box(
        modifier
            .semantics { progressBarRangeInfo = info }
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(track)
            .drawBehind(draw),
    )
}

internal fun progressFraction(
    value: Float,
    max: Float,
): Float = if (max <= 0f || value.isNaN()) 0f else (value / max).coerceIn(0f, 1f)
