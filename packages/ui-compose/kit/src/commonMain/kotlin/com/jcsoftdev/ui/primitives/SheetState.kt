package com.jcsoftdev.ui.primitives

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.animate
import androidx.compose.foundation.gestures.DraggableState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme

/**
 * Drag-to-dismiss behaviour of a bottom sheet, free of any visuals. The sheet follows the finger downwards ([offset]),
 * and on release it either asks to be dismissed ([shouldDismiss]) or settles back to rest ([settle]).
 *
 * Use it with [sheetDraggable] on the handle or header and [sheetTranslation] on the surface; [scrimAlpha] fades a scrim
 * while the sheet is dragged away.
 *
 * ```
 * val state = rememberSheetState()
 * val presence = rememberOverlayPresence(open)
 * ModalLayer(open, { open = false }, scrim = { tap -> MyScrim(tap, state.scrimAlpha(presence.progress)) }) {
 *     Column(Modifier.align(Alignment.BottomCenter).sheetTranslation(state) { presence.progress }) {
 *         MyHandle(Modifier.sheetDraggable(state, onDismissRequest = { open = false }, isOpen = { open }))
 *         MyBody()
 *     }
 * }
 * ```
 */
@Stable
public class SheetState(
    /** Share of the sheet height that, once dragged past, dismisses it on release. */
    public val dismissFraction: Float = DEFAULT_DISMISS_FRACTION,
    /** Downward fling speed (px/s) that dismisses regardless of distance. */
    public val dismissVelocity: Float = DEFAULT_DISMISS_VELOCITY,
    settleSpec: AnimationSpec<Float>? = null,
) {
    init {
        require(dismissFraction in 0f..1f) { "dismissFraction must be within 0..1" }
    }

    /** Spec used by [settle]; [rememberSheetState] keeps it in sync with the theme motion. */
    public var settleSpec: AnimationSpec<Float>? = settleSpec

    /** How far the sheet is dragged down, in px; never negative. */
    public var offset: Float by mutableFloatStateOf(0f)
        private set

    /** Measured height of the sheet surface, in px; 0 until [sheetTranslation] measured it. */
    public var height: Float by mutableFloatStateOf(0f)
        private set

    internal val draggable = DraggableState { dragBy(it) }

    /** Dragged share of the height, 0 to 1. */
    public val dragFraction: Float get() = if (height > 0f) (offset / height).coerceIn(0f, 1f) else 0f

    /** Scrim opacity for an overlay at [presence] (0 to 1): fades as the sheet is dragged away. */
    public fun scrimAlpha(presence: Float): Float = presence * (1f - dragFraction)

    /** Records the measured height; [sheetTranslation] calls this. */
    public fun updateHeight(px: Float) {
        height = px.coerceAtLeast(0f)
    }

    /** Moves the sheet by [delta] px, never above its rest position. */
    public fun dragBy(delta: Float) {
        offset = (offset + delta).coerceAtLeast(0f)
    }

    /** True when releasing now with [velocity] (px/s, positive downward) should dismiss the sheet. */
    public fun shouldDismiss(velocity: Float): Boolean = offset > height * dismissFraction || velocity > dismissVelocity

    /** Puts the sheet back at rest without animating. */
    public fun reset() {
        offset = 0f
    }

    /** Animates [offset] back to 0 with [settleSpec]. */
    public suspend fun settle() {
        val spec = settleSpec
        if (spec == null) {
            reset()
        } else {
            animate(offset, 0f, animationSpec = spec) { value, _ -> offset = value }
        }
    }

    /**
     * What to do when the finger lifts: call [onDismissRequest] when [shouldDismiss], give the parent two frames to close
     * the sheet, and settle back to rest if it is still [isOpen] (the parent refused to close it).
     */
    public suspend fun onDragStopped(
        velocity: Float,
        onDismissRequest: () -> Unit,
        isOpen: () -> Boolean = { true },
    ) {
        if (shouldDismiss(velocity)) {
            onDismissRequest()
            withFrameNanos { }
            withFrameNanos { }
        }
        if (isOpen()) settle()
    }

    public companion object {
        public const val DEFAULT_DISMISS_FRACTION: Float = 0.35f
        public const val DEFAULT_DISMISS_VELOCITY: Float = 1200f
    }
}

/** Remembers a [SheetState]; with no [settleSpec] it settles with the theme standard motion. */
@Composable
public fun rememberSheetState(
    dismissFraction: Float = SheetState.DEFAULT_DISMISS_FRACTION,
    dismissVelocity: Float = SheetState.DEFAULT_DISMISS_VELOCITY,
    settleSpec: AnimationSpec<Float>? = null,
): SheetState {
    val motion = UiTheme.motion
    val spec = settleSpec ?: remember(motion) { motion.tween<Float>(Motion.STANDARD) }
    val state = remember(dismissFraction, dismissVelocity) { SheetState(dismissFraction, dismissVelocity, spec) }
    state.settleSpec = spec
    return state
}

/**
 * Vertical drag on this node (the handle or header) that drives [state]; releasing follows [SheetState.onDragStopped].
 *
 * ```
 * Box(Modifier.fillMaxWidth().sheetDraggable(state, onDismissRequest = { open = false }, isOpen = { open })) { Handle() }
 * ```
 */
public fun Modifier.sheetDraggable(
    state: SheetState,
    onDismissRequest: () -> Unit,
    enabled: Boolean = true,
    isOpen: () -> Boolean = { true },
): Modifier =
    draggable(
        state = state.draggable,
        orientation = Orientation.Vertical,
        enabled = enabled,
        onDragStopped = { velocity -> state.onDragStopped(velocity, onDismissRequest, isOpen) },
    )

/**
 * Slides the sheet surface: fully off the bottom at `presence() == 0`, at rest at 1, plus the current drag. It also feeds
 * the measured height into [state]. [presence] is read in the layer block, so animating it does not recompose.
 *
 * ```
 * Column(Modifier.sheetTranslation(state) { presence.progress }) { ... }
 * ```
 */
public fun Modifier.sheetTranslation(
    state: SheetState,
    presence: () -> Float,
): Modifier =
    this
        .graphicsLayer { translationY = (1f - presence()) * state.height + state.offset }
        .onSizeChanged { state.updateHeight(it.height.toFloat()) }
