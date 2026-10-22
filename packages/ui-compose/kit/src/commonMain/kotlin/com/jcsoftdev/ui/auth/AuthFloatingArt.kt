package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.VectorPainter
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.icons.BookOpen
import com.jcsoftdev.ui.icons.Calculator
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Pencil
import com.jcsoftdev.ui.icons.Sparkles
import com.jcsoftdev.ui.icons.Star
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/** Colors of [AuthFloatingArt]: the soft [glow] discs at the back, the [shape] outlines in the middle and the [line] icons in front. */
@Immutable
public class AuthFloatingArtColors(
    public val glow: Color,
    public val shape: Color,
    public val line: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        glow: Color = this.glow,
        shape: Color = this.shape,
        line: Color = this.line,
    ): AuthFloatingArtColors = AuthFloatingArtColors(glow, shape, line)
}

/** Default colors of [AuthFloatingArt]: the accent for the glow, the header content color for the lines. */
public object AuthFloatingArtDefaults {
    /** Glow from the accent, outlines halfway between the accent and the content color, icons in the content color. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthFloatingArtColors {
        val c = UiTheme.colors
        val content = LocalContentColor.current.let { if (it == Color.Unspecified) c.ink else it }
        return AuthFloatingArtColors(c.accent, lerp(content, c.accent, 0.55f), content)
    }

    /** The most pieces shown, in a header tall enough for all of them. */
    public const val MAX_PIECES: Int = 8
}

/**
 * Header art of school things floating in three depth layers: soft discs at the back, outlines and larger icons in the
 * middle, small crisp icons in front. Every piece drifts and turns slowly on its own rhythm; dragging across the header moves
 * the layers apart (the front ones most) and they spring back on release. Typing lets the pieces sink toward the sheet and
 * slow down, the password field dims and shrinks them a little, an error gives them a quick shake, and success bursts them
 * outward, fades them and brings them home. A short header shows fewer pieces; a tall one (the welcome mode of
 * [AuthScaffold]) shows all of them. Inside an [AuthScaffold] the pieces fade behind the header text. Decorative: hidden
 * from accessibility.
 *
 * Plug it in as the `art` of [AuthScaffold] or `LoginScreen`: `art = { state, progress -> AuthFloatingArt(state, progress, Modifier.fillMaxSize()) }`.
 * [errorKey] replays the error shake when it changes while [state] stays `Error` (a second failed attempt); inside an
 * [AuthScaffold] it defaults to the scaffold's own. Motion follows `UiTheme.motion`: with animations off the pieces hold their arranged composition and dragging does nothing.
 */
@Composable
public fun AuthFloatingArt(
    state: AuthState,
    progress: Float,
    modifier: Modifier = Modifier,
    colors: AuthFloatingArtColors = AuthFloatingArtDefaults.colors(),
    errorKey: Int = LocalAuthErrorKey.current,
) {
    val motion = UiTheme.motion
    val sink =
        animateFloatAsState(
            if (state ==
                AuthState.Typing
            ) {
                0.6f + 0.4f * progress.coerceIn(0f, 1f)
            } else {
                0f
            },
            motion.springOrSnap(),
            label = "sink",
        )
    val hush = animateFloatAsState(if (state == AuthState.Password) 1f else 0f, motion.tween(Motion.SLOW), label = "hush")
    val glow = animateFloatAsState(if (state == AuthState.Success) 1f else 0f, motion.tween(Motion.SLOW), label = "glow")
    val speed = animateFloatAsState(AuthMotion.driftSpeed(state), motion.tween(900), label = "speed")
    val time = rememberDriftClock(speed)
    val shake = remember { Animatable(1f) }
    val burst = remember { Animatable(1f) }
    val drag = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    LaunchedEffect(state, motion, errorKey) {
        if (!motion.enabled) {
            shake.snapTo(1f)
            burst.snapTo(1f)
            return@LaunchedEffect
        }
        coroutineScope {
            launch { if (state == AuthState.Error) shake.restart(AuthMotion.ERROR_MS, motion) else shake.settle(motion) }
            launch { if (state == AuthState.Success) burst.restart(AuthMotion.BURST_MS, motion) else burst.settle(motion) }
        }
    }
    val scope = rememberCoroutineScope()
    val painters = FLOAT_ICONS.map { rememberVectorPainter(it) }
    val zones = LocalAuthTextZones.current
    val parallax =
        if (motion.enabled) {
            Modifier.pointerInput(motion) {
                val reach = 28.dp.toPx()
                val home = spring<Offset>(dampingRatio = 0.55f, stiffness = Spring.StiffnessLow / (motion.scale * motion.scale))
                val offset = DragAccumulator(reach)
                detectDragGestures(
                    onDragStart = { offset.begin(drag.value.x, drag.value.y) },
                    onDragEnd = { scope.launch { drag.animateTo(Offset.Zero, home) } },
                    onDragCancel = { scope.launch { drag.animateTo(Offset.Zero, home) } },
                ) { change, amount ->
                    change.consume()
                    offset.add(amount.x, amount.y)
                    val target = Offset(offset.x, offset.y)
                    scope.launch(start = CoroutineStart.UNDISPATCHED) { drag.snapTo(target) }
                }
            }
        } else {
            Modifier
        }
    Spacer(
        modifier
            .clearAndSetSemantics {}
            .then(parallax)
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithCache {
                val free = zones?.freeBand(size.height, size.width * 0.4f) ?: size.height
                val stage = min(floatStage(size.width, size.height), free)
                val welcomeShare = zones?.welcomeFraction?.value ?: 0f
                val unit = lerp(min(size.width, stage * 1.6f), size.width * 0.85f, welcomeShare)
                val count = if (welcomeShare > 0.5f) AuthFloatingArtDefaults.MAX_PIECES else pieceCount(stage / density)
                val filters = arrayOf(ColorFilter.tint(colors.shape), ColorFilter.tint(colors.line))
                val outline = Stroke(1.5.dp.toPx())
                val glows =
                    Array(count) {
                        val radius = PIECES[it].size * unit / 2f
                        Brush.radialGradient(listOf(colors.glow, colors.glow.copy(alpha = 0.35f), Color.Transparent), Offset.Zero, radius)
                    }
                val dp = 1.dp.toPx()
                val middle = Offset(size.width * 0.72f, stage * 0.45f)
                val feather = 32.dp.toPx()
                val login = zones?.let { FeatheredEraser(it.login.inflate(4.dp.toPx()), feather) }
                val welcome = zones?.let { FeatheredEraser(it.welcome.inflate(4.dp.toPx()), feather) }
                onDrawBehind {
                    val t = time.value
                    val out = AuthMotion.burst(burst.value)
                    val fade = AuthMotion.burstAlpha(burst.value)
                    val sway = AuthMotion.jitter(shake.value)
                    for (i in 0 until count) {
                        val p = PIECES[i]
                        val depth = LAYER_DEPTH[p.layer]
                        val home = Offset(p.x * size.width, p.y * stage)
                        val away = home - middle
                        val distance = max(hypot(away.x, away.y), 1f)
                        val drift =
                            Offset(
                                sin(t * p.speed + p.phase) * LAYER_DRIFT[p.layer] * dp + sway * 7f * dp * (0.4f + depth),
                                cos(t * p.speed * 0.8f + p.phase) * LAYER_DRIFT[p.layer] * dp + sink.value * 14f * dp * (0.3f + depth),
                            )
                        val center = home + drift + drag.value * depth + away / distance * (out * unit * 0.16f * (0.6f + depth))
                        val scale = (1f - 0.12f * hush.value) * (1f + 0.15f * out)
                        val alpha = LAYER_ALPHA[p.layer] * (1f - 0.5f * hush.value) * (1f + 0.25f * glow.value) * fade
                        val turn = p.rotation + 9f * sin(t * p.speed * 0.6f + p.phase * 2f)
                        drawPiece(
                            p,
                            center,
                            p.size * unit * scale,
                            turn,
                            alpha.coerceIn(0f, 1f),
                            colors,
                            painters,
                            filters,
                            outline,
                            glows[i],
                        )
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

/** Height of the band the pieces spread over: all of a header, the upper part of a tall welcome screen. */
internal fun floatStage(
    width: Float,
    height: Float,
): Float = if (height <= width * 0.9f) height else max(width * 0.9f, height * 0.56f)

/** How many pieces a stage of [stageDp] height holds: a short header keeps the five that matter most. */
internal fun pieceCount(stageDp: Float): Int =
    when {
        stageDp < 150f -> 5
        stageDp < 230f -> 6
        stageDp < 320f -> 7
        else -> AuthFloatingArtDefaults.MAX_PIECES
    }

private fun DrawScope.drawPiece(
    p: Piece,
    center: Offset,
    side: Float,
    turn: Float,
    alpha: Float,
    colors: AuthFloatingArtColors,
    painters: List<VectorPainter>,
    filters: Array<ColorFilter>,
    outline: Stroke,
    glow: Brush,
) {
    if (alpha <= 0f) return
    val half = side / 2f
    when (p.kind) {
        Kind.Disc -> translate(center.x, center.y) { drawCircle(glow, half, Offset.Zero, alpha) }
        Kind.Ring -> drawCircle(colors.shape, half, center, alpha, outline)
        Kind.Tile ->
            rotate(turn, center) {
                drawRoundRect(
                    colors.shape,
                    Offset(center.x - half, center.y - half),
                    Size(side, side),
                    CornerRadius(side * 0.28f),
                    outline,
                    alpha,
                )
            }
        Kind.Icon ->
            translate(center.x - half, center.y - half) {
                rotate(turn, Offset(half, half)) {
                    with(painters[p.icon]) { draw(Size(side, side), alpha, filters[if (p.layer == 2) 1 else 0]) }
                }
            }
    }
}

private suspend fun Animatable<Float, *>.restart(
    durationMillis: Int,
    motion: Motion,
) {
    snapTo(0f)
    animateTo(1f, tween((durationMillis * motion.scale).roundToInt(), easing = LinearEasing))
}

private suspend fun Animatable<Float, *>.settle(motion: Motion) {
    if (value < 1f) animateTo(1f, tween((Motion.SLOW * motion.scale).roundToInt(), easing = LinearEasing))
}

private enum class Kind { Disc, Ring, Tile, Icon }

/**
 * One floating piece: where it rests as fractions of the stage, its size as a fraction of the art's unit, its resting turn
 * in degrees, its depth [layer] (0 back, 2 front) and its own drift rhythm.
 */
private class Piece(
    val kind: Kind,
    val layer: Int,
    val x: Float,
    val y: Float,
    val size: Float,
    val rotation: Float = 0f,
    val icon: Int = 0,
    val speed: Float,
    val phase: Float,
)

private val FLOAT_ICONS = listOf(Icons.BookOpen, Icons.Pencil, Icons.Star, Icons.Calculator, Icons.Sparkles)

/** Ordered by importance: a short header shows the first ones. */
private val PIECES =
    listOf(
        Piece(Kind.Disc, 0, 0.93f, 0.46f, 0.6f, speed = 0.31f, phase = 0f),
        Piece(Kind.Icon, 1, 0.80f, 0.60f, 0.15f, rotation = -12f, icon = 0, speed = 0.43f, phase = 1.3f),
        Piece(Kind.Icon, 2, 0.90f, 0.20f, 0.10f, rotation = 28f, icon = 1, speed = 0.57f, phase = 2.1f),
        Piece(Kind.Icon, 2, 0.955f, 0.72f, 0.07f, rotation = 14f, icon = 2, speed = 0.62f, phase = 3.7f),
        Piece(Kind.Ring, 0, 0.66f, 0.06f, 0.22f, speed = 0.27f, phase = 4.4f),
        Piece(Kind.Tile, 1, 0.52f, 0.86f, 0.085f, rotation = 22f, speed = 0.49f, phase = 5.2f),
        Piece(Kind.Icon, 1, 0.14f, 0.82f, 0.12f, rotation = 10f, icon = 3, speed = 0.38f, phase = 0.7f),
        Piece(Kind.Icon, 2, 0.36f, 0.52f, 0.07f, rotation = -8f, icon = 4, speed = 0.66f, phase = 2.9f),
    )

/** How far each layer follows a drag: the back barely, the front fully. */
private val LAYER_DEPTH = floatArrayOf(0.25f, 0.55f, 1f)
private val LAYER_ALPHA = floatArrayOf(0.34f, 0.5f, 0.9f)

/** Drift amplitude of each layer in dp. */
private val LAYER_DRIFT = floatArrayOf(5f, 8f, 12f)

/** Share of the pieces removed behind the header text; they stay faintly there so the composition reads as one. */
private const val TEXT_CLEARING = 0.72f
