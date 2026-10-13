package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.VectorConverter
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
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
 * highlight follows it ([follow]), and the drag squash.
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
)

@Composable
internal fun rememberLiquidDynamics(
    style: LiquidGlassStyle,
    source: InteractionSource?,
): LiquidDynamics {
    val theme = UiTheme.motion
    val spec = style.motion
    val on = liquidMotionActive(style, theme)
    val scope = rememberCoroutineScope()

    var touching by remember { mutableStateOf(false) }
    val lift = remember { Animatable(0f) }
    val materialize = remember { Animatable(if (on && spec?.materialize != null) 0f else 1f) }
    val follow = remember { Animatable(0f) }
    val pointer = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val squashX = remember { Animatable(1f) }
    val squashY = remember { Animatable(1f) }

    LaunchedEffect(touching, on, spec) {
        val target = if (touching) 1f else 0f
        if (on && spec != null) lift.animateTo(target, spec.press.spec()) else lift.animateTo(target, snapOrTween(theme))
    }
    LaunchedEffect(on, spec) {
        val materializer = spec?.materialize
        if (on && materializer != null) materialize.animateTo(1f, materializer.spec()) else materialize.snapTo(1f)
    }
    LaunchedEffect(source, on, spec) {
        source?.interactions?.collect { interaction ->
            when (interaction) {
                is PressInteraction.Press -> {
                    touching = true
                    if (on && spec != null) {
                        if (follow.value <
                            0.01f
                        ) {
                            pointer.snapTo(interaction.pressPosition)
                        } else {
                            pointer.animateTo(interaction.pressPosition, spec.follow.spec())
                        }
                        launch { follow.animateTo(1f, spec.follow.spec()) }
                    }
                }
                is PressInteraction.Release, is PressInteraction.Cancel -> {
                    touching = false
                    follow.animateTo(0f, (spec?.follow ?: LiquidMotion.Standard.follow).spec())
                }
                else -> Unit
            }
        }
    }

    val observer =
        if (style.interaction == LiquidInteraction.Drag) {
            remember(on, spec) {
                Modifier.observePointer { position, velocity, pressed ->
                    touching = pressed
                    if (!on || spec == null) return@observePointer
                    scope.launch {
                        if (pressed) {
                            pointer.snapTo(position)
                            follow.animateTo(1f, spec.follow.spec())
                        } else {
                            follow.animateTo(0f, spec.follow.spec())
                        }
                    }
                    val target =
                        if (pressed) {
                            squashFor(
                                velocity.x / VELOCITY_REFERENCE,
                                velocity.y / VELOCITY_REFERENCE,
                            )
                        } else {
                            Squash(1f, 1f)
                        }
                    scope.launch { squashX.animateTo(target.x, spec.squashX.spec()) }
                    scope.launch { squashY.animateTo(target.y, spec.squashY.spec()) }
                }
            }
        } else {
            Modifier
        }

    return remember(observer, on) {
        LiquidDynamics(
            lift = { lift.value },
            materialize = { materialize.value },
            pointer = { if (follow.value > 0.001f) pointer.value else null },
            follow = { follow.value },
            scaleX = { squashX.value },
            scaleY = { squashY.value },
            observer = observer,
            motionOn = on,
        )
    }
}

private fun snapOrTween(theme: Motion) = theme.tween<Float>(Motion.FAST)

// Reads pointer events on the way down without consuming them, and keeps sharing them with siblings, so the surface can be
// dragged by whatever handles the gesture while it squashes. Velocity is measured in root coordinates: a surface dragged by its
// own finger does not move in its own space.
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

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        this.coordinates = coordinates
    }

    override fun onPointerEvent(
        pointerEvent: PointerEvent,
        pass: PointerEventPass,
        bounds: IntSize,
    ) {
        if (pass != PointerEventPass.Initial) return
        val change = pointerEvent.changes.firstOrNull() ?: return
        val root = coordinates?.takeIf { it.isAttached }?.localToRoot(change.position) ?: change.position
        when (pointerEvent.type) {
            PointerEventType.Press -> {
                tracker.resetTracking()
                tracker.addPosition(change.uptimeMillis, root)
                onChange(change.position, Offset.Zero, true)
            }
            PointerEventType.Move ->
                if (change.pressed) {
                    tracker.addPosition(change.uptimeMillis, root)
                    val v = tracker.calculateVelocity()
                    onChange(change.position, Offset(v.x, v.y), true)
                }
            PointerEventType.Release -> onChange(change.position, Offset.Zero, false)
            else -> Unit
        }
    }

    override fun onCancelPointerInput() {
        onChange(Offset.Zero, Offset.Zero, false)
    }

    override fun sharePointerInputWithSiblings(): Boolean = true
}
