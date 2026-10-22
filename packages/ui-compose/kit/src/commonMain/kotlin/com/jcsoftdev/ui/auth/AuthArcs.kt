package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/** Colors of [AuthArcs]: the resting [arc], the [highlight] that sweeps along them on success, and the [error] tint. */
@Immutable
public class AuthArcsColors(
    public val arc: Color,
    public val highlight: Color,
    public val error: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        arc: Color = this.arc,
        highlight: Color = this.highlight,
        error: Color = this.error,
    ): AuthArcsColors = AuthArcsColors(arc, highlight, error)
}

/** Default colors and metrics of [AuthArcs]; the arcs follow the content color of the header they sit in. */
public object AuthArcsDefaults {
    /** Arcs tinted by the surrounding content color (the header text color inside an [AuthScaffold]) and the accent; errors use the danger color. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthArcsColors {
        val c = UiTheme.colors
        val content = LocalContentColor.current.let { if (it == Color.Unspecified) c.ink else it }
        return AuthArcsColors(lerp(content, c.accent, 0.4f), content, c.danger)
    }

    /** Number of concentric arcs. */
    public const val RING_COUNT: Int = 5

    /** Stroke width of every arc. */
    public val strokeWidth: Dp = 1.dp
}

/**
 * Thin concentric arcs rising from behind the sheet at the right edge of its box, the default header art of [AuthScaffold].
 * Each arc sways slowly on its own rhythm. Typing lengthens and brightens them with [progress] ([AuthProgress.sweepDegrees],
 * [AuthProgress.emphasis]); the password field dims and turns them; an error shakes them sideways with a danger flash that
 * settles into a softer tint; success sends a bright comet along every arc, inner ones first, and leaves them in the highlight
 * color. Inside an [AuthScaffold] the arcs fade out around the header text, at any font scale. Decorative: hidden from
 * accessibility.
 *
 * [errorKey] replays the error shake when it changes while [state] stays `Error` (a second failed attempt); inside an
 * [AuthScaffold] it defaults to the scaffold's own. Motion follows `UiTheme.motion`: with animations off the arcs hold one still
 * frame of the same state.
 */
@Composable
public fun AuthArcs(
    state: AuthState,
    progress: Float,
    modifier: Modifier = Modifier,
    colors: AuthArcsColors = AuthArcsDefaults.colors(),
    ringCount: Int = AuthArcsDefaults.RING_COUNT,
    strokeWidth: Dp = AuthArcsDefaults.strokeWidth,
    errorKey: Int = LocalAuthErrorKey.current,
) {
    val motion = UiTheme.motion
    val target = AuthArcsFrame.of(state, progress)
    val emphasis = animateFloatAsState(target.emphasis, motion.tween(Motion.SLOW), label = "arcsEmphasis")
    val sweep = animateFloatAsState(target.sweepDegrees, motion.springOrSnap(Spring.StiffnessLow), label = "arcsSweep")
    val turn = animateFloatAsState(target.turnDegrees, motion.springOrSnap(), label = "arcsTurn")
    val tint = animateFloatAsState(target.errorTint, motion.tween(Motion.SLOW), label = "arcsTint")
    val highlight = animateFloatAsState(target.highlight, motion.tween(AuthMotion.SUCCESS_MS / 2), label = "arcsHighlight")
    val speed = animateFloatAsState(AuthMotion.driftSpeed(state), motion.tween(900), label = "arcsSpeed")
    val time = rememberDriftClock(speed)
    val shake = remember { Animatable(1f) }
    val comet = remember { Animatable(1f) }
    LaunchedEffect(state, motion, errorKey) {
        if (!motion.enabled) {
            shake.snapTo(1f)
            comet.snapTo(1f)
            return@LaunchedEffect
        }
        coroutineScope {
            launch { if (state == AuthState.Error) shake.replay(AuthMotion.ERROR_MS, motion) else shake.finish(motion) }
            launch { if (state == AuthState.Success) comet.replay(AuthMotion.SUCCESS_MS, motion) else comet.finish(motion) }
        }
    }
    val zones = LocalAuthTextZones.current
    val rings = ringCount.coerceIn(1, RING_LENGTHS.size)
    Spacer(
        modifier
            .clearAndSetSemantics {}
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithCache {
                val thin = Stroke(strokeWidth.toPx(), cap = StrokeCap.Round)
                val bold = Stroke(strokeWidth.toPx() * 2.4f, cap = StrokeCap.Round)
                val band = zones?.freeBand(size.height, size.width * 0.4f) ?: size.height
                val unit = min(size.width * (1f + 0.5f * (zones?.welcomeFraction?.value ?: 0f)), band * 2.3f)
                val center = Offset(size.width + unit * 0.03f, min(band * 0.9f, size.width * 0.95f))
                val first = unit * 0.15f
                val step = unit * 0.092f
                val sway = 1.dp.toPx() * 7f
                val satellite = strokeWidth.toPx() * 2.3f
                val feather = 28.dp.toPx()
                val clearance = 6.dp.toPx()
                val login = zones?.let { FeatheredEraser(it.login.inflate(clearance), feather) }
                val welcome = zones?.let { FeatheredEraser(it.welcome.inflate(clearance), feather) }
                onDrawBehind {
                    val x = center.x + AuthMotion.jitter(shake.value) * sway
                    val c = Offset(x, center.y)
                    val e = emphasis.value
                    val danger = lerp(colors.arc, colors.error, (tint.value + AuthMotion.errorFlash(shake.value)).coerceIn(0f, 1f))
                    val base = lerp(danger, colors.highlight, highlight.value)
                    for (i in 0 until rings) {
                        val radius = first + i * step
                        val length = sweep.value * RING_LENGTHS[i]
                        val drift = 16f * sin(time.value * RING_SPEEDS[i] + i * 1.7f)
                        val start = 225f - length / 2f + RING_OFFSETS[i] + drift + turn.value
                        val alpha = (e * (1f - i * 0.12f)).coerceIn(0f, 1f)
                        drawRing(base, alpha, c, radius, start, length, thin)
                        if (i % 2 == 1) drawSatellite(base, alpha, c, radius, start + length, satellite)
                        drawComet(colors.highlight, c, radius, start, length, AuthMotion.sweepHead(comet.value, i, rings), bold)
                    }
                    if (zones != null) {
                        val f = zones.welcomeFraction.value
                        login?.run { erase(TEXT_CLEARING * (1f - f)) }
                        welcome?.run { erase(TEXT_CLEARING * f) }
                    }
                }
            },
    )
}

private suspend fun Animatable<Float, *>.replay(
    durationMillis: Int,
    motion: Motion,
) {
    snapTo(0f)
    animateTo(1f, tween((durationMillis * motion.scale).roundToInt(), easing = LinearEasing))
}

private suspend fun Animatable<Float, *>.finish(motion: Motion) {
    if (value < 1f) animateTo(1f, tween((Motion.SLOW * motion.scale).roundToInt(), easing = LinearEasing))
}

private fun DrawScope.drawRing(
    color: Color,
    alpha: Float,
    center: Offset,
    radius: Float,
    start: Float,
    sweep: Float,
    stroke: Stroke,
) = drawArc(color, start, sweep, false, Offset(center.x - radius, center.y - radius), Size(radius * 2, radius * 2), alpha, stroke)

private fun DrawScope.drawSatellite(
    color: Color,
    alpha: Float,
    center: Offset,
    radius: Float,
    angle: Float,
    dot: Float,
) {
    val rad = angle * DEG
    drawCircle(color, dot, Offset(center.x + radius * cos(rad), center.y + radius * sin(rad)), alpha)
}

/** A tapered bright comet whose head is at [head] (0..1) along the ring; it fades out as it runs past the end. */
private fun DrawScope.drawComet(
    color: Color,
    center: Offset,
    radius: Float,
    start: Float,
    sweep: Float,
    head: Float,
    stroke: Stroke,
) {
    if (head <= 0f || head >= 1.3f) return
    val fade = if (head <= 1f) 1f else 1f - (head - 1f) / 0.3f
    val headAngle = start + sweep * head.coerceAtMost(1f)
    for (k in COMET_LENGTHS.indices) {
        val tail = min(COMET_LENGTHS[k], headAngle - start)
        if (tail <= 0f) continue
        drawRing(color, COMET_ALPHAS[k] * fade, center, radius, headAngle - tail, tail, stroke)
    }
}

/** Share of the arcs removed behind the header text: enough to keep it legible, not so much that arcs end in stubs. */
private const val TEXT_CLEARING = 0.86f

private const val DEG = (PI / 180.0).toFloat()

private val RING_LENGTHS = floatArrayOf(1f, 0.74f, 1.1f, 0.82f, 0.96f, 0.7f, 1.04f)
private val RING_OFFSETS = floatArrayOf(-6f, 16f, -14f, 8f, -2f, 18f, -10f)

/** Angular speed of each ring's sway in radians per second of drift time; no two share a rhythm. */
private val RING_SPEEDS = floatArrayOf(0.52f, 0.41f, 0.67f, 0.36f, 0.47f, 0.6f, 0.43f)
private val COMET_LENGTHS = floatArrayOf(34f, 20f, 8f)
private val COMET_ALPHAS = floatArrayOf(0.22f, 0.4f, 0.95f)

/** The resting look of [AuthArcs] for a state: the values its animations move toward, and the reduced-motion frame. */
internal class AuthArcsFrame(
    val emphasis: Float,
    val sweepDegrees: Float,
    val turnDegrees: Float,
    val errorTint: Float,
    val highlight: Float,
) {
    companion object {
        fun of(
            state: AuthState,
            progress: Float,
        ): AuthArcsFrame =
            AuthArcsFrame(
                emphasis = AuthProgress.emphasis(state, progress),
                sweepDegrees = AuthProgress.sweepDegrees(progress),
                turnDegrees = if (state == AuthState.Password) 14f else 0f,
                errorTint = if (state == AuthState.Error) AuthMotion.ERROR_SETTLE else 0f,
                highlight = if (state == AuthState.Success) 1f else 0f,
            )
    }
}
