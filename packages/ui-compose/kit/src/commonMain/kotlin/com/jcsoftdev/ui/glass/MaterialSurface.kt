package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.isUnspecified
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.node.requireGraphicsContext
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Fills this node with [material] clipped to [shape]: solid ([solid]), frosted glass (tint, dim, edge highlight, border and a
 * blurred copy of [glass]) or Liquid Glass (lens refraction at the edges, rim, thickness shading and shadow). Everything the
 * theme and the context decide still applies: with `UiTheme(reduceTransparency = true)` or `highContrast = true` the glass
 * becomes opaque with a border, and glass inside another glass surface (see [MaterialSurface]) becomes a near-solid fill.
 *
 * It does not provide the nesting marker for children; use [MaterialSurface] when the surface has content that can be glass.
 *
 * @param glass the backdrop to blur; defaults to the one the overlay host provides. Null draws the tint without blur.
 * @param solid fill used when the material resolves to opaque.
 * @param interactionSource when given, a press on it brightens a Liquid surface and strengthens its lens; with motion enabled
 * the surface also swells, glows at the finger and turns its highlight toward it. Reduced motion keeps only the brightening.
 * @param style the Liquid look of this surface (optics, interaction, motion); defaults to [LocalLiquidGlassStyle], which
 * `UiTheme(liquidGlassStyle = ...)` sets. It only affects [SurfaceMaterial.Liquid] and [SurfaceMaterial.LiquidClear].
 */
@Composable
public fun Modifier.material(
    material: SurfaceMaterial,
    shape: Shape,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
    style: LiquidGlassStyle = LocalLiquidGlassStyle.current,
): Modifier {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    return liquidSurface(resolved, shape, solid, glass, interactionSource, style)
}

/**
 * A [Box] filled with [material] that also marks its children as inside glass, so glass nested in it falls back to a
 * near-solid fill (Apple: no glass on glass). See [material] for [interactionSource] and [style].
 */
@Composable
public fun MaterialSurface(
    material: SurfaceMaterial,
    shape: Shape,
    modifier: Modifier = Modifier,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
    style: LiquidGlassStyle = LocalLiquidGlassStyle.current,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    Box(modifier.liquidSurface(resolved, shape, solid, glass, interactionSource, style)) {
        GlassNesting(resolved) { content() }
    }
}

// The surface plus, for live Liquid glass, its dynamics: press swell, drag squash and the pointer observer that feeds them.
@Composable
private fun Modifier.liquidSurface(
    resolved: ResolvedMaterial,
    shape: Shape,
    solid: Color,
    glass: GlassState?,
    interactionSource: InteractionSource?,
    style: LiquidGlassStyle,
): Modifier {
    val live = resolved.liquid && resolved.isGlass
    val moves = live && needsDynamics(style, interactionSource, UiTheme.motion)
    val dynamics = if (moves) rememberLiquidDynamics(style, interactionSource) else null
    val reacts = dynamics != null && dynamics.motionOn && style.interaction != LiquidInteraction.None
    val swell = style.motion?.swell
    val flexed =
        if (reacts && swell != null && (interactionSource != null || style.interaction == LiquidInteraction.Drag)) {
            graphicsLayer {
                val grow = 1f + dynamics!!.lift() * swellFraction(swell.toPx(), size.width)
                scaleX = grow * dynamics.scaleX()
                scaleY = grow * dynamics.scaleY()
            }.then(dynamics!!.observer)
        } else {
            this
        }
    return flexed.surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass, dynamics = dynamics, style = style)
}

// Press and spring motion cost springs, animatables and effects; a Liquid surface pays for them only when something can move it:
// a press source, a drag, or the materialize ramp. Without any of them the lift stays 0 and the lens at full strength.
private fun needsDynamics(
    style: LiquidGlassStyle,
    source: InteractionSource?,
    motion: Motion,
): Boolean =
    source != null ||
        style.interaction == LiquidInteraction.Drag ||
        (liquidMotionActive(style, motion) && style.motion?.materialize != null)

/** Provides the "inside glass" marker to [content] when [resolved] is a glass or nested surface. */
@Composable
internal fun GlassNesting(
    resolved: ResolvedMaterial,
    content: @Composable () -> Unit,
) {
    when {
        resolved.providesNesting -> CompositionLocalProvider(LocalGlassNested provides true, content = content)
        // An opaque surface hides the page behind it, so glass inside it must not sample that page.
        resolved.mode == SurfaceMode.Solid -> CompositionLocalProvider(LocalGlassState provides null, content = content)
        else -> content()
    }
}

/**
 * The single place a component's surface is drawn. [container] and [outline] are the component's own opaque colors, used
 * when the surface is solid (the forced-opaque case swaps the border for a stronger one under high contrast).
 * [observe] is read in the draw phase so the backdrop offset follows a state-driven translation of an ancestor; [dynamics]
 * carries the Liquid press, materialize and pointer state read the same way. [style] only matters for Liquid materials (null:
 * [LocalLiquidGlassStyle]); solid, nested and frosted surfaces never read it.
 */
@Composable
internal fun Modifier.surfaceMaterial(
    resolved: ResolvedMaterial,
    shape: Shape,
    container: Color,
    outline: Color,
    glass: GlassState?,
    observe: (() -> Float)? = null,
    dynamics: LiquidDynamics? = null,
    style: LiquidGlassStyle? = null,
): Modifier {
    val colors = UiTheme.colors
    val borderWidth = UiTheme.sizes.borderWidth
    return when (resolved.mode) {
        SurfaceMode.Solid -> {
            val line =
                when {
                    resolved.highContrast -> colors.lineStrong
                    outline.isUnspecified && resolved.forcedOpaque -> colors.hair
                    else -> outline
                }
            val base = clip(shape).background(container)
            if (line.isSpecified) base.border(borderWidth, line, shape) else base
        }
        SurfaceMode.Nested -> clip(shape).background(colors.float).border(borderWidth, colors.hair, shape)
        SurfaceMode.Tint, SurfaceMode.Blur, SurfaceMode.Lens -> {
            val dark = LocalUiDark.current
            val liquid = resolved.liquid
            // Frosted glass draws the shared token constants and never reads the Liquid style.
            val look = if (liquid) style ?: LocalLiquidGlassStyle.current else LiquidGlassStyle.Regular
            val tokens =
                if (liquid) {
                    // A custom style builds new tokens; remembering them keeps the element equal across recompositions, so the
                    // node is not updated (and its lens rebuilt) on every recomposition of the caller.
                    remember(resolved.variant, dark, look) { look.applyTo(glassTokens(resolved.variant, dark)) }
                } else {
                    glassTokens(resolved.variant, dark)
                }
            val shadowed = if (liquid) liquidShadow(shape, look) else this
            shadowed.clip(shape) then
                GlassSurfaceElement(
                    shape = shape,
                    tokens = tokens,
                    blur = resolved.mode == SurfaceMode.Blur || resolved.mode == SurfaceMode.Lens,
                    lens = resolved.mode == SurfaceMode.Lens,
                    liquid = liquid,
                    base = colors.bg,
                    veil = if (resolved.mode == SurfaceMode.Tint) colors.float.copy(alpha = TINT_VEIL_ALPHA) else Color.Unspecified,
                    state = glass,
                    borderWidth = borderWidth,
                    observe = observe,
                    dynamics = dynamics,
                    style = look,
                )
        }
    }
}

internal val REFERENCE_SIZE: Dp = 56.dp

// The shadow is a stack of slightly larger copies of the silhouette, each faint: their sum falls off smoothly from the edge, with
// no blur or elevation API, so it looks the same on every target and can be pushed down by offsetY. It grows with the size of
// the surface. The opaque base of the glass hides the part under the surface.
private fun Modifier.liquidShadow(
    shape: Shape,
    style: LiquidGlassStyle,
): Modifier = if (style.shadow.opacity <= 0f || style.shadow.spread.value <= 0f) this else this then LiquidShadowElement(shape, style)

internal const val SHADOW_ALPHA = 0.26f
internal const val SHADOW_STEPS = 14

private data class LiquidShadowElement(
    val shape: Shape,
    val style: LiquidGlassStyle,
) : ModifierNodeElement<LiquidShadowNode>() {
    override fun create() = LiquidShadowNode(shape, style)

    override fun update(node: LiquidShadowNode) {
        node.shape = shape
        node.style = style
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "liquidShadow"
    }
}

private class LiquidShadowNode(
    var shape: Shape,
    var style: LiquidGlassStyle,
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
        clipPath(inside!!, ClipOp.Difference) { drawSoftShadow(outline!!, style.shadow, min(size.width, size.height)) }
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
    val reach = shadow.spread.toPx() * sizeScale(shortSide, REFERENCE_SIZE.toPx())
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
    val reach = shadow.spread.toPx() * sizeScale(shortSide, REFERENCE_SIZE.toPx())
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

private data class GlassSurfaceElement(
    val shape: Shape,
    val tokens: GlassMaterial,
    val blur: Boolean,
    val lens: Boolean,
    val liquid: Boolean,
    val base: Color,
    val veil: Color,
    val state: GlassState?,
    val borderWidth: Dp,
    val observe: (() -> Float)?,
    val dynamics: LiquidDynamics?,
    val style: LiquidGlassStyle,
) : ModifierNodeElement<GlassSurfaceNode>() {
    override fun create(): GlassSurfaceNode =
        GlassSurfaceNode(shape, tokens, blur, lens, liquid, base, veil, state, borderWidth, observe, dynamics, style)

    override fun update(node: GlassSurfaceNode) =
        node.update(shape, tokens, blur, lens, liquid, base, veil, state, borderWidth, observe, dynamics, style)

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSurface"
    }
}

private val EdgeFade: Dp = 28.dp

// Without a backdrop the glass tint cannot keep text legible over arbitrary content, so the tint fallback is a mostly opaque veil.
private const val TINT_VEIL_ALPHA = 0.9f

// Kyant's backdrop lens uses a refraction height up to the smallest corner radius and an amount about twice that; our samples
// stay inside the surface, so the amount is capped at the bevel itself.
private const val STRENGTH_PER_DEPTH = 1.1f
private const val LENS_COVERAGE = 1f
private val MAX_REFRACTION: Dp = 20.dp
private const val VEIL_EDGE = 0.35f
private const val GLINT_WIDTH_DP = 1.5f
private const val CONTOUR_WIDTH_DP = 0.75f
private const val PRESS_LENS_GAIN = 0.35f
private const val PRESS_BRIGHTEN = 0.14f
private const val GLOW_RADIUS = 0.55f
private const val SCALE_EPSILON = 0.002f
private const val LENS_INPUTS = 16

// What only a lensed surface needs: the platform engine, the last effect and the inputs it was built for, and the corner radii
// and superellipse exponent of the outline. Made on the first lensed draw, so frosted and tint surfaces never allocate it.
private class LensCache {
    val engine = LensEngine()
    var key: LensParams? = null
    var effect: RenderEffect? = null
    var stale = true
    val inputs = FloatArray(LENS_INPUTS)
    val scratch = FloatArray(LENS_INPUTS)
    val corners = FloatArray(4)
    var exponent = 2f
    private var outline: Outline? = null

    // From the sharpest corner, a pill or circle is an ellipse (2) and a sharp rectangle fills its corners (8).
    fun sync(
        made: Outline,
        size: Size,
    ) {
        if (made === outline) return
        outline = made
        made.cornerRadiiInto(corners)
        val half = min(size.width, size.height) * 0.5f
        exponent = 2f + 6f * (1f - (minOf(corners[0], corners[1], corners[2], corners[3]) / half.coerceAtLeast(1f)).coerceIn(0f, 1f))
        stale = true
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

private class GlassSurfaceNode(
    var shape: Shape,
    var tokens: GlassMaterial,
    var blur: Boolean,
    var lens: Boolean,
    var liquid: Boolean,
    var base: Color,
    var veil: Color,
    var state: GlassState?,
    var borderWidth: Dp,
    var observe: (() -> Float)?,
    var dynamics: LiquidDynamics?,
    var style: LiquidGlassStyle,
) : Modifier.Node(),
    DrawModifierNode,
    GlobalPositionAwareModifierNode {
    private var coordinates: LayoutCoordinates? = null

    // Made on the first draw that blurs (Android 12+ or Skia), so a tint surface never holds a layer.
    private var layer: GraphicsLayer? = null
    private var registered: GlassState? = null
    private var effectRadius = -1f
    private var effect: RenderEffect? = null
    private var lensCache: LensCache? = null
    private var rimCache: RimCache? = null
    private var lensApplied = false
    private var filterSaturation = -1f
    private var filter: ColorFilter? = null

    // Reused between frames: the outline, the border stroke and the frosted edge gradient.
    private var cachedOutline: Outline? = null
    private var outlineSize = Size.Unspecified
    private var outlineDirection: LayoutDirection? = null
    private var outlineDensity = 0f
    private var cachedStroke: Stroke? = null
    private var edgeBrush: Brush? = null
    private var edgeColor = Color.Unspecified
    private var edgeFade = -1f

    fun update(
        shape: Shape,
        tokens: GlassMaterial,
        blur: Boolean,
        lens: Boolean,
        liquid: Boolean,
        base: Color,
        veil: Color,
        state: GlassState?,
        borderWidth: Dp,
        observe: (() -> Float)?,
        dynamics: LiquidDynamics?,
        style: LiquidGlassStyle,
    ) {
        if (shape != this.shape) cachedOutline = null
        this.lens = lens
        this.liquid = liquid
        this.dynamics = dynamics
        this.style = style
        this.base = base
        this.veil = veil
        this.shape = shape
        this.tokens = tokens
        this.blur = blur
        this.state = state
        this.borderWidth = borderWidth
        this.observe = observe
        lensCache?.stale = true
        syncRegistration()
        invalidateDraw()
    }

    override fun onAttach() {
        syncRegistration()
    }

    override fun onDetach() {
        registered?.let { it.consumers = (it.consumers - 1).coerceAtLeast(0) }
        registered = null
        layer?.let { requireGraphicsContext().releaseGraphicsLayer(it) }
        layer = null
    }

    private fun syncRegistration() {
        val wanted = if (blur) state else null
        if (wanted === registered) return
        registered?.let { it.consumers = (it.consumers - 1).coerceAtLeast(0) }
        wanted?.let { it.consumers += 1 }
        registered = wanted
    }

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        this.coordinates = coordinates
    }

    // The light: the style's angle, turned toward the finger while it is down.
    private fun ContentDrawScope.light(
        pointer: Offset?,
        follow: Float,
    ): Offset {
        val own = lightFromAngle(style.specular.angleDegrees)
        val toward = pointer?.let { lightToward(it, size.width, size.height) }
        return if (toward != null) blendLight(own, toward, follow.coerceIn(0f, 1f)) else own
    }

    override fun ContentDrawScope.draw() {
        observe?.invoke()
        val pressed = dynamics?.lift?.invoke() ?: 0f
        val outline = outline()
        val source = state
        lensApplied = false
        if (blur && source != null && source.isRecording) {
            val blurLayer = layer ?: requireGraphicsContext().createGraphicsLayer().also { layer = it }
            // Opaque base: where the source is transparent (or ends) the content under the surface must not show through.
            drawRect(base)
            source.surfaceDraws++
            drawBackdrop(source, blurLayer, outline, pressed)
        }
        if (!lensApplied) {
            if (veil.isSpecified) {
                drawRect(veil)
            } else {
                drawRect(tokens.tint)
                drawRect(tokens.dim)
            }
        }
        if (liquid) {
            if (pressed > 0f) drawRect(Color.White.copy(alpha = PRESS_BRIGHTEN * pressed))
            if (lensApplied) {
                drawOutline(outline, tokens.border, style = borderStroke())
            } else {
                drawDirectionalRim(outline)
            }
        } else {
            drawFrostedEdge(outline)
        }
        drawContent()
    }

    private fun ContentDrawScope.borderStroke(): Stroke {
        val width = borderWidth.toPx() * 2f
        val kept = cachedStroke
        if (kept != null && kept.width == width) return kept
        return Stroke(width = width).also { cachedStroke = it }
    }

    private fun ContentDrawScope.drawFrostedEdge(outline: Outline) {
        val stroke = borderStroke()
        drawOutline(outline, tokens.border, style = stroke)
        val fade = EdgeFade.toPx().coerceAtMost(size.height).coerceAtLeast(1f)
        val edge = tokens.edge
        val kept = edgeBrush
        val brush =
            if (kept != null && edgeColor == edge && edgeFade == fade) {
                kept
            } else {
                edgeColor = edge
                edgeFade = fade
                Brush.verticalGradient(0f to edge, 1f to Color.Transparent, startY = 0f, endY = fade).also { edgeBrush = it }
            }
        drawOutline(outline, brush, style = stroke)
    }

    // A thin glint on the walls that face the light (top left, with a weaker one opposite), added on top of the glass so it
    // recolors the backdrop instead of painting white, plus a faint dark contour on the walls that face away.
    private fun ContentDrawScope.drawDirectionalRim(outline: Outline) {
        val rim = rimCache ?: RimCache().also { rimCache = it }
        val angle = style.specular.angleDegrees
        val lit = tokens.edge.copy(alpha = (tokens.edge.alpha * style.specular.intensity * style.rim).coerceIn(0f, 1f))
        val shade = 0.10f * style.rim
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

    // The lens covers the whole surface: its profile runs from the rim to the medial axis, half the short side deep, for every
    // shape. (LENS_COVERAGE is the fraction of that distance the edge term spans; 1 is the full surface.)
    private fun ContentDrawScope.bevel(): Float = (min(size.width, size.height) * 0.5f * LENS_COVERAGE).coerceAtLeast(1f)

    // The outline of the current size, made once per size (the lens derives its corner radii and exponent from it).
    private fun ContentDrawScope.outline(): Outline {
        val kept = cachedOutline
        if (kept != null && outlineSize == size && outlineDirection == layoutDirection && outlineDensity == density) return kept
        val made = shape.createOutline(size, layoutDirection, this)
        cachedOutline = made
        outlineSize = size
        outlineDirection = layoutDirection
        outlineDensity = density
        return made
    }

    private fun ContentDrawScope.drawBackdrop(
        source: GlassState,
        blurLayer: GraphicsLayer,
        outline: Outline,
        pressed: Float,
    ) {
        // Where the unscaled surface sits in the root. A swell or squash scales the layer this node is drawn in, so the position
        // in the root is that of the scaled top left; the backdrop is recorded in unscaled space, so take the (scale invariant)
        // center and recover the unscaled top left from it, and counter-scale the backdrop so it stays put under the glass.
        measureRootFrame()
        val scaleX = frameScaleX
        val scaleY = frameScaleY
        val dx = frameLeft - source.originX
        val dy = frameTop - source.originY
        val radius = tokens.blur.toPx()
        val depth = bevel()
        val materialize = dynamics?.materialize?.invoke() ?: 1f
        val strength =
            min(depth * STRENGTH_PER_DEPTH, MAX_REFRACTION.toPx()) * style.refraction.coerceAtLeast(0f) *
                (1f + PRESS_LENS_GAIN * pressed) * materialize * (if (style.profile == LiquidProfile.Convex) CONVEX_BEND else 1f)
        val reach = style.convexReach(size.width / 2f, size.height / 2f, strength)
        val pad = ceil(radius + reach).toInt()
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        blurLayer.topLeft = IntOffset(-pad, -pad)
        val pivot = Offset(dx + size.width / 2f, dy + size.height / 2f)
        blurLayer.record(this, layoutDirection, IntSize(width, height)) {
            if (lens) drawRect(base)
            translate(pad - dx, pad - dy) {
                if (scaleX == 1f && scaleY == 1f) {
                    drawLayer(source.layer)
                } else {
                    scale(1f / scaleX, 1f / scaleY, pivot) { drawLayer(source.layer) }
                }
            }
        }
        val lensed =
            if (lens) {
                val cache = lensCache ?: LensCache().also { lensCache = it }
                cache.sync(outline, size)
                lensFor(
                    cache,
                    pad,
                    depth,
                    strength,
                    radius,
                    pressed,
                    reach > 0f,
                    pad - dx,
                    pad - dy,
                    source.layer.size,
                )
            } else {
                null
            }
        lensApplied = lensed != null
        blurLayer.renderEffect = lensed ?: blurFor(radius)
        // The lens shader saturates the backdrop itself, before the veil.
        blurLayer.colorFilter = if (lensApplied) null else saturationFilter()
        drawLayer(blurLayer)
    }

    private fun saturationFilter(): ColorFilter? {
        if (tokens.saturate != filterSaturation) {
            filterSaturation = tokens.saturate
            filter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(tokens.saturate) })
        }
        return filter
    }

    private var frameLeft = 0f
    private var frameTop = 0f
    private var frameScaleX = 1f
    private var frameScaleY = 1f

    // Fills the frame* fields: the unscaled top left of this surface in the root and the scale of the layer it is drawn in.
    private fun ContentDrawScope.measureRootFrame() {
        val coords = coordinates?.takeIf { it.isAttached }
        if (coords == null) {
            frameLeft = 0f
            frameTop = 0f
            frameScaleX = 1f
            frameScaleY = 1f
            return
        }
        val topLeft = coords.localToRoot(Offset.Zero)
        val bottomRight = coords.localToRoot(Offset(size.width, size.height))
        val sx = ((bottomRight.x - topLeft.x) / size.width.coerceAtLeast(1f)).coerceIn(0.5f, 2f)
        val sy = ((bottomRight.y - topLeft.y) / size.height.coerceAtLeast(1f)).coerceIn(0.5f, 2f)
        frameLeft = (topLeft.x + bottomRight.x) / 2f - size.width / 2f
        frameTop = (topLeft.y + bottomRight.y) / 2f - size.height / 2f
        val flat = abs(sx - 1f) < SCALE_EPSILON && abs(sy - 1f) < SCALE_EPSILON
        frameScaleX = if (flat) 1f else sx
        frameScaleY = if (flat) 1f else sy
    }

    private fun blurFor(radius: Float): RenderEffect? {
        if (radius != effectRadius || effect == null) {
            effectRadius = radius
            effect = BlurEffect(radius, radius, TileMode.Clamp)
        }
        return effect
    }

    private fun ContentDrawScope.lensFor(
        cache: LensCache,
        pad: Int,
        depth: Float,
        strength: Float,
        radius: Float,
        pressed: Float,
        wide: Boolean,
        sourceLeft: Float,
        sourceTop: Float,
        sourceSize: IntSize,
    ): RenderEffect? {
        val pointer = dynamics?.pointer?.invoke()
        val follow = dynamics?.follow?.invoke() ?: 0f
        val light = light(pointer, follow)
        val rimDepth = rimDepthFor(style.bevelWidth.toPx(), depth)
        val half = min(size.width, size.height) * 0.5f
        val glowAlpha = (style.motion?.glow ?: 0f) * pressed
        val glowing = pointer != null && glowAlpha > 0f
        val glowX = if (glowing) size.width / 2f + rubberBand(pointer!!.x - size.width / 2f, size.width / 2f) else 0f
        val glowY = if (glowing) size.height / 2f + rubberBand(pointer!!.y - size.height / 2f, size.height / 2f) else 0f
        val shownGlow = if (pointer != null) glowAlpha else 0f
        val exponent = cache.exponent
        val corners = cache.corners
        // Everything that varies between frames; the effect is rebuilt only when one of them moved (a settled surface allocates nothing).
        val inputs = cache.scratch
        inputs[0] = size.width
        inputs[1] = size.height
        inputs[2] = pad.toFloat()
        inputs[3] = strength
        inputs[4] = radius
        inputs[5] = light.x
        inputs[6] = light.y
        inputs[7] = glowX
        inputs[8] = glowY
        inputs[9] = shownGlow
        inputs[10] = rimDepth
        inputs[11] = exponent
        inputs[12] = if (wide) sourceLeft else 0f
        inputs[13] = if (wide) sourceTop else 0f
        inputs[14] = sourceSize.width.toFloat()
        inputs[15] = sourceSize.height.toFloat()
        if (!cache.stale && cache.effect != null && inputs.contentEquals(cache.inputs)) return cache.effect
        inputs.copyInto(cache.inputs)
        cache.stale = false
        val params =
            LensParams(
                width = size.width,
                height = size.height,
                pad = pad.toFloat(),
                tl = corners[0],
                tr = corners[1],
                br = corners[2],
                bl = corners[3],
                exponent = exponent,
                strength = strength,
                dispersion = style.dispersion,
                blur = radius,
                // A wide (convex) lens reads beyond its own surface, up to the edge of the backdrop source (never past it, where
                // nothing was recorded); the others stay inside the surface.
                boundsLeft = if (wide) sourceLeft.coerceAtLeast(0f) else pad.toFloat(),
                boundsTop = if (wide) sourceTop.coerceAtLeast(0f) else pad.toFloat(),
                boundsRight = if (wide) (sourceLeft + sourceSize.width).coerceAtMost(size.width + pad * 2) else pad + size.width,
                boundsBottom = if (wide) (sourceTop + sourceSize.height).coerceAtMost(size.height + pad * 2) else pad + size.height,
                saturate = tokens.saturate,
                tintR = tokens.tint.red,
                tintG = tokens.tint.green,
                tintB = tokens.tint.blue,
                tintA = tokens.tint.alpha,
                dimR = tokens.dim.red,
                dimG = tokens.dim.green,
                dimB = tokens.dim.blue,
                dimA = tokens.dim.alpha,
                veilEdge = VEIL_EDGE,
                rimDepth = rimDepth.coerceAtLeast(1f),
                dome = style.domeAmount(),
                glintWidth = GLINT_WIDTH_DP.dp.toPx(),
                glintStrength = tokens.edge.alpha * style.specular.intensity.coerceAtLeast(0f),
                lightX = light.x,
                lightY = light.y,
                fresnel = style.fresnel,
                grain = style.grain,
                brightness = style.brightness,
                profile = style.profile.shaderCode(),
                band = (rimDepth / half).coerceIn(0.05f, 1f),
                thickness = style.rim * sizeScale(half, REFERENCE_SIZE.toPx() / 2f),
                glowX = pad + glowX,
                glowY = pad + glowY,
                glowRadius = max(size.width, size.height) * GLOW_RADIUS,
                glowAlpha = shownGlow,
            )
        if (params != cache.key) {
            cache.key = params
            cache.effect = cache.engine.effect(params)
        }
        return cache.effect
    }
}

/** Fills [into] with the top-left, top-right, bottom-right, bottom-left corner radius (x) of a rounded outline; zeros for anything else. */
private fun Outline.cornerRadiiInto(into: FloatArray) {
    if (this is Outline.Rounded) {
        into[0] = roundRect.topLeftCornerRadius.x
        into[1] = roundRect.topRightCornerRadius.x
        into[2] = roundRect.bottomRightCornerRadius.x
        into[3] = roundRect.bottomLeftCornerRadius.x
    } else {
        into.fill(0f)
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
