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
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val MAX_SWELL = 0.12f

/** Spring motion runs only when the theme allows animation (the system animator scale is not 0) and the interaction has springs. */
internal fun liquidMotionActive(
    interaction: LiquidInteraction,
    motion: Motion,
): Boolean = interaction.motion != null && motion.enabled

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

/** The scale of a surface that never squashes (Press). */
private val Unsquashed: () -> Float = { 1f }

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
internal class Springs(
    motion: LiquidMotion?,
) {
    val press: SpringSpec<Float> = (motion?.press ?: LiquidMotion.Standard.press).spec()
    val follow: SpringSpec<Float> = (motion?.follow ?: LiquidMotion.Standard.follow).spec()
    val followOffset: SpringSpec<Offset> = (motion?.follow ?: LiquidMotion.Standard.follow).spec()
    val squashX: SpringSpec<Float> = (motion?.squashX ?: LiquidMotion.Standard.squashX).spec()
    val squashY: SpringSpec<Float> = (motion?.squashY ?: LiquidMotion.Standard.squashY).spec()
    val materialize: SpringSpec<Float> = (motion?.materialize ?: LiquidMotion.Standard.follow).spec()
}

/**
 * Press and spring motion cost springs, animatables and effects; a Liquid surface pays for them only when its [interaction] can
 * move it: a press source, a drag, or the materialize ramp. Without any of them the lift stays 0 and the lens at full strength.
 */
internal fun needsDynamics(
    interaction: LiquidInteraction,
    source: InteractionSource?,
    motion: Motion,
): Boolean =
    source != null ||
        interaction.drags ||
        (liquidMotionActive(interaction, motion) && interaction.motion?.materialize != null)

@Composable
internal fun rememberLiquidDynamics(
    interaction: LiquidInteraction,
    source: InteractionSource?,
): LiquidDynamics {
    val theme = UiTheme.motion
    val spec = interaction.motion
    val on = liquidMotionActive(interaction, theme)
    val drag = interaction.drags
    val springs = remember(spec) { Springs(spec) }
    val touch = remember { TouchState() }

    // The materialize ramp plays once for a surface instance: a LazyColumn that scrolls it away and back does not replay it.
    val materialized = rememberSaveable { mutableStateOf(false) }
    val ramps = on && spec?.materialize != null
    val lift = remember { Animatable(0f) }
    val materialize = remember { Animatable(if (ramps && !materialized.value) 0f else 1f) }
    val follow = remember { Animatable(0f) }
    val pointer = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val dragState = if (drag) remember { interaction.newDragState() } else null

    LaunchedEffect(on, spec) {
        if (ramps && materialize.value < 1f) {
            materialize.animateTo(1f, springs.materialize)
            materialized.value = true
        } else {
            materialize.snapTo(1f)
            if (ramps) materialized.value = true
        }
    }
    if (source != null) {
        LaunchedEffect(source, touch, dragState) {
            source.interactions.collect { interaction ->
                when (interaction) {
                    is PressInteraction.Press -> {
                        touch.pressPosition = interaction.pressPosition
                        if (dragState != null && !touch.pointerDown) dragState.pointer.value = interaction.pressPosition
                        touch.sourceDown = true
                    }
                    is PressInteraction.Release, is PressInteraction.Cancel -> touch.sourceDown = false
                    else -> Unit
                }
            }
        }
    }
    // Press and release drive the lift and the highlight from one place, whoever reports the finger.
    LaunchedEffect(on, spec, drag) {
        snapshotFlow { touch.touching }.collectLatest { down ->
            val animated = on && spec != null
            launch {
                if (animated) {
                    lift.animateTo(if (down) 1f else 0f, springs.press)
                } else {
                    lift.animateTo(if (down) 1f else 0f, snapOrTween(theme))
                }
            }
            if (down && animated) {
                if (!drag) {
                    if (follow.value < 0.01f) {
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
    if (dragState != null && on && spec != null) {
        LaunchedEffect(on, spec, dragState) { dragState.settle(springs) }
    }

    val observer =
        if (dragState != null) {
            remember(on, spec, dragState) { dragState.observer(touch, squashes = on && spec != null) }
        } else {
            Modifier
        }

    return remember(observer, on, dragState) {
        LiquidDynamics(
            lift = { lift.value },
            materialize = { materialize.value },
            pointer = { if (follow.value > 0.001f) (dragState?.pointer?.value ?: pointer.value) else null },
            follow = { follow.value },
            scaleX = if (dragState != null) ({ dragState.squashX.value }) else Unsquashed,
            scaleY = if (dragState != null) ({ dragState.squashY.value }) else Unsquashed,
            observer = observer,
            motionOn = on,
            touching = { touch.touching },
        )
    }
}

private fun snapOrTween(theme: Motion) = theme.tween<Float>(Motion.FAST)
