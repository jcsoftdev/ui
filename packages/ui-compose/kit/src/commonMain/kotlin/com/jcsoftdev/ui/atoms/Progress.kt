package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme

private const val SEGMENT = 0.4f

/** Determinate bar: [value] is clamped to 0..[max]. */
@Composable
public fun Progress(
    value: Float,
    modifier: Modifier = Modifier,
    max: Float = 100f,
) {
    val colors = UiTheme.colors
    val fraction = progressFraction(value, max)
    val shown = animateFloatAsState(fraction, UiTheme.motion.tween(Motion.STANDARD), label = "progress")
    Bar(modifier, ProgressBarRangeInfo(fraction * max.coerceAtLeast(0f), 0f..max.coerceAtLeast(0f))) {
        drawRect(colors.accent, size = Size(size.width * shown.value, size.height))
    }
}

/** Indeterminate bar; with animations removed in the system settings it shows a static segment. */
@Composable
public fun Progress(modifier: Modifier = Modifier) {
    val colors = UiTheme.colors
    val phase = rememberLoopPhase(1400)
    Bar(modifier, ProgressBarRangeInfo.Indeterminate) {
        val x = (phase.value * (1f + SEGMENT) - SEGMENT) * size.width
        drawRect(colors.accent, Offset(x, 0f), Size(size.width * SEGMENT, size.height))
    }
}

@Composable
private fun Bar(
    modifier: Modifier,
    info: ProgressBarRangeInfo,
    draw: androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit,
) {
    androidx.compose.foundation.layout.Box(
        modifier
            .semantics { progressBarRangeInfo = info }
            .fillMaxWidth()
            .height(6.dp)
            .clip(UiShapes.pill)
            .background(UiTheme.colors.track)
            .drawBehind(draw),
    )
}

internal fun progressFraction(
    value: Float,
    max: Float,
): Float = if (max <= 0f || value.isNaN()) 0f else (value / max).coerceIn(0f, 1f)
