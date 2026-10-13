package com.jcsoftdev.ui.glass

import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.pow

/** The short side, in dp, at which thickness shading and the shadow have their nominal size. */
internal const val REFERENCE_SIZE_DP = 56f

internal const val GLINT_WIDTH_DP = 1.5f
private const val CONTOUR_WIDTH_DP = 0.75f
private const val PRESS_BRIGHTEN = 0.14f

// The lens covers the whole surface: its profile runs from the rim to the medial axis, half the short side deep, for every shape.
private const val LENS_COVERAGE = 1f

/**
 * The Liquid surface of [material], plus, when [interactive] and its [LiquidGlass.interaction] can move it, its dynamics: press
 * swell, drag squash and the pointer observer that feeds them.
 */
@Composable
internal fun liquidSurface(
    modifier: Modifier,
    material: LiquidGlass,
    resolved: ResolvedMaterial,
    shape: Shape,
    glass: GlassState?,
    observe: (() -> Float)?,
    interactionSource: InteractionSource?,
    interactive: Boolean,
): Modifier {
    val interaction = material.interaction
    val moves = interactive && interaction != null && needsDynamics(interaction, interactionSource, UiTheme.motion)
    val dynamics = if (moves) rememberLiquidDynamics(interaction!!, interactionSource) else null
    val swell = interaction?.motion?.swell
    val flexed =
        if (dynamics != null && dynamics.motionOn && swell != null && (interactionSource != null || interaction.drags)) {
            modifier
                .graphicsLayer {
                    val grow = 1f + dynamics.lift() * swellFraction(swell.toPx(), size.width)
                    scaleX = grow * dynamics.scaleX()
                    scaleY = grow * dynamics.scaleY()
                }.then(dynamics.observer)
        } else {
            modifier
        }
    val colors = UiTheme.colors
    val dark = LocalUiDark.current
    // A custom material builds new tokens; remembering them keeps the element equal across recompositions, so the node is not
    // updated (and its lens rebuilt) on every recomposition of the caller.
    val tokens = remember(material, dark) { material.tokens(dark) }
    return flexed.liquidShadow(shape, material.shadow).clip(shape) then
        LiquidSurfaceElement(
            shape = shape,
            tokens = tokens,
            blur = resolved.mode != SurfaceMode.Tint,
            lensOn = resolved.mode == SurfaceMode.Lens,
            base = colors.bg,
            veil = if (resolved.mode == SurfaceMode.Tint) colors.float.copy(alpha = TINT_VEIL_ALPHA) else Color.Unspecified,
            state = glass,
            borderWidth = UiTheme.sizes.borderWidth,
            observe = observe,
            dynamics = dynamics,
            material = material,
        )
}

// The shadow is a stack of slightly larger copies of the silhouette, each faint: their sum falls off smoothly from the edge, with
// no blur or elevation API, so it looks the same on every target and can be pushed down by offsetY. It grows with the size of
// the surface. The opaque base of the glass hides the part under the surface.
private fun Modifier.liquidShadow(
    shape: Shape,
    shadow: LiquidShadow,
): Modifier = if (shadow.opacity <= 0f || shadow.spread.value <= 0f) this else this then LiquidShadowElement(shape, shadow)

internal const val SHADOW_ALPHA = 0.26f
internal const val SHADOW_STEPS = 14

private data class LiquidShadowElement(
    val shape: Shape,
    val shadow: LiquidShadow,
) : ModifierNodeElement<LiquidShadowNode>() {
    override fun create() = LiquidShadowNode(shape, shadow)

    override fun update(node: LiquidShadowNode) {
        node.shape = shape
        node.shadow = shadow
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "liquidShadow"
    }
}

private class LiquidShadowNode(
    var shape: Shape,
    var shadow: LiquidShadow,
) : Modifier.Node(),
    DrawModifierNode {
    private var outline: Outline? = null
    private var inside: Path? = null
    private var outlineSize = Size.Unspecified
    private var outlineDirection: LayoutDirection? = null
    private var outlineDensity = 0f
    private var outlineShape: Shape? = null

    // The shadow never shows inside the silhouette: under a translucent tint (no backdrop to hide it) it would darken the glass.
    override fun ContentDrawScope.draw() {
        if (outline == null ||
            outlineSize != size ||
            outlineDirection != layoutDirection ||
            outlineDensity != density ||
            outlineShape != shape
        ) {
            val made = shape.createOutline(size, layoutDirection, this)
            outline = made
            inside = Path().apply { addOutline(made) }
            outlineSize = size
            outlineDirection = layoutDirection
            outlineDensity = density
            outlineShape = shape
        }
        clipPath(inside!!, ClipOp.Difference) { drawSoftShadow(outline!!, shadow, min(size.width, size.height)) }
        drawContent()
    }
}

/** The step alpha of one ring of the shadow stack, so that all [SHADOW_STEPS] rings together reach the edge opacity. */
internal fun shadowStepAlpha(shadow: LiquidShadow): Float {
    val edge = (SHADOW_ALPHA * shadow.opacity).coerceIn(0f, 0.95f)
    return (1.0 - (1.0 - edge).pow(1.0 / SHADOW_STEPS)).toFloat()
}

/** Draws the Liquid shadow of any [outline]: rounded shapes as a stack of grown silhouettes, free-form paths as a stack of strokes. */
internal fun DrawScope.drawSoftShadow(
    outline: Outline,
    shadow: LiquidShadow,
    shortSide: Float,
) {
    val rounded = outline.asRoundRect()
    if (rounded != null) {
        drawSoftShadow(rounded, shadow, shortSide)
        return
    }
    val path = (outline as? Outline.Generic)?.path ?: return
    val reach = shadow.spread.toPx() * sizeScale(shortSide, REFERENCE_SIZE_DP.dp.toPx())
    if (reach <= 0f || shadow.opacity <= 0f) return
    val color = Color.Black.copy(alpha = shadowStepAlpha(shadow))
    translate(0f, shadow.offsetY.toPx()) {
        for (k in SHADOW_STEPS downTo 1) {
            val grow = reach * k / SHADOW_STEPS
            drawPath(path, color)
            drawPath(path, color, style = Stroke(width = grow * 2f, join = StrokeJoin.Round))
        }
    }
}

/** Draws the Liquid shadow of [rounded]; [shortSide] scales it (bigger surfaces cast a longer shadow). */
internal fun DrawScope.drawSoftShadow(
    rounded: RoundRect,
    shadow: LiquidShadow,
    shortSide: Float,
) {
    val reach = shadow.spread.toPx() * sizeScale(shortSide, REFERENCE_SIZE_DP.dp.toPx())
    if (reach <= 0f || shadow.opacity <= 0f) return
    val each = shadowStepAlpha(shadow)
    translate(0f, shadow.offsetY.toPx()) {
        for (k in SHADOW_STEPS downTo 1) {
            val grow = reach * k / SHADOW_STEPS
            drawRoundRect(
                Color.Black.copy(alpha = each),
                topLeft = Offset(rounded.left - grow, rounded.top - grow),
                size = Size(rounded.width + grow * 2f, rounded.height + grow * 2f),
                cornerRadius = CornerRadius(rounded.topLeftCornerRadius.x + grow, rounded.topLeftCornerRadius.y + grow),
            )
        }
    }
}

/** The outline as one rounded rectangle (its top-left corner radius stands for all four); null for free-form shapes. */
internal fun Outline.asRoundRect(): RoundRect? =
    when (this) {
        is Outline.Rounded -> roundRect
        is Outline.Rectangle -> RoundRect(rect)
        is Outline.Generic -> null
    }

private data class LiquidSurfaceElement(
    val shape: Shape,
    val tokens: GlassMaterial,
    val blur: Boolean,
    val lensOn: Boolean,
    val base: Color,
    val veil: Color,
    val state: GlassState?,
    val borderWidth: Dp,
    val observe: (() -> Float)?,
    val dynamics: LiquidDynamics?,
    val material: LiquidGlass,
) : ModifierNodeElement<LiquidSurfaceNode>() {
    override fun create(): LiquidSurfaceNode =
        LiquidSurfaceNode(shape, tokens, blur, lensOn, base, veil, state, borderWidth, observe, dynamics, material)

    override fun update(node: LiquidSurfaceNode) {
        node.updateBackdrop(shape, tokens, blur, base, veil, state, borderWidth, observe)
        node.lensOn = lensOn
        node.dynamics = dynamics
        node.material = material
        node.renderer?.stale = true
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSurface"
    }
}

// The directional rim of a Liquid surface without the lens: its two sweeps and strokes, rebuilt only when what they depend on
// changes, so a redraw (an overlay animating in, a press) allocates nothing.
private class RimCache {
    var size = Size.Unspecified
    var density = 0f
    var angle = Float.NaN
    var lit = Color.Unspecified
    var shade = Float.NaN
    lateinit var glint: Brush
    lateinit var away: Brush
    lateinit var glintStroke: Stroke
    lateinit var contourStroke: Stroke
}

private class LiquidSurfaceNode(
    shape: Shape,
    tokens: GlassMaterial,
    blur: Boolean,
    var lensOn: Boolean,
    base: Color,
    veil: Color,
    state: GlassState?,
    borderWidth: Dp,
    observe: (() -> Float)?,
    var dynamics: LiquidDynamics?,
    var material: LiquidGlass,
) : BackdropSurfaceNode(shape, tokens, blur, base, veil, state, borderWidth, observe) {
    /** Made on the first lensed draw by the lens itself, so a surface without a lens never holds one. */
    var renderer: LensRenderer? = null
    private var rimCache: RimCache? = null
    private var lensApplied = false

    // The light: the material's angle, turned toward the finger while it is down.
    private fun ContentDrawScope.light(
        pointer: Offset?,
        follow: Float,
    ): Offset {
        val own = lightFromAngle(material.specular.angleDegrees)
        val toward = pointer?.let { lightToward(it, size.width, size.height) }
        return if (toward != null) blendLight(own, toward, follow.coerceIn(0f, 1f)) else own
    }

    override fun ContentDrawScope.draw() {
        observe?.invoke()
        val pressed = dynamics?.lift?.invoke() ?: 0f
        val outline = outline()
        val source = recordingSource()
        lensApplied = false
        if (source != null) {
            val blurLayer = backdropLayer()
            // Opaque base: where the source is transparent (or ends) the content under the surface must not show through.
            drawRect(base)
            source.surfaceDraws++
            drawBackdrop(source, blurLayer, outline, pressed)
        }
        if (!lensApplied) drawVeil()
        if (pressed > 0f) drawRect(Color.White.copy(alpha = PRESS_BRIGHTEN * pressed))
        if (lensApplied) {
            drawOutline(outline, tokens.border, style = borderStroke())
        } else {
            drawDirectionalRim(outline)
        }
        drawContent()
    }

    // A thin glint on the walls that face the light (top left, with a weaker one opposite), added on top of the glass so it
    // recolors the backdrop instead of painting white, plus a faint dark contour on the walls that face away.
    private fun ContentDrawScope.drawDirectionalRim(outline: Outline) {
        val rim = rimCache ?: RimCache().also { rimCache = it }
        val angle = material.specular.angleDegrees
        val lit = tokens.edge.copy(alpha = (tokens.edge.alpha * material.specular.intensity * material.rim).coerceIn(0f, 1f))
        val shade = 0.10f * material.rim
        if (rim.size != size || rim.density != density || rim.angle != angle || rim.lit != lit || rim.shade != shade) {
            val center = Offset(size.width / 2f, size.height / 2f)
            rim.glint =
                sweepAround(
                    center,
                    angle to lit,
                    angle + 180f to lit.copy(alpha = lit.alpha * 0.55f),
                    spread = 55f,
                    fade = Color.Transparent,
                )
            rim.away = sweepAround(center, angle + 180f to Color.Black.copy(alpha = shade), spread = 90f, fade = Color.Transparent)
            rim.glintStroke = Stroke(width = GLINT_WIDTH_DP.dp.toPx() * 2f)
            rim.contourStroke = Stroke(width = CONTOUR_WIDTH_DP.dp.toPx() * 2f)
            rim.size = size
            rim.density = density
            rim.angle = angle
            rim.lit = lit
            rim.shade = shade
        }
        drawOutline(outline, rim.glint, style = rim.glintStroke, blendMode = BlendMode.Plus)
        drawOutline(outline, rim.away, style = rim.contourStroke)
        drawOutline(outline, tokens.border, style = borderStroke())
    }

    // The backdrop, blurred, or refracted by the lens in Lens mode. A lens that samples beyond the surface (crystal) pads the
    // layer by its reach in every mode, so the blur at the edges reads the same backdrop with or without the shader.
    private fun ContentDrawScope.drawBackdrop(
        source: GlassState,
        blurLayer: GraphicsLayer,
        outline: Outline,
        pressed: Float,
    ) {
        measureRootFrame()
        val radius = tokens.blur.toPx()
        val depth = (min(size.width, size.height) * 0.5f * LENS_COVERAGE).coerceAtLeast(1f)
        val lens = material.lens
        val materialize = dynamics?.materialize?.invoke() ?: 1f
        val strength = if (lens != null) with(lens) { strength(depth, pressed, materialize) } else 0f
        val reach = lens?.reach(size.width / 2f, size.height / 2f, strength) ?: 0f
        val pad = ceil(radius + reach).toInt()
        val lensed = if (lensOn) lens else null
        recordBackdrop(source, blurLayer, pad, opaqueBase = lensed != null)
        val effect =
            if (lensed != null) {
                val made = renderer ?: lensed.renderer().also { renderer = it }
                val pointer = dynamics?.pointer?.invoke()
                val follow = dynamics?.follow?.invoke() ?: 0f
                with(made) {
                    effect(
                        material = material,
                        lens = lensed,
                        tokens = tokens,
                        outline = outline,
                        pad = pad,
                        depth = depth,
                        strength = strength,
                        radius = radius,
                        pressed = pressed,
                        wide = reach > 0f,
                        sourceLeft = pad - (frameLeft - source.originX),
                        sourceTop = pad - (frameTop - source.originY),
                        sourceSize = source.layer.size,
                        light = light(pointer, follow),
                        pointer = pointer,
                    )
                }
            } else {
                null
            }
        lensApplied = effect != null
        blurLayer.renderEffect = effect ?: blurFor(radius)
        // The lens shader saturates the backdrop itself, before the veil.
        blurLayer.colorFilter = if (lensApplied) null else saturationFilter()
        drawLayer(blurLayer)
    }
}

/** A sweep (from 3 o'clock, clockwise) with a peak at each angle (degrees) that falls to [fade] [spread] degrees either side. */
private fun sweepAround(
    center: Offset,
    vararg peaks: Pair<Float, Color>,
    spread: Float,
    fade: Color,
): Brush {
    fun at(degrees: Float) = (((degrees % 360f) + 360f) % 360f) / 360f
    val stops = ArrayList<Pair<Float, Color>>()
    for ((angle, color) in peaks) {
        stops += at(angle - spread) to fade
        stops += at(angle) to color
        stops += at(angle + spread) to fade
    }
    // A wrapped range puts its fade stops on both ends of the sweep; keep the ends transparent and the order ascending.
    val sorted = stops.sortedBy { it.first }.toMutableList()
    if (sorted.first().first > 0f) sorted.add(0, 0f to fade)
    if (sorted.last().first < 1f) sorted.add(1f to fade)
    return Brush.sweepGradient(colorStops = sorted.toTypedArray(), center = center)
}
