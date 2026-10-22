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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
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
import com.jcsoftdev.ui.icons.Icons
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

/**
 * Colors of [AuthFloatingArt]: the soft [glow] disc and the [shape] ring at the back, the solid pieces in [fill] and [fill2],
 * the [line] (paper) pieces such as the graduation cap, and the [cutout] the glyphs are cut into the solid pieces with.
 */
@Immutable
public class AuthFloatingArtColors(
    public val glow: Color,
    public val shape: Color,
    public val line: Color,
    public val fill: Color,
    public val fill2: Color,
    public val cutout: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        glow: Color = this.glow,
        shape: Color = this.shape,
        line: Color = this.line,
        fill: Color = this.fill,
        fill2: Color = this.fill2,
        cutout: Color = this.cutout,
    ): AuthFloatingArtColors = AuthFloatingArtColors(glow, shape, line, fill, fill2, cutout)
}

/** Default colors of [AuthFloatingArt]: accent pieces with header-colored glyphs, paper pieces in the header content color. */
public object AuthFloatingArtDefaults {
    /**
     * Solid pieces in the accent and `accent2`, each kept at 3:1 or more against the header band (pulled toward the content
     * color when a theme's accent is too dark for it); glyphs cut in the band color; paper pieces and lines in the content
     * color; the glow from the accent.
     */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthFloatingArtColors {
        val c = UiTheme.colors
        val header = authHeaderColor(c)
        val content = LocalContentColor.current.let { if (it == Color.Unspecified) authOnColor(header, c) else it }
        val fill2 = authPieceFill(c.accent2, header, content)
        return AuthFloatingArtColors(c.accent, fill2, content, authPieceFill(c.accent, header, content), fill2, header)
    }

    /** The most pieces shown, in a header tall enough for all of them. */
    public const val MAX_PIECES: Int = 8
}

/**
 * Header art of school things floating in three depth layers: a soft glow and a ring at the back, solid badges (a book, a
 * star, a graduation cap) in the middle, and small sparkles and confetti in front. The pieces pop in one after another, then
 * drift, bob and tilt on their own rhythms while the whole field pans slowly, the front layer most, so the header reads in
 * depth. Dragging across the header pulls the layers apart and tilts them; they spring back on release. Typing lets them sink
 * toward the sheet and slow down, the password field dims and shrinks them a little, an error gives them a quick shake, and
 * success bursts them outward, fades them and brings them home. A short header shows fewer pieces, clustered at the end
 * away from the title; a tall one (the welcome mode of [AuthScaffold]) spreads all of them over the band, and the pieces glide
 * between the two arrangements with the welcome transition. Inside an [AuthScaffold] the pieces fade behind the header text.
 * Decorative: hidden from accessibility.
 *
 * Plug it in as the `art` of [AuthScaffold] or `LoginScreen`: `art = { state, progress -> AuthFloatingArt(state, progress, Modifier.fillMaxSize()) }`.
 * [errorKey] replays the error shake when it changes while [state] stays `Error` (a second failed attempt); inside an
 * [AuthScaffold] it defaults to the scaffold's own. Motion follows `UiTheme.motion`: with animations off the pieces hold their
 * arranged composition, at full size, and dragging does nothing.
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
            if (state == AuthState.Typing) 0.6f + 0.4f * progress.coerceIn(0f, 1f) else 0f,
            motion.springOrSnap(),
            label = "sink",
        )
    val hush = animateFloatAsState(if (state == AuthState.Password) 1f else 0f, motion.tween(Motion.SLOW), label = "hush")
    val glow = animateFloatAsState(if (state == AuthState.Success) 1f else 0f, motion.tween(Motion.SLOW), label = "glow")
    val speed = animateFloatAsState(AuthMotion.driftSpeed(state), motion.tween(900), label = "speed")
    val time = rememberDriftClock(speed)
    val shake = remember { Animatable(1f) }
    val burst = remember { Animatable(1f) }
    val intro = remember { Animatable(if (motion.enabled) 0f else 1f) }
    val drag = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    LaunchedEffect(motion) {
        if (motion.enabled) {
            intro.animateTo(1f, tween((AuthMotion.INTRO_MS * motion.scale).roundToInt(), easing = LinearEasing))
        } else {
            intro.snapTo(1f)
        }
    }
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
    val glyphs = GLYPHS.map { rememberVectorPainter(it) }
    val zones = LocalAuthTextZones.current
    val parallax =
        if (motion.enabled) {
            Modifier.pointerInput(motion) {
                val reach = DRAG_REACH.toPx()
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
                val unit = lerp(min(size.width, stage * 1.25f), size.width * 0.85f, welcomeShare)
                val shown = pieceCount(stage / density)
                val tint = ColorFilter.tint(colors.cutout)
                val dp = 1.dp.toPx()
                val reach = DRAG_REACH.toPx()
                val glowBrush =
                    Brush.radialGradient(
                        listOf(colors.glow, colors.glow.copy(alpha = 0.3f), Color.Transparent),
                        Offset.Zero,
                        1f,
                    )
                val ink = PieceInk(colors, glyphs, tint, glowBrush, Stroke(2.5f * dp, cap = StrokeCap.Round))
                val middle = Offset(size.width * lerp(0.78f, 0.5f, welcomeShare), stage * 0.45f)
                val login = zones?.let { FeatheredEraser(it.login.inflate(4.dp.toPx()), 32.dp.toPx()) }
                onDrawBehind {
                    val t = time.value
                    val out = AuthMotion.burst(burst.value)
                    val fade = AuthMotion.burstAlpha(burst.value)
                    val sway = AuthMotion.jitter(shake.value)
                    val pan = Offset(sin(t * 0.21f) * 7f * dp, cos(t * 0.17f) * 5f * dp)
                    for (i in PIECES.indices) {
                        val p = PIECES[i]
                        val extra = if (i < shown) 1f else AuthMotion.segment(welcomeShare, 0.3f, 0.8f)
                        if (extra <= 0f) continue
                        val depth = LAYER_DEPTH[p.layer]
                        val home = Offset(lerp(p.lx, p.wx, welcomeShare) * size.width, lerp(p.ly, p.wy, welcomeShare) * stage)
                        val away = home - middle
                        val distance = max(hypot(away.x, away.y), 1f)
                        val wander = LAYER_DRIFT[p.layer] * dp
                        val drift =
                            Offset(
                                sin(t * p.speed + p.phase) * wander + sway * 7f * dp * (0.4f + depth),
                                cos(t * p.speed * 0.8f + p.phase) * wander + sink.value * 14f * dp * (0.3f + depth),
                            )
                        val center = home + drift + (pan + drag.value) * depth + away / distance * (out * unit * 0.16f * (0.6f + depth))
                        val bob = sin(t * p.speed * 1.3f + p.phase * 1.7f)
                        val scale =
                            AuthMotion.popIn(intro.value, i) * (1f + 0.05f * bob) * (1f - 0.12f * hush.value) * (1f + 0.15f * out)
                        val alpha = LAYER_ALPHA[p.layer] * (1f - 0.5f * hush.value) * (1f + 0.25f * glow.value) * fade * extra
                        val turn =
                            p.rotation + LAYER_TILT[p.layer] * sin(t * p.speed * 0.6f + p.phase * 2f) + drag.value.x / reach * 10f * depth
                        drawPiece(p, center, p.size * unit * scale, turn, alpha.coerceIn(0f, 1f), sin(t * 1.4f + p.phase), ink)
                    }
                    if (zones != null) login?.run { erase(TEXT_CLEARING * (1f - zones.welcomeFraction.value)) }
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

/** What every piece is drawn with, built once per size. */
private class PieceInk(
    val colors: AuthFloatingArtColors,
    val glyphs: List<VectorPainter>,
    val tint: ColorFilter,
    val glow: Brush,
    val ring: Stroke,
) {
    fun tone(tone: Tone): Color =
        when (tone) {
            Tone.Fill -> colors.fill
            Tone.Fill2 -> colors.fill2
            Tone.Paper -> colors.line
        }
}

/** Draws one piece of side [side] at [center], turned [turn] degrees; [swing] (-1..1) moves the cap's tassel and the sparkle's twinkle. */
private fun DrawScope.drawPiece(
    p: Piece,
    center: Offset,
    side: Float,
    turn: Float,
    alpha: Float,
    swing: Float,
    ink: PieceInk,
) {
    if (alpha <= 0f || side <= 0f) return
    val half = side / 2f
    val color = ink.tone(p.tone)
    when (p.kind) {
        Kind.Glow ->
            translate(center.x, center.y) {
                scale(half, half, Offset.Zero) { drawCircle(ink.glow, 1f, Offset.Zero, alpha) }
            }
        Kind.Ring -> drawCircle(ink.colors.shape, half, center, alpha, ink.ring)
        Kind.Badge, Kind.Coin ->
            rotate(turn, center) {
                val topLeft = Offset(center.x - half, center.y - half)
                if (p.kind == Kind.Badge) {
                    drawRoundRect(color, topLeft, Size(side, side), CornerRadius(side * 0.3f), alpha = alpha)
                } else {
                    drawCircle(color, half, center, alpha)
                }
                val glyph = side * 0.54f
                translate(center.x - glyph / 2f, center.y - glyph / 2f) {
                    with(ink.glyphs[p.glyph]) { draw(Size(glyph, glyph), alpha, ink.tint) }
                }
            }
        Kind.Cap -> rotate(turn, center) { drawCap(center, side, alpha, swing, ink) }
        Kind.Sparkle -> rotate(turn, center) { drawSparkle(center, half * (0.88f + 0.12f * swing), color, alpha) }
        Kind.Dot -> drawCircle(color, half, center, alpha)
        Kind.Confetti ->
            rotate(turn, center) {
                val path =
                    Path().apply {
                        moveTo(center.x, center.y - half)
                        lineTo(center.x + half, center.y + half * 0.8f)
                        lineTo(center.x - half, center.y + half * 0.8f)
                        close()
                    }
                drawPath(path, color, alpha)
            }
    }
}

/** A mortarboard from primitives: the skull cap under a flat diamond board, a button on top and a tassel that swings. */
private fun DrawScope.drawCap(
    center: Offset,
    side: Float,
    alpha: Float,
    swing: Float,
    ink: PieceInk,
) {
    val paper = ink.colors.line
    val shade = lerp(paper, ink.colors.cutout, 0.22f)
    val x = center.x
    val y = center.y
    val base =
        Path().apply {
            moveTo(x - side * 0.28f, y + side * 0.02f)
            lineTo(x + side * 0.28f, y + side * 0.02f)
            lineTo(x + side * 0.28f, y + side * 0.28f)
            quadraticTo(x, y + side * 0.40f, x - side * 0.28f, y + side * 0.28f)
            close()
        }
    drawPath(base, shade, alpha)
    val board =
        Path().apply {
            moveTo(x, y - side * 0.24f)
            lineTo(x + side * 0.5f, y - side * 0.03f)
            lineTo(x, y + side * 0.16f)
            lineTo(x - side * 0.5f, y - side * 0.03f)
            close()
        }
    drawPath(board, paper, alpha)
    drawCircle(shade, side * 0.045f, Offset(x, y - side * 0.04f), alpha)
    val knot = Offset(x + side * 0.36f, y + side * 0.02f)
    val cord = side * 0.03f
    drawLine(ink.colors.fill2, Offset(x, y - side * 0.04f), knot, cord, StrokeCap.Round, alpha = alpha)
    rotate(swing * 14f, knot) {
        val end = Offset(knot.x, knot.y + side * 0.26f)
        drawLine(ink.colors.fill2, knot, end, cord, StrokeCap.Round, alpha = alpha)
        drawRoundRect(
            ink.colors.fill2,
            Offset(end.x - side * 0.045f, end.y - side * 0.02f),
            Size(side * 0.09f, side * 0.11f),
            CornerRadius(side * 0.03f),
            alpha = alpha,
        )
    }
}

/** A four point sparkle: concave sides meeting at the tips. */
private fun DrawScope.drawSparkle(
    center: Offset,
    radius: Float,
    color: Color,
    alpha: Float,
) {
    val x = center.x
    val y = center.y
    val path =
        Path().apply {
            moveTo(x, y - radius)
            quadraticTo(x, y, x + radius, y)
            quadraticTo(x, y, x, y + radius)
            quadraticTo(x, y, x - radius, y)
            quadraticTo(x, y, x, y - radius)
            close()
        }
    drawPath(path, color, alpha)
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

private enum class Kind { Glow, Ring, Badge, Coin, Cap, Sparkle, Dot, Confetti }

private enum class Tone { Fill, Fill2, Paper }

/**
 * One floating piece: where it rests on the sign-in header ([lx], [ly]) and on the welcome screen ([wx], [wy]) as fractions
 * of the stage, its size as a fraction of the art's unit, its resting turn in degrees, its depth [layer] (0 back, 2 front),
 * its [tone] and [glyph], and its own drift rhythm.
 */
private class Piece(
    val kind: Kind,
    val layer: Int,
    val size: Float,
    val lx: Float,
    val ly: Float,
    val wx: Float,
    val wy: Float,
    val rotation: Float = 0f,
    val tone: Tone = Tone.Fill,
    val glyph: Int = 0,
    val speed: Float,
    val phase: Float,
)

private val GLYPHS = listOf(Icons.BookOpen, Icons.Star)

/** Ordered by importance: a short header shows the first ones. On the sign-in header they gather at the end, clear of the title. */
private val PIECES =
    listOf(
        Piece(Kind.Badge, 1, 0.19f, 0.83f, 0.48f, 0.2f, 0.62f, rotation = -12f, glyph = 0, speed = 0.43f, phase = 1.3f),
        Piece(Kind.Cap, 1, 0.3f, 0.93f, 0.24f, 0.56f, 0.4f, rotation = -9f, tone = Tone.Paper, speed = 0.37f, phase = 0.4f),
        Piece(Kind.Sparkle, 2, 0.1f, 0.7f, 0.14f, 0.85f, 0.15f, rotation = 8f, tone = Tone.Fill2, speed = 0.62f, phase = 2.1f),
        Piece(Kind.Glow, 0, 0.75f, 0.9f, 0.5f, 0.55f, 0.52f, speed = 0.31f, phase = 0f),
        Piece(Kind.Coin, 1, 0.15f, 0.71f, 0.68f, 0.84f, 0.7f, rotation = 14f, tone = Tone.Fill2, glyph = 1, speed = 0.52f, phase = 3.7f),
        Piece(Kind.Dot, 2, 0.035f, 0.6f, 0.1f, 0.14f, 0.27f, tone = Tone.Paper, speed = 0.66f, phase = 2.9f),
        Piece(Kind.Ring, 0, 0.3f, 0.66f, 0.02f, 0.9f, 0.34f, speed = 0.27f, phase = 4.4f),
        Piece(Kind.Confetti, 2, 0.06f, 0.97f, 0.74f, 0.36f, 0.18f, rotation = 22f, speed = 0.58f, phase = 5.2f),
    )

/** How far each layer follows a drag and the slow pan: the back barely, the front fully. */
private val LAYER_DEPTH = floatArrayOf(0.25f, 0.6f, 1f)
private val LAYER_ALPHA = floatArrayOf(0.5f, 1f, 1f)

/** Drift amplitude of each layer in dp, and how far each layer tilts back and forth in degrees. */
private val LAYER_DRIFT = floatArrayOf(5f, 9f, 13f)
private val LAYER_TILT = floatArrayOf(0f, 9f, 16f)

/** How far a drag pulls the front layer, on each axis. */
private val DRAG_REACH = 28.dp

/** Share of the pieces removed behind the header text; a trace stays so the composition reads as one. */
private const val TEXT_CLEARING = 0.9f
