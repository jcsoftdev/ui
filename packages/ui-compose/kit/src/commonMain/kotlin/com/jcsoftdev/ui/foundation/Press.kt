package com.jcsoftdev.ui.foundation

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.node.CompositionLocalConsumerModifierNode
import androidx.compose.ui.node.LayoutModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.currentValueOf
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Constraints
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Web `press-scale` token. */
public const val PRESSED_SCALE: Float = 0.97f

/**
 * Shrinks the content a little while pressed; hand it the same [interactionSource] given to the clickable that handles the tap.
 * Snaps instead of animating when [Motion.enabled] is false. The scale is read in the layer phase, so presses never recompose.
 */
public fun Modifier.pressScale(
    interactionSource: InteractionSource,
    pressedScale: Float = PRESSED_SCALE,
): Modifier = this then PressScaleElement(interactionSource, pressedScale)

private data class PressScaleElement(
    val interactionSource: InteractionSource,
    val pressedScale: Float,
) : ModifierNodeElement<PressScaleNode>() {
    override fun create() = PressScaleNode(interactionSource, pressedScale)

    override fun update(node: PressScaleNode) = node.update(interactionSource, pressedScale)

    override fun InspectorInfo.inspectableProperties() {
        name = "pressScale"
        properties["pressedScale"] = pressedScale
    }
}

private class PressScaleNode(
    private var source: InteractionSource,
    private var pressedScale: Float,
) : Modifier.Node(),
    LayoutModifierNode,
    CompositionLocalConsumerModifierNode {
    private val scale = Animatable(1f)
    private var job: Job? = null
    private var pressed = false

    override fun onAttach() = observe()

    override fun onDetach() {
        job?.cancel()
        pressed = false
    }

    fun update(
        source: InteractionSource,
        pressedScale: Float,
    ) {
        val sourceChanged = this.source != source
        this.source = source
        this.pressedScale = pressedScale
        if (sourceChanged) {
            job?.cancel()
            pressed = false
            observe()
        }
    }

    private fun observe() {
        job =
            coroutineScope.launch {
                scale.snapTo(1f)
                source.interactions.collect { interaction ->
                    when (interaction) {
                        is PressInteraction.Press -> animateTo(true)
                        is PressInteraction.Release, is PressInteraction.Cancel -> animateTo(false)
                    }
                }
            }
    }

    private suspend fun animateTo(down: Boolean) {
        if (pressed == down) return
        pressed = down
        val target = if (down) pressedScale else 1f
        val motion = currentValueOf(LocalMotion)
        if (motion.enabled) scale.animateTo(target, motion.tween(Motion.FAST)) else scale.snapTo(target)
    }

    override fun MeasureScope.measure(
        measurable: Measurable,
        constraints: Constraints,
    ): MeasureResult {
        val placeable = measurable.measure(constraints)
        return layout(placeable.width, placeable.height) {
            placeable.placeWithLayer(0, 0) {
                scaleX = scale.value
                scaleY = scale.value
            }
        }
    }
}
