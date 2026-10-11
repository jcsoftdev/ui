package com.jcsoftdev.ui.primitives

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.foundation.UiEasing
import com.jcsoftdev.ui.theme.UiTheme

/** Enter and exit timing of an overlay. The active [com.jcsoftdev.ui.foundation.Motion] scale still stretches both. */
@Immutable
public class OverlayMotion(
    public val enterMillis: Int = Motion.STANDARD,
    public val exitMillis: Int = Motion.FAST,
    public val easing: Easing = UiEasing,
) {
    override fun equals(other: Any?): Boolean =
        other is OverlayMotion && other.enterMillis == enterMillis && other.exitMillis == exitMillis && other.easing == easing

    override fun hashCode(): Int = 31 * (31 * enterMillis + exitMillis) + easing.hashCode()

    public companion object {
        /** The kit default: 180ms in, 100ms out. */
        public val Default: OverlayMotion = OverlayMotion()
    }
}

/**
 * Animated visibility of an overlay: [progress] runs 0 to 1 on enter and back on exit, and [present] stays true until the
 * exit finished, so the layer can stay composed while it animates out. Read [progress] in draw or layer lambdas only.
 */
@Stable
public class OverlayPresence internal constructor() {
    internal val shown = Animatable(0f)

    /** 0 hidden, 1 fully shown. */
    public val progress: Float get() = shown.value

    /** True from the moment the overlay opens until its exit animation ended. */
    public var present: Boolean by mutableStateOf(false)
        internal set
}

/**
 * Drives an [OverlayPresence] from [visible]. Durations come from [motion] and are scaled by the motion of the nearest
 * `UiTheme`, so reduced motion makes enter and exit a jump cut. Without a `UiTheme` it uses the default motion (full speed,
 * no system scale), so the primitive works on its own.
 *
 * ```
 * val presence = rememberOverlayPresence(open, OverlayMotion(enterMillis = 240, exitMillis = 120))
 * OverlayLayer(visible = presence.present) { Box(Modifier.graphicsLayer { alpha = presence.progress }) { ... } }
 * ```
 */
@Composable
public fun rememberOverlayPresence(
    visible: Boolean,
    motion: OverlayMotion = OverlayMotion.Default,
): OverlayPresence {
    val theme = UiTheme.motion
    val presence = remember { OverlayPresence().also { it.present = visible } }
    LaunchedEffect(visible, motion, theme) {
        if (visible) {
            presence.present = true
            presence.shown.animateTo(1f, theme.tween(motion.enterMillis, motion.easing))
        } else {
            presence.shown.animateTo(0f, theme.tween(motion.exitMillis, motion.easing))
            presence.present = false
        }
    }
    return presence
}
