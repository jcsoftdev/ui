package com.jcsoftdev.ui.foundation

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import kotlin.math.roundToInt
import androidx.compose.animation.core.tween as composeTween

/** Same curve as the web `motion-ease` token. */
public val UiEasing: Easing = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f)

/**
 * Animation timing. [scale] mirrors the system animator duration scale: it stretches every duration,
 * and 0 (animations removed in the accessibility settings) makes every transition a jump cut.
 */
@Immutable
public class Motion(
    public val scale: Float = 1f,
) {
    public val enabled: Boolean get() = scale > 0f

    public fun <T> tween(
        durationMillis: Int = STANDARD,
        easing: Easing = UiEasing,
    ): FiniteAnimationSpec<T> = if (enabled) composeTween((durationMillis * scale).roundToInt(), easing = easing) else snap()

    override fun equals(other: Any?): Boolean = other is Motion && other.scale == scale

    override fun hashCode(): Int = scale.hashCode()

    public companion object {
        /** Press feedback. */
        public const val FAST: Int = 100

        /** The web `motion-duration` token. */
        public const val STANDARD: Int = 180
        public const val SLOW: Int = 300
    }
}

internal val LocalMotion = staticCompositionLocalOf { Motion() }

/** The system animator duration scale where the platform exposes one, otherwise full motion. */
@Composable
internal expect fun rememberSystemMotion(): Motion
