package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.VectorConverter
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
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
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.tanh

/** A drag velocity (pixels per second) of this size is a full squash. */
internal const val VELOCITY_REFERENCE: Float = 3000f

private const val STRETCH_GAIN = 0.75f
private const val SQUASH_GAIN = 0.25f
private const val SQUASH_LIMIT = 0.2f
private const val MAX_SWELL = 0.12f

/** The scale a dragged surface aims for. */
internal data class Squash(
    val x: Float,
    val y: Float,
)

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

/** Pulls [value] toward a limit smoothly: linear near 0, never beyond [limit]. */
internal fun rubberBand(
    value: Float,
    limit: Float,
): Float = if (limit <= 0f) 0f else limit * tanh(value / limit)

/** The unit vector toward [pointer] from the center of a surface of [size], or null when it sits on the center. */
internal fun lightToward(
    pointer: Offset,
    width: Float,
    height: Float,
): Offset? {
    val dx = pointer.x - width / 2f
    val dy = pointer.y - height / 2f
    val length = hypot(dx, dy)
    return if (length < 0.5f) null else Offset(dx / length, dy / length)
}

/** Blends two light directions and renormalizes; [amount] 0 gives [from], 1 gives [to]. */
internal fun blendLight(
    from: Offset,
    to: Offset,
    amount: Float,
): Offset {
    val x = from.x + (to.x - from.x) * amount
    val y = from.y + (to.y - from.y) * amount
    val length = hypot(x, y)
    return if (length < 1e-4f) from else Offset(x / length, y / length)
}

/** Unit vector toward the light for an angle in degrees clockwise from 3 o'clock. */
internal fun lightFromAngle(degrees: Float): Offset {
    val radians = degrees * PI.toFloat() / 180f
    return Offset(cos(radians), sin(radians))
}

internal fun angleOf(
    x: Float,
    y: Float,
): Float = atan2(y, x) * 180f / PI.toFloat()

/** Spring motion runs only when the theme allows animation (the system animator scale is not 0) and the style has springs. */
internal fun liquidMotionActive(
    style: LiquidGlassStyle,
    motion: Motion,
): Boolean = style.motion != null && motion.enabled

/** How far a pressed surface swells: [swellPx] over its width, within [MAX_SWELL]. */
internal fun swellFraction(
    swellPx: Float,
    width: Float,
): Float = (swellPx / width.coerceAtLeast(1f)).coerceIn(0f, MAX_SWELL)

/**
 * Everything a Liquid surface reads in the draw and layer phases (never during composition, so touches do not recompose):
 * press [lift], the lens [materialize] amount, where the finger is ([pointer], null when there is none) and how strongly the
 * highlight follows it ([follow]), and the drag squash. [touching] is the one answer to "is a finger on it".
 */
internal class LiquidDynamics(
    val lift: () -> Float,
    val materialize: () -> Float,
    val pointer: () -> Offset?,
    val follow: () -> Float,
    val scaleX: () -> Float,
    val scaleY: () -> Float,
    val observer: Modifier,
    val motionOn: Boolean,
    val touching: () -> Boolean = { false },
)

/** The squash target at rest. */
private val SquashRest = Squash(1f, 1f)

/** How long a pointer may stay still, while down, before the squash relaxes (the velocity of a finger at rest is zero). */
internal const val STILL_MILLIS: Long = 60L

private fun Squash.quantized() = Squash((x * 100f).roundToInt() / 100f, (y * 100f).roundToInt() / 100f)

/**
 * Whether a finger is on the surface: the press the interaction source reports, or a pointer the Drag observer sees. The two
 * are never written into the animation separately; [touching] is the only thing the lift and the highlight follow.
 */
internal class TouchState {
    var sourceDown: Boolean by mutableStateOf(false)
    var pointerDown: Boolean by mutableStateOf(false)
    var pressPosition: Offset = Offset.Zero
    val touching: Boolean get() = sourceDown || pointerDown
}

// The springs of a motion spec, made once instead of on every pointer move.
private class Springs(
    motion: LiquidMotion?,
) {
    val press: SpringSpec<Float> = (motion?.press ?: LiquidMotion.Standard.press).spec()
    val follow: SpringSpec<Float> = (motion?.follow ?: LiquidMotion.Standard.follow).spec()
    val followOffset: SpringSpec<Offset> = (motion?.follow ?: LiquidMotion.Standard.follow).spec()
    val squashX: SpringSpec<Float> = (motion?.squashX ?: LiquidMotion.Standard.squashX).spec()
    val squashY: SpringSpec<Float> = (motion?.squashY ?: LiquidMotion.Standard.squashY).spec()
    val materialize: SpringSpec<Float> = (motion?.materialize ?: LiquidMotion.Standard.follow).spec()
}

@Composable
internal fun rememberLiquidDynamics(
    style: LiquidGlassStyle,
    source: InteractionSource?,
): LiquidDynamics {
    val theme = UiTheme.motion
    val spec = style.motion
    val on = liquidMotionActive(style, theme)
    val drag = style.interaction == LiquidInteraction.Drag
    val springs = remember(spec) { Springs(spec) }
    val touch = remember { TouchState() }

    // The materialize ramp plays once for a surface instance: a LazyColumn that scrolls it away and back does not replay it.
    val materialized = rememberSaveable { mutableStateOf(false) }
    val ramps = on && spec?.materialize != null
    val lift = remember { Animatable(0f) }
    val materialize = remember { Animatable(if (ramps && !materialized.value) 0f else 1f) }
    val follow = remember { Animatable(0f) }
    val pointer = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val dragPointer = remember { mutableStateOf(Offset.Zero) }
    val squashX = remember { Animatable(1f) }
    val squashY = remember { Animatable(1f) }
    val squashTarget = remember { MutableStateFlow(SquashRest) }

    LaunchedEffect(on, spec) {
        if (ramps && materialize.value < 1f) {
            materialize.animateTo(1f, springs.materialize)
            materialized.value = true
        } else {
            materialize.snapTo(1f)
            if (ramps) materialized.value = true
        }
    }
    LaunchedEffect(source, touch, drag) {
        source?.interactions?.collect { interaction ->
            when (interaction) {
                is PressInteraction.Press -> {
                    touch.pressPosition = interaction.pressPosition
                    if (drag && !touch.pointerDown) dragPointer.value = interaction.pressPosition
                    touch.sourceDown = true
                }
                is PressInteraction.Release, is PressInteraction.Cancel -> touch.sourceDown = false
                else -> Unit
            }
        }
    }
    // Press and release drive the lift and the highlight from one place, whoever reports the finger.
    LaunchedEffect(on, spec, drag) {
        snapshotFlow { touch.touching }.collectLatest { down ->
            val animated = on && spec != null
            launch {
                if (animated) {
                    lift.animateTo(
                        if (down) 1f else 0f,
                        springs.press,
                    )
                } else {
                    lift.animateTo(if (down) 1f else 0f, snapOrTween(theme))
                }
            }
            if (down && animated) {
                if (!drag) {
                    if (follow.value <
                        0.01f
                    ) {
                        pointer.snapTo(touch.pressPosition)
                    } else {
                        launch { pointer.animateTo(touch.pressPosition, springs.followOffset) }
                    }
                }
                follow.animateTo(1f, springs.follow)
            } else if (!down) {
                follow.animateTo(0f, springs.follow)
            }
        }
    }
    // The squash target follows the velocity (one collector, no coroutine per pointer move) and relaxes when the finger rests.
    LaunchedEffect(on, spec, drag) {
        if (!drag || !on || spec == null) return@LaunchedEffect
        squashTarget.collectLatest { target ->
            coroutineScope {
                launch { squashX.animateTo(target.x, springs.squashX) }
                launch { squashY.animateTo(target.y, springs.squashY) }
                if (target != SquashRest) {
                    delay(STILL_MILLIS)
                    squashTarget.value = SquashRest
                }
            }
        }
    }

    val observer =
        if (drag) {
            remember(on, spec) {
                Modifier.observePointer { position, velocity, down ->
                    touch.pointerDown = down
                    if (down) dragPointer.value = position
                    if (on && spec != null) {
                        squashTarget.value =
                            if (down) {
                                squashFor(
                                    velocity.x / VELOCITY_REFERENCE,
                                    velocity.y / VELOCITY_REFERENCE,
                                ).quantized()
                            } else {
                                SquashRest
                            }
                    }
                }
            }
        } else {
            Modifier
        }

    return remember(observer, on, drag) {
        LiquidDynamics(
            lift = { lift.value },
            materialize = { materialize.value },
            pointer = { if (follow.value > 0.001f) (if (drag) dragPointer.value else pointer.value) else null },
            follow = { follow.value },
            scaleX = { squashX.value },
            scaleY = { squashY.value },
            observer = observer,
            motionOn = on,
            touching = { touch.touching },
        )
    }
}

private fun snapOrTween(theme: Motion) = theme.tween<Float>(Motion.FAST)

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
