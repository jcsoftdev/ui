package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** A spring in the units Compose uses. */
@Immutable
public data class LiquidSpring(
    val dampingRatio: Float,
    val stiffness: Float,
) {
    internal fun <T> spec(): SpringSpec<T> = spring(dampingRatio, stiffness)

    internal fun <T> spec(visibilityThreshold: T): SpringSpec<T> = spring(dampingRatio, stiffness, visibilityThreshold)
}

/**
 * The springs and amounts of the Liquid motion. All of it is disabled when the theme motion is off (the system animator
 * scale is 0); only the press brightening stays, without animation.
 *
 * @param press press lift (brightening, swell, glow) on and off.
 * @param follow the highlight that follows the finger.
 * @param squashX spring of the horizontal stretch while dragging and its jelly settle.
 * @param squashY spring of the vertical squash; deliberately not the same as [squashX] so the settle wobbles.
 * @param materialize how the lens grows from nothing to its refraction when the surface first appears; null skips it.
 * @param swell how much wider a pressed surface becomes.
 * @param glow opacity of the radial touch glow at the finger.
 */
@Immutable
public data class LiquidMotion(
    val press: LiquidSpring = LiquidSpring(0.74f, 600f),
    val follow: LiquidSpring = LiquidSpring(0.8f, 260f),
    val squashX: LiquidSpring = LiquidSpring(0.6f, 250f),
    val squashY: LiquidSpring = LiquidSpring(0.7f, 250f),
    val materialize: LiquidSpring? = LiquidSpring(0.8f, 180f),
    val swell: Dp = 16.dp,
    val glow: Float = 0.15f,
) {
    public companion object {
        /** Quick, well damped, a little jelly. */
        public val Standard: LiquidMotion = LiquidMotion()

        /** Softer springs: a longer, more visible wobble after a drag. */
        public val Playful: LiquidMotion get() = PlayfulMotion.value
    }
}

/**
 * How a Liquid surface reacts to touch: [LiquidGlass.interaction]. A surface without one is static and carries none of the
 * motion code. The press of a surface comes from the `interactionSource` passed to `material` or `MaterialSurface`.
 */
@Immutable
public sealed class LiquidInteraction {
    /** The springs; null disables the spring motion (the press still brightens, and the lens does not materialize). */
    public abstract val motion: LiquidMotion?

    /** True for [Drag]: the surface observes the pointer and squashes with its velocity. */
    internal open val drags: Boolean get() = false

    /** The pointer and squash state of a [Drag] surface; only [Drag] makes one. */
    internal open fun newDragState(): DragState? = null

    /**
     * Lifts while pressed (needs the `interactionSource` of the surface): brightening, swell, touch glow, highlight toward the
     * finger. With [motion] on, the lens also materializes when the surface first appears.
     */
    @Immutable
    public data class Press(
        override val motion: LiquidMotion? = LiquidMotion.Standard,
    ) : LiquidInteraction()

    /**
     * [Press] plus a velocity squash and jelly settle while the surface is dragged (the pointer is observed, never consumed). The
     * squash follows drags handled by the surface or its content (a drag handler placed after `material`); movement consumed by
     * a handler outside it, such as a scroll container, hands the gesture over and ends the touch. The squash relaxes when the
     * finger rests, and the touch lasts until the last finger lifts.
     */
    @Immutable
    public data class Drag(
        override val motion: LiquidMotion? = LiquidMotion.Standard,
    ) : LiquidInteraction() {
        override val drags: Boolean get() = true

        override fun newDragState(): DragState = DragState()
    }
}
