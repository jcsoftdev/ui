package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.isUnspecified
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.node.requireGraphicsContext
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiTheme
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
    val dynamics = if (live) rememberLiquidDynamics(style, interactionSource) else null
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
 * carries the Liquid press, materialize and pointer state read the same way. [style] only matters for Liquid materials.
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
    style: LiquidGlassStyle = LocalLiquidGlassStyle.current,
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
            val base = glassTokens(resolved.variant, LocalUiDark.current)
            val tokens = if (resolved.liquid) style.applyTo(base) else base
            val shadowed = if (resolved.liquid) liquidShadow(shape, style) else this
            shadowed.clip(shape) then
                GlassSurfaceElement(
                    shape = shape,
                    tokens = tokens,
                    blur = resolved.mode == SurfaceMode.Blur || resolved.mode == SurfaceMode.Lens,
                    lens = resolved.mode == SurfaceMode.Lens,
                    liquid = resolved.liquid,
                    base = colors.bg,
                    veil = if (resolved.mode == SurfaceMode.Tint) colors.float.copy(alpha = TINT_VEIL_ALPHA) else Color.Unspecified,
                    state = glass,
                    borderWidth = borderWidth,
                    observe = observe,
                    dynamics = dynamics,
                    style = style,
                )
        }
    }
}

private val REFERENCE_SIZE: Dp = 56.dp

// The shadow is a stack of slightly larger copies of the silhouette, each faint: their sum falls off smoothly from the edge, with
// no blur or elevation API, so it looks the same on every target and can be pushed down by offsetY. It grows with the size of
// the surface. The opaque base of the glass hides the part under the surface.
@Composable
private fun Modifier.liquidShadow(
    shape: Shape,
    style: LiquidGlassStyle,
): Modifier = if (style.shadow.opacity <= 0f || style.shadow.spread.value <= 0f) this else this then LiquidShadowElement(shape, style)

private const val SHADOW_ALPHA = 0.26f
private const val SHADOW_STEPS = 14

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
    override fun ContentDrawScope.draw() {
        val shadow = style.shadow
        val reach = shadow.spread.toPx() * sizeScale(min(size.width, size.height), REFERENCE_SIZE.toPx())
        val rounded = shape.createOutline(size, layoutDirection, this).asRoundRect()
        if (rounded != null && reach > 0f) {
            val edge = (SHADOW_ALPHA * shadow.opacity).coerceIn(0f, 0.95f)
            val each = (1.0 - (1.0 - edge).pow(1.0 / SHADOW_STEPS)).toFloat()
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
        drawContent()
    }
}

/** The outline as one rounded rectangle (its top-left corner radius stands for all four); null for free-form shapes. */
private fun Outline.asRoundRect(): RoundRect? =
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
    private var layer: GraphicsLayer? = null
    private var registered: GlassState? = null
    private var effectRadius = -1f
    private var effect: RenderEffect? = null
    private val lensEngine by lazy { LensEngine() }
    private var lensKey: LensParams? = null
    private var lensEffect: RenderEffect? = null
    private var lensApplied = false
    private var filterSaturation = -1f
    private var filter: ColorFilter? = null

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
        syncRegistration()
        invalidateDraw()
    }

    override fun onAttach() {
        layer = requireGraphicsContext().createGraphicsLayer()
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
        val outline = shape.createOutline(size, layoutDirection, this)
        val source = state
        val blurLayer = layer
        lensApplied = false
        if (blur && source != null && blurLayer != null && source.isRecording) {
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
                drawOutline(
                    outline,
                    tokens.border,
                    style = Stroke(width = borderWidth.toPx() * 2f),
                )
            } else {
                drawDirectionalRim(outline)
            }
        } else {
            drawFrostedEdge(outline)
        }
        drawContent()
    }

    private fun ContentDrawScope.drawFrostedEdge(outline: Outline) {
        val stroke = Stroke(width = borderWidth.toPx() * 2f)
        drawOutline(outline, tokens.border, style = stroke)
        val fade = EdgeFade.toPx().coerceAtMost(size.height).coerceAtLeast(1f)
        drawOutline(
            outline,
            Brush.verticalGradient(0f to tokens.edge, 1f to Color.Transparent, startY = 0f, endY = fade),
            style = stroke,
        )
    }

    // A thin glint on the walls that face the light (top left, with a weaker one opposite), added on top of the glass so it
    // recolors the backdrop instead of painting white, plus a faint dark contour on the walls that face away.
    private fun ContentDrawScope.drawDirectionalRim(outline: Outline) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val glint = GLINT_WIDTH_DP.dp.toPx()
        val angle = style.specular.angleDegrees
        val lit = tokens.edge.copy(alpha = (tokens.edge.alpha * style.specular.intensity * style.rim).coerceIn(0f, 1f))
        val sweep =
            sweepAround(
                center,
                angle to lit,
                angle + 180f to lit.copy(alpha = lit.alpha * 0.55f),
                spread = 55f,
                fade = Color.Transparent,
            )
        drawOutline(outline, sweep, style = Stroke(width = glint * 2f), blendMode = BlendMode.Plus)
        val away = sweepAround(center, angle + 180f to Color.Black.copy(alpha = 0.10f * style.rim), spread = 90f, fade = Color.Transparent)
        drawOutline(outline, away, style = Stroke(width = CONTOUR_WIDTH_DP.dp.toPx() * 2f))
        drawOutline(outline, tokens.border, style = Stroke(width = borderWidth.toPx() * 2f))
    }

    // The lens covers the whole surface: its profile runs from the rim to the medial axis, half the short side deep, for every
    // shape. (LENS_COVERAGE is the fraction of that distance the edge term spans; 1 is the full surface.)
    private fun ContentDrawScope.bevel(): Float = (min(size.width, size.height) * 0.5f * LENS_COVERAGE).coerceAtLeast(1f)

    // Superellipse exponent of the lens height field from the sharpest corner: a pill or circle is an ellipse (2), a sharp
    // rectangle fills its corners (8).
    private fun ContentDrawScope.squareness(outline: Outline): Float {
        val half = min(size.width, size.height) * 0.5f
        val sharpest = outline.cornerRadii().min()
        return 2f + 6f * (1f - (sharpest / half).coerceIn(0f, 1f))
    }

    private fun ContentDrawScope.drawBackdrop(
        source: GlassState,
        blurLayer: GraphicsLayer,
        outline: Outline,
        pressed: Float,
    ) {
        val position = coordinates?.positionInRoot() ?: Offset.Zero
        val dx = position.x - source.originX
        val dy = position.y - source.originY
        val radius = tokens.blur.toPx()
        val depth = bevel()
        val materialize = dynamics?.materialize?.invoke() ?: 1f
        val strength =
            min(depth * STRENGTH_PER_DEPTH, MAX_REFRACTION.toPx()) * style.refraction.coerceAtLeast(0f) *
                (1f + PRESS_LENS_GAIN * pressed) * materialize
        val pad = ceil(radius).toInt()
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        if (tokens.saturate != filterSaturation) {
            filterSaturation = tokens.saturate
            filter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(tokens.saturate) })
        }
        blurLayer.topLeft = IntOffset(-pad, -pad)
        blurLayer.record(this, layoutDirection, IntSize(width, height)) {
            if (lens) drawRect(base)
            translate(pad - dx, pad - dy) { drawLayer(source.layer) }
        }
        val lensed = if (lens) lensFor(outline, pad, depth, strength, radius, squareness(outline), pressed) else null
        lensApplied = lensed != null
        blurLayer.renderEffect = lensed ?: blurFor(radius)
        // The lens shader saturates the backdrop itself, before the veil.
        blurLayer.colorFilter = if (lensApplied) null else filter
        drawLayer(blurLayer)
    }

    private fun blurFor(radius: Float): RenderEffect? {
        if (radius != effectRadius || effect == null) {
            effectRadius = radius
            effect = BlurEffect(radius, radius, TileMode.Clamp)
        }
        return effect
    }

    private fun ContentDrawScope.lensFor(
        outline: Outline,
        pad: Int,
        depth: Float,
        strength: Float,
        radius: Float,
        exponent: Float,
        pressed: Float,
    ): RenderEffect? {
        val corners = outline.cornerRadii()
        val pointer = dynamics?.pointer?.invoke()
        val follow = dynamics?.follow?.invoke() ?: 0f
        val light = light(pointer, follow)
        val rimDepth = style.bevelWidth.toPx().coerceAtMost(depth)
        val half = min(size.width, size.height) * 0.5f
        val glowAlpha = (style.motion?.glow ?: 0f) * pressed
        val glowAt =
            if (pointer != null && glowAlpha > 0f) {
                Offset(
                    size.width / 2f + rubberBand(pointer.x - size.width / 2f, size.width / 2f),
                    size.height / 2f + rubberBand(pointer.y - size.height / 2f, size.height / 2f),
                )
            } else {
                Offset.Zero
            }
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
                boundsLeft = pad.toFloat(),
                boundsTop = pad.toFloat(),
                boundsRight = pad + size.width,
                boundsBottom = pad + size.height,
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
                glowX = pad + glowAt.x,
                glowY = pad + glowAt.y,
                glowRadius = max(size.width, size.height) * GLOW_RADIUS,
                glowAlpha = if (pointer != null) glowAlpha else 0f,
            )
        if (params != lensKey) {
            lensKey = params
            lensEffect = lensEngine.effect(params)
        }
        return lensEffect
    }
}

/** Top-left, top-right, bottom-right, bottom-left corner radius (x) of a rounded outline; zeros for anything else. */
private fun Outline.cornerRadii(): FloatArray =
    when (this) {
        is Outline.Rounded ->
            floatArrayOf(
                roundRect.topLeftCornerRadius.x,
                roundRect.topRightCornerRadius.x,
                roundRect.bottomRightCornerRadius.x,
                roundRect.bottomLeftCornerRadius.x,
            )
        else -> FloatArray(4)
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
