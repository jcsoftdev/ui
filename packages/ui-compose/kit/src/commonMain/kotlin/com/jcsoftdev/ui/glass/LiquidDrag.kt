package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.PointerInputModifierNode
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/** A drag velocity (pixels per second) of this size is a full squash. */
internal const val VELOCITY_REFERENCE: Float = 3000f

private const val STRETCH_GAIN = 0.75f
private const val SQUASH_GAIN = 0.25f
private const val SQUASH_LIMIT = 0.2f

/** How long a pointer may stay still, while down, before the squash relaxes (the velocity of a finger at rest is zero). */
internal const val STILL_MILLIS: Long = 60L

/** The scale a dragged surface aims for. */
internal data class Squash(
    val x: Float,
    val y: Float,
)

/** The squash target at rest. */
private val SquashRest = Squash(1f, 1f)

/**
 * Stretch along the direction of motion and squash across it, from velocities already divided by [VELOCITY_REFERENCE] (and
 * clamped to -1..1 here). Each axis stretches by 1 / (1 - 0.75 v) and is squashed by (1 - 0.25 v) for the velocity on the other
 * axis, all within 20%.
 */
internal fun squashFor(
    velocityX: Float,
    velocityY: Float,
): Squash {
    val vx = abs(velocityX).coerceIn(0f, 1f)
    val vy = abs(velocityY).coerceIn(0f, 1f)

    fun stretch(v: Float) = 1f / (1f - (v * STRETCH_GAIN).coerceAtMost(SQUASH_LIMIT))

    fun squash(v: Float) = 1f - (v * SQUASH_GAIN).coerceAtMost(SQUASH_LIMIT)
    return Squash(stretch(vx) * squash(vy), stretch(vy) * squash(vx))
}

private fun Squash.quantized() = Squash((x * 100f).roundToInt() / 100f, (y * 100f).roundToInt() / 100f)

/**
 * What only a [LiquidInteraction.Drag] surface tracks: the finger position, the squash springs and the pointer observer that
 * feeds them. Made by [LiquidInteraction.Drag] alone, so an app without a drag surface ships none of it.
 */
internal class DragState {
    val pointer = mutableStateOf(Offset.Zero)
    val squashX = Animatable(1f)
    val squashY = Animatable(1f)
    private val target = MutableStateFlow(SquashRest)

    // The squash target follows the velocity (one collector, no coroutine per pointer move) and relaxes when the finger rests.
    suspend fun settle(springs: Springs) {
        target.collectLatest { aim ->
            coroutineScope {
                launch { squashX.animateTo(aim.x, springs.squashX) }
                launch { squashY.animateTo(aim.y, springs.squashY) }
                if (aim != SquashRest) {
                    delay(STILL_MILLIS)
                    target.value = SquashRest
                }
            }
        }
    }

    /** The observer that reports the finger to [touch] and, when [squashes], aims the squash at its velocity. */
    fun observer(
        touch: TouchState,
        squashes: Boolean,
    ): Modifier =
        Modifier.observePointer { position, velocity, down ->
            touch.pointerDown = down
            if (down) pointer.value = position
            if (squashes) {
                target.value =
                    if (down) {
                        squashFor(velocity.x / VELOCITY_REFERENCE, velocity.y / VELOCITY_REFERENCE).quantized()
                    } else {
                        SquashRest
                    }
            }
        }
}

// Reads pointer events without consuming them, and keeps sharing them with siblings, so the surface can be dragged by whatever
// handles the gesture while it squashes. Velocity is measured in root coordinates: a surface dragged by its own finger does not
// move in its own space.
//
// The gesture is the pointers together: it begins with the first finger and ends when the last one lifts; the position and
// velocity follow one finger at a time (the next one takes over when it lifts). It is watched in the Final pass, after the
// handlers had their turn, to tell a drag of this surface from a scroll: movement consumed by a handler *outside* it (a scroll
// container) ends the squash for the rest of that gesture, while movement consumed by the surface's own handlers (placed after
// `material`, or in its content) is a drag.
private fun Modifier.observePointer(onChange: (Offset, Offset, Boolean) -> Unit): Modifier = this then PointerObserverElement(onChange)

private class PointerObserverElement(
    val onChange: (Offset, Offset, Boolean) -> Unit,
) : ModifierNodeElement<PointerObserverNode>() {
    override fun create() = PointerObserverNode(onChange)

    override fun update(node: PointerObserverNode) {
        node.onChange = onChange
    }

    override fun equals(other: Any?) = other is PointerObserverElement && other.onChange == onChange

    override fun hashCode() = onChange.hashCode()

    override fun InspectorInfo.inspectableProperties() {
        name = "liquidPointer"
    }
}

private class PointerObserverNode(
    var onChange: (Offset, Offset, Boolean) -> Unit,
) : Modifier.Node(),
    PointerInputModifierNode,
    GlobalPositionAwareModifierNode {
    private val tracker = VelocityTracker()
    private var coordinates: LayoutCoordinates? = null
    private var primary = NO_POINTER
    private var consumedBeforeUs = false
    private var yielded = false

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        this.coordinates = coordinates
    }

    override fun onPointerEvent(
        pointerEvent: PointerEvent,
        pass: PointerEventPass,
        bounds: IntSize,
    ) {
        when (pass) {
            // Main runs inner to outer: whatever is consumed by now was consumed inside this surface.
            PointerEventPass.Main -> consumedBeforeUs = pointerEvent.changes.firstOrNull { it.id.value == primary }?.isConsumed == true
            PointerEventPass.Final -> observe(pointerEvent)
            else -> Unit
        }
    }

    private fun observe(event: PointerEvent) {
        val changes = event.changes
        if (changes.none { it.pressed }) {
            endGesture()
            return
        }
        if (yielded) return
        var lead = changes.firstOrNull { it.id.value == primary && it.pressed }
        val taken = lead == null
        if (lead == null) {
            lead = changes.first { it.pressed }
            primary = lead.id.value
            tracker.resetTracking()
        }
        val root = coordinates?.takeIf { it.isAttached }?.localToRoot(lead.position) ?: lead.position
        if (taken) {
            tracker.addPosition(lead.uptimeMillis, root)
            onChange(lead.position, Offset.Zero, true)
            return
        }
        if (event.type == PointerEventType.Move) {
            if (lead.isConsumed && !consumedBeforeUs) {
                yielded = true
                onChange(Offset.Zero, Offset.Zero, false)
                return
            }
            tracker.addPosition(lead.uptimeMillis, root)
            val v = tracker.calculateVelocity()
            onChange(lead.position, Offset(v.x, v.y), true)
        }
    }

    private fun endGesture() {
        if (primary == NO_POINTER && !yielded) return
        primary = NO_POINTER
        yielded = false
        consumedBeforeUs = false
        onChange(Offset.Zero, Offset.Zero, false)
    }

    override fun onCancelPointerInput() = endGesture()

    override fun sharePointerInputWithSiblings(): Boolean = true

    private companion object {
        const val NO_POINTER = Long.MIN_VALUE
    }
}
