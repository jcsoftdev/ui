package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.PI
import kotlin.math.sin

/** Pure timing rules of the auth header motion; every curve maps a 0..1 time to a value so the static frame is `t = 1`. */
internal object AuthMotion {
    /** Length of the error shake. */
    const val ERROR_MS: Int = 560

    /** Length of the success sweep along the arcs. */
    const val SUCCESS_MS: Int = 1300

    /** Length of the floating pieces' success burst and return. */
    const val BURST_MS: Int = 1500

    /** Length of the welcome-to-login transition. */
    const val WELCOME_MS: Int = 620

    /** Danger tint the arcs keep while the error lasts, after the flash. */
    const val ERROR_SETTLE: Float = 0.55f

    /** Travel of each comet over its share of the sweep: past the arc end (1) far enough to have faded out by `t = 1`. */
    private const val COMET_SPAN: Float = 0.5f

    /** Damped shake in -1..1: three swings that die out, zero at both ends. */
    fun jitter(t: Float): Float {
        val p = t.coerceIn(0f, 1f)
        val envelope = (1f - p) * (1f - p)
        return sin(p * 6f * PI.toFloat()) * envelope
    }

    /** Extra danger tint on top of [ERROR_SETTLE]: a quick flash that peaks early and is gone at `t = 1`. */
    fun errorFlash(t: Float): Float {
        val p = t.coerceIn(0f, 1f)
        val rise = (p / 0.12f).coerceAtMost(1f)
        val fall = if (p <= 0.12f) 1f else 1f - (p - 0.12f) / 0.88f
        return (1f - ERROR_SETTLE) * rise * fall * fall
    }

    /**
     * Where the success highlight is along ring [ring] of [rings], 0 (arc start) to 1 (arc end); inner rings start first.
     * Below 0 the highlight has not reached that ring yet; above 1 it has left it.
     */
    fun sweepHead(
        t: Float,
        ring: Int,
        rings: Int,
    ): Float {
        val stagger = 0.35f * ring / (rings - 1).coerceAtLeast(1)
        return (t.coerceIn(0f, 1f) - stagger) / COMET_SPAN
    }

    /** Outward travel of the floating pieces on success: out to 1 by `t = 0.4`, then home again by `t = 1`. */
    fun burst(t: Float): Float {
        val p = t.coerceIn(0f, 1f)
        return if (p < 0.4f) easeOut(p / 0.4f) else 1f - smooth((p - 0.4f) / 0.6f)
    }

    /** Opacity of the floating pieces during the success burst: they fade out while flying and fade back as they return. */
    fun burstAlpha(t: Float): Float {
        val p = t.coerceIn(0f, 1f)
        return when {
            p < 0.4f -> 1f - smooth(p / 0.4f)
            p < 0.55f -> 0f
            else -> smooth((p - 0.55f) / 0.45f)
        }
    }

    /** How fast the header art drifts in each state, relative to idle. */
    fun driftSpeed(state: AuthState): Float =
        when (state) {
            AuthState.Idle -> 1f
            AuthState.Typing -> 0.45f
            AuthState.Password -> 0.35f
            AuthState.Error -> 0.2f
            AuthState.Success -> 1.6f
        }

    /** Remaps the shared welcome fraction to the part of it between [from] and [to], clamped to 0..1. */
    fun segment(
        fraction: Float,
        from: Float,
        to: Float,
    ): Float = ((fraction - from) / (to - from)).coerceIn(0f, 1f)

    private fun easeOut(x: Float): Float = 1f - (1f - x) * (1f - x) * (1f - x)

    private fun smooth(x: Float): Float {
        val p = x.coerceIn(0f, 1f)
        return p * p * (3f - 2f * p)
    }
}

/**
 * Counter that replays the header art's error reaction. [AuthScaffold] provides its `errorKey` here; [AuthArcs] and
 * [AuthFloatingArt] read it as the default of their own `errorKey`, so custom art can read it too.
 */
public val LocalAuthErrorKey: ProvidableCompositionLocal<Int> = compositionLocalOf { 0 }

/** Test hook: while true the drift clock holds at zero so only the state reactions move the art. */
internal val LocalAuthDriftFrozen: ProvidableCompositionLocal<Boolean> = compositionLocalOf { false }

/** A soft spring when motion is on, a jump cut when it is off. */
internal fun <T> Motion.springOrSnap(stiffness: Float = Spring.StiffnessVeryLow): AnimationSpec<T> =
    if (enabled) spring(dampingRatio = 0.85f, stiffness = stiffness / (scale * scale)) else snap()

/**
 * Seconds of drift time that advance at [speed] (read every frame, so it can be animated) and stretch with the motion scale.
 * Always 0 while motion is off, which is the static frame. Read the value only while drawing, so frames do not recompose.
 */
@Composable
internal fun rememberDriftClock(speed: State<Float>): State<Float> {
    val time = remember { mutableFloatStateOf(0f) }
    val motion = UiTheme.motion
    val frozen = LocalAuthDriftFrozen.current
    LaunchedEffect(motion, frozen) {
        if (!motion.enabled || frozen) {
            time.floatValue = 0f
            return@LaunchedEffect
        }
        var last = withFrameNanos { it }
        while (true) {
            withFrameNanos { now ->
                time.floatValue += (now - last) / 1_000_000_000f * speed.value / motion.scale
                last = now
            }
        }
    }
    return time
}

/** Sums the pointer deltas of a drag into one offset limited to [reach] on each axis, scaled by [gain]; reads no stale value however many events arrive in a frame. */
internal class DragAccumulator(
    private val reach: Float,
    private val gain: Float = 0.4f,
) {
    var x: Float = 0f
        private set
    var y: Float = 0f
        private set

    /** Starts from [fromX], [fromY] (the offset the art currently shows, for example mid spring-back). */
    fun begin(
        fromX: Float,
        fromY: Float,
    ) {
        x = fromX.coerceIn(-reach, reach)
        y = fromY.coerceIn(-reach, reach)
    }

    /** Adds one delta; read [x] and [y] afterwards. */
    fun add(
        dx: Float,
        dy: Float,
    ) {
        x = (x + dx * gain).coerceIn(-reach, reach)
        y = (y + dy * gain).coerceIn(-reach, reach)
    }
}
