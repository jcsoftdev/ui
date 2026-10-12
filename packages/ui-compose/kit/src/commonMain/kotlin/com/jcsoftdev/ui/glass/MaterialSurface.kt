package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
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
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.ceil
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
 * the surface also flexes (a small scale). Reduced motion keeps only the brightening.
 */
@Composable
public fun Modifier.material(
    material: SurfaceMaterial,
    shape: Shape,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
): Modifier {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    val press = rememberPressProgress(interactionSource)
    val flex = press != null && resolved.liquid && resolved.isGlass && UiTheme.motion.enabled
    val flexed =
        if (flex) {
            graphicsLayer {
                scaleX = 1f + FLEX * press!!()
                scaleY = scaleX
            }
        } else {
            this
        }
    return flexed.surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass, press = press)
}

/**
 * A [Box] filled with [material] that also marks its children as inside glass, so glass nested in it falls back to a
 * near-solid fill (Apple: no glass on glass). See [material] for [interactionSource].
 */
@Composable
public fun MaterialSurface(
    material: SurfaceMaterial,
    shape: Shape,
    modifier: Modifier = Modifier,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    interactionSource: InteractionSource? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    val press = rememberPressProgress(interactionSource)
    val flex = press != null && resolved.liquid && resolved.isGlass && UiTheme.motion.enabled
    val flexed =
        if (flex) {
            modifier.graphicsLayer {
                scaleX = 1f + FLEX * press!!()
                scaleY = scaleX
            }
        } else {
            modifier
        }
    Box(flexed.surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass, press = press)) {
        GlassNesting(resolved) { content() }
    }
}

private const val FLEX = 0.03f

/** 0 to 1 while [source] is pressed, animated with the theme motion (a jump cut when motion is off); null without a source. */
@Composable
internal fun rememberPressProgress(source: InteractionSource?): (() -> Float)? {
    if (source == null) return null
    val pressed by source.collectIsPressedAsState()
    val progress by animateFloatAsState(if (pressed) 1f else 0f, UiTheme.motion.tween(Motion.FAST), label = "glassPress")
    return { progress }
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
 * [observe] is read in the draw phase so the backdrop offset follows a state-driven translation of an ancestor; [press] is
 * a 0 to 1 press progress read the same way.
 */
@Composable
internal fun Modifier.surfaceMaterial(
    resolved: ResolvedMaterial,
    shape: Shape,
    container: Color,
    outline: Color,
    glass: GlassState?,
    observe: (() -> Float)? = null,
    press: (() -> Float)? = null,
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
            val tokens = glassTokens(resolved.variant, LocalUiDark.current)
            val shadowed =
                if (resolved.liquid) {
                    shadow(
                        LIQUID_ELEVATION,
                        shape,
                        clip = false,
                        ambientColor = ShadowAmbient,
                        spotColor = ShadowSpot,
                    )
                } else {
                    this
                }
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
                    press = press,
                )
        }
    }
}

private val LIQUID_ELEVATION: Dp = 14.dp
private val ShadowAmbient = Color.Black.copy(alpha = 0.10f)
private val ShadowSpot = Color.Black.copy(alpha = 0.22f)

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
    val press: (() -> Float)?,
) : ModifierNodeElement<GlassSurfaceNode>() {
    override fun create(): GlassSurfaceNode =
        GlassSurfaceNode(shape, tokens, blur, lens, liquid, base, veil, state, borderWidth, observe, press)

    override fun update(node: GlassSurfaceNode) =
        node.update(shape, tokens, blur, lens, liquid, base, veil, state, borderWidth, observe, press)

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSurface"
    }
}

private val EdgeFade: Dp = 28.dp

// Without a backdrop the glass tint cannot keep text legible over arbitrary content, so the tint fallback is a mostly opaque veil.
private const val TINT_VEIL_ALPHA = 0.9f

private val MaxBezel: Dp = 32.dp
private val MinBezel: Dp = 8.dp

// Kyant's backdrop lens uses a refraction height up to the smallest corner radius and an amount about twice that; our samples
// stay inside the surface, so the amount is capped at the bevel itself.
private const val STRENGTH_PER_DEPTH = 1.6f
private const val VEIL_REACH = 0.7f
private const val BEVEL_STEPS = 16
private const val DISPERSION = 0.04f
private const val GLINT_WIDTH_DP = 1.5f
private const val CONTOUR_WIDTH_DP = 0.75f
private const val LIGHT_ANGLE = -125f
private const val THICKNESS_STEPS = 6
private const val PRESS_LENS_GAIN = 0.35f
private const val PRESS_BRIGHTEN = 0.14f

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
    var press: (() -> Float)?,
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
        press: (() -> Float)?,
    ) {
        this.lens = lens
        this.liquid = liquid
        this.press = press
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

    override fun ContentDrawScope.draw() {
        observe?.invoke()
        val pressed = press?.invoke() ?: 0f
        val outline = shape.createOutline(size, layoutDirection, this)
        val source = state
        val blurLayer = layer
        if (blur && source != null && blurLayer != null && source.isRecording) {
            // Opaque base: where the source is transparent (or ends) the content under the surface must not show through.
            drawRect(base)
            source.surfaceDraws++
            drawBackdrop(source, blurLayer, outline, pressed)
        }
        if (veil.isSpecified) {
            drawRect(veil)
        } else {
            if (liquid) {
                drawBeveledVeil(outline, tokens.tint)
                drawBeveledVeil(outline, tokens.dim)
            } else {
                drawRect(tokens.tint)
                drawRect(tokens.dim)
            }
        }
        if (liquid) {
            if (pressed > 0f) drawRect(Color.White.copy(alpha = PRESS_BRIGHTEN * pressed))
            drawLiquidRim(outline)
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

    // Liquid: a soft inner glow (thickness), shade along the lower edge, and a rim lit from the top left.
    private fun ContentDrawScope.drawLiquidRim(outline: Outline) {
        val w = size.width
        val h = size.height
        val rim = borderWidth.toPx() * 1.5f
        val thickness = min(min(w, h) * 0.18f, 14.dp.toPx())
        // Stacked strokes of shrinking width fade the thickness shading toward the center instead of ending on a hard line.
        for (step in 0 until THICKNESS_STEPS) {
            val band = thickness * 2f * (THICKNESS_STEPS - step) / THICKNESS_STEPS
            drawOutline(
                outline,
                Brush.linearGradient(
                    0f to Color.White.copy(alpha = 0.16f / THICKNESS_STEPS),
                    0.6f to Color.Transparent,
                    start = Offset.Zero,
                    end = Offset(w, h),
                ),
                style = Stroke(width = band),
            )
            drawOutline(
                outline,
                Brush.verticalGradient(
                    0.55f to Color.Transparent,
                    1f to Color.Black.copy(alpha = 0.08f / THICKNESS_STEPS),
                    startY = 0f,
                    endY = h,
                ),
                style = Stroke(width = band),
            )
        }
        drawDirectionalRim(outline)
    }

    // A thin glint on the walls that face the light (top left, with a weaker one opposite), added on top of the glass so it
    // recolors the backdrop instead of painting white, plus a faint dark contour on the walls that face away.
    private fun ContentDrawScope.drawDirectionalRim(outline: Outline) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val glint = GLINT_WIDTH_DP.dp.toPx()
        val lit = tokens.edge
        val sweep =
            sweepAround(
                center,
                LIGHT_ANGLE to lit,
                LIGHT_ANGLE + 180f to lit.copy(alpha = lit.alpha * 0.55f),
                spread = 55f,
                fade = Color.Transparent,
            )
        drawOutline(outline, sweep, style = Stroke(width = glint * 2f), blendMode = BlendMode.Plus)
        val away = sweepAround(center, LIGHT_ANGLE + 180f to Color.Black.copy(alpha = 0.10f), spread = 90f, fade = Color.Transparent)
        drawOutline(outline, away, style = Stroke(width = CONTOUR_WIDTH_DP.dp.toPx() * 2f))
        drawOutline(outline, tokens.border, style = Stroke(width = borderWidth.toPx() * 2f))
    }

    // The veil keeps its full strength where text sits and thins out toward the edge, across the bevel the lens bends, so the
    // refracted backdrop shows at the rim (as on Apple glass) while the worst-case text contrast at the center holds. Stacked
    // insets of equal alpha compose to a geometric ramp from one layer at the edge to all of them [BEVEL_STEPS] in.
    private fun ContentDrawScope.drawBeveledVeil(
        outline: Outline,
        color: Color,
    ) {
        if (color.alpha <= 0f) return
        val box = (outline as? Outline.Rounded)?.roundRect
        if (box == null) {
            drawRect(color)
            return
        }
        val reach = bevel(outline) * VEIL_REACH
        val layer = color.copy(alpha = 1f - (1f - color.alpha).pow(1f / BEVEL_STEPS))
        for (step in 0 until BEVEL_STEPS) {
            val inset = reach * step / BEVEL_STEPS
            drawPath(Path().apply { addRoundRect(box.insetBy(inset)) }, layer)
        }
    }

    private fun ContentDrawScope.bevel(outline: Outline): Float {
        val corner = outline.cornerRadii().filter { it > 0f }.minOrNull() ?: 0f
        return corner.coerceIn(MinBezel.toPx(), MaxBezel.toPx()).coerceAtMost(min(size.width, size.height) * 0.45f)
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
        val depth = bevel(outline)
        val strength = depth * STRENGTH_PER_DEPTH * (1f + PRESS_LENS_GAIN * pressed)
        val pad = ceil(radius).toInt()
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        if (tokens.saturate != filterSaturation) {
            filterSaturation = tokens.saturate
            filter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(tokens.saturate) })
        }
        blurLayer.topLeft = IntOffset(-pad, -pad)
        blurLayer.record(this, layoutDirection, IntSize(width, height)) {
            translate(pad - dx, pad - dy) { drawLayer(source.layer) }
        }
        blurLayer.renderEffect =
            if (lens) lensFor(outline, pad, depth, strength, radius) else blurFor(radius)
        blurLayer.colorFilter = filter
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
    ): RenderEffect? {
        val corners = outline.cornerRadii()
        val params =
            LensParams(
                size.width,
                size.height,
                pad.toFloat(),
                corners[0],
                corners[1],
                corners[2],
                corners[3],
                depth,
                strength,
                DISPERSION,
                radius,
                pad.toFloat(),
                pad.toFloat(),
                pad + size.width,
                pad + size.height,
            )
        if (params != lensKey) {
            lensKey = params
            lensEffect = lensEngine.effect(params)
        }
        return lensEffect ?: blurFor(radius)
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

private fun RoundRect.insetBy(i: Float): RoundRect {
    fun shrink(r: CornerRadius) = CornerRadius((r.x - i).coerceAtLeast(0f), (r.y - i).coerceAtLeast(0f))
    return RoundRect(
        left + i,
        top + i,
        right - i,
        bottom - i,
        shrink(topLeftCornerRadius),
        shrink(topRightCornerRadius),
        shrink(bottomRightCornerRadius),
        shrink(bottomLeftCornerRadius),
    )
}
