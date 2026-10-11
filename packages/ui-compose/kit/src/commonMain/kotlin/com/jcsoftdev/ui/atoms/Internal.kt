package com.jcsoftdev.ui.atoms

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.node.LayoutModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.pressScale
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.max

/** Web `disabled:opacity-45`. */
internal const val DISABLED_ALPHA = 0.45f

private val MinTouchTarget = 48.dp

/** Grows the measured size to at least 48dp in each axis and centers the content, so the hit area stays accessible. */
internal fun Modifier.minimumTouchTarget(): Modifier = this then MinTouchTargetElement

private object MinTouchTargetElement : ModifierNodeElement<MinTouchTargetNode>() {
    override fun create() = MinTouchTargetNode()

    override fun update(node: MinTouchTargetNode) = Unit

    override fun hashCode(): Int = 48

    override fun equals(other: Any?): Boolean = other === this

    override fun InspectorInfo.inspectableProperties() {
        name = "minimumTouchTarget"
    }
}

private class MinTouchTargetNode :
    Modifier.Node(),
    LayoutModifierNode {
    override fun MeasureScope.measure(
        measurable: Measurable,
        constraints: Constraints,
    ): MeasureResult {
        val placeable = measurable.measure(constraints)
        val min = MinTouchTarget.roundToPx()
        val width = constraints.constrainWidth(max(placeable.width, min))
        val height = constraints.constrainHeight(max(placeable.height, min))
        return layout(width, height) {
            placeable.place((width - placeable.width) / 2, (height - placeable.height) / 2)
        }
    }
}

/** Click target with the 48dp minimum and press scale; place it first so the hit area wraps the visuals. */
internal fun Modifier.pressableTarget(
    onClick: () -> Unit,
    enabled: Boolean,
    role: Role,
    interactionSource: MutableInteractionSource,
): Modifier =
    this
        .clickable(interactionSource = interactionSource, indication = null, enabled = enabled, role = role, onClick = onClick)
        .minimumTouchTarget()
        .pressScale(interactionSource)

/** A 0..1 phase that loops while motion is on; a constant when animations are removed. Read it in draw lambdas only. */
@Composable
internal fun rememberLoopPhase(durationMillis: Int): State<Float> {
    if (!UiTheme.motion.enabled) return remember { mutableFloatStateOf(0f) }
    val transition = rememberInfiniteTransition(label = "loop")
    return transition.animateFloat(
        0f,
        1f,
        infiniteRepeatable(tween(durationMillis, easing = LinearEasing), RepeatMode.Restart),
        label = "phase",
    )
}

/** Private stand-in until C4 ships the icon set. */
internal fun DrawScope.drawCheckGlyph(
    color: Color,
    strokeWidth: Float,
) {
    val path =
        Path().apply {
            moveTo(size.width * 0.28f, size.height * 0.52f)
            lineTo(size.width * 0.43f, size.height * 0.67f)
            lineTo(size.width * 0.72f, size.height * 0.36f)
        }
    drawPath(path, color, style = Stroke(strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round))
}

internal fun DrawScope.drawMinusGlyph(
    color: Color,
    strokeWidth: Float,
) {
    drawLine(color, Offset(size.width * 0.3f, size.height / 2), Offset(size.width * 0.7f, size.height / 2), strokeWidth, StrokeCap.Round)
}
