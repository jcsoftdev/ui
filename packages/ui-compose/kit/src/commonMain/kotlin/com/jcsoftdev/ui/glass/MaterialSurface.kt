package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
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

/**
 * Fills this node with [material] clipped to [shape]: solid ([solid]), or Liquid Glass (tint, dim, edge highlight, border,
 * and a blurred copy of [glass] where the platform allows). Everything the theme and the context decide still applies:
 * with `UiTheme(reduceTransparency = true)` or `highContrast = true` the glass becomes opaque with a border, and glass
 * inside another glass surface (see [MaterialSurface]) becomes a near-solid fill.
 *
 * It does not provide the nesting marker for children; use [MaterialSurface] when the surface has content that can be glass.
 *
 * @param glass the backdrop to blur; defaults to the one the overlay host provides. Null draws the tint without blur.
 * @param solid fill used when the material resolves to opaque.
 */
@Composable
public fun Modifier.material(
    material: SurfaceMaterial,
    shape: Shape,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
): Modifier {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    return surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass)
}

/**
 * A [Box] filled with [material] that also marks its children as inside glass, so glass nested in it falls back to a
 * near-solid fill (Apple: no glass on glass).
 */
@Composable
public fun MaterialSurface(
    material: SurfaceMaterial,
    shape: Shape,
    modifier: Modifier = Modifier,
    solid: Color = UiTheme.colors.float,
    glass: GlassState? = LocalGlassState.current,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    Box(modifier.surfaceMaterial(resolved, shape, solid, UiTheme.colors.hair, glass)) {
        GlassNesting(resolved) { content() }
    }
}

/** Provides the "inside glass" marker to [content] when [resolved] is a glass or nested surface. */
@Composable
internal fun GlassNesting(
    resolved: ResolvedMaterial,
    content: @Composable () -> Unit,
) {
    if (resolved.providesNesting) CompositionLocalProvider(LocalGlassNested provides true, content = content) else content()
}

/**
 * The single place a component's surface is drawn. [container] and [outline] are the component's own opaque colors, used
 * when the surface is solid (the forced-opaque case swaps the border for a stronger one under high contrast).
 * [observe] is read in the draw phase so the backdrop offset follows a state-driven translation of an ancestor.
 */
@Composable
internal fun Modifier.surfaceMaterial(
    resolved: ResolvedMaterial,
    shape: Shape,
    container: Color,
    outline: Color,
    glass: GlassState?,
    observe: (() -> Float)? = null,
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
        SurfaceMode.Tint, SurfaceMode.Blur -> {
            val tokens = glassTokens(resolved.variant, LocalUiDark.current)
            clip(shape) then
                GlassSurfaceElement(
                    shape = shape,
                    tokens = tokens,
                    blur = resolved.mode == SurfaceMode.Blur,
                    veil = if (resolved.mode == SurfaceMode.Tint) colors.float.copy(alpha = TINT_VEIL_ALPHA) else Color.Unspecified,
                    state = glass,
                    borderWidth = borderWidth,
                    observe = observe,
                )
        }
    }
}

private data class GlassSurfaceElement(
    val shape: Shape,
    val tokens: GlassMaterial,
    val blur: Boolean,
    val veil: Color,
    val state: GlassState?,
    val borderWidth: Dp,
    val observe: (() -> Float)?,
) : ModifierNodeElement<GlassSurfaceNode>() {
    override fun create(): GlassSurfaceNode = GlassSurfaceNode(shape, tokens, blur, veil, state, borderWidth, observe)

    override fun update(node: GlassSurfaceNode) = node.update(shape, tokens, blur, veil, state, borderWidth, observe)

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSurface"
    }
}

private val EdgeFade: Dp = 28.dp

// Without a backdrop the glass tint cannot keep text legible over arbitrary content, so the tint fallback is a mostly opaque veil.
private const val TINT_VEIL_ALPHA = 0.9f

private class GlassSurfaceNode(
    var shape: Shape,
    var tokens: GlassMaterial,
    var blur: Boolean,
    var veil: Color,
    var state: GlassState?,
    var borderWidth: Dp,
    var observe: (() -> Float)?,
) : Modifier.Node(),
    DrawModifierNode,
    GlobalPositionAwareModifierNode {
    private var coordinates: LayoutCoordinates? = null
    private var layer: GraphicsLayer? = null
    private var registered: GlassState? = null
    private var effectRadius = -1f
    private var effect: RenderEffect? = null
    private var filterSaturation = -1f
    private var filter: ColorFilter? = null

    fun update(
        shape: Shape,
        tokens: GlassMaterial,
        blur: Boolean,
        veil: Color,
        state: GlassState?,
        borderWidth: Dp,
        observe: (() -> Float)?,
    ) {
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
        val outline = shape.createOutline(size, layoutDirection, this)
        val source = state
        val blurLayer = layer
        if (blur && source != null && blurLayer != null && source.isRecording) drawBackdrop(source, blurLayer)
        if (veil.isSpecified) {
            drawRect(veil)
        } else {
            drawRect(tokens.tint)
            drawRect(tokens.dim)
        }
        val stroke = Stroke(width = borderWidth.toPx() * 2f)
        drawOutline(outline, tokens.border, style = stroke)
        val fade = EdgeFade.toPx().coerceAtMost(size.height).coerceAtLeast(1f)
        drawOutline(
            outline,
            Brush.verticalGradient(0f to tokens.edge, 1f to Color.Transparent, startY = 0f, endY = fade),
            style = stroke,
        )
        drawContent()
    }

    private fun ContentDrawScope.drawBackdrop(
        source: GlassState,
        blurLayer: GraphicsLayer,
    ) {
        val position = coordinates?.positionInRoot() ?: Offset.Zero
        val dx = position.x - source.originX
        val dy = position.y - source.originY
        val radius = tokens.blur.toPx()
        val pad = ceil(radius).toInt()
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        if (radius != effectRadius) {
            effectRadius = radius
            effect = BlurEffect(radius, radius, TileMode.Clamp)
        }
        if (tokens.saturate != filterSaturation) {
            filterSaturation = tokens.saturate
            filter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(tokens.saturate) })
        }
        blurLayer.topLeft = IntOffset(-pad, -pad)
        blurLayer.record(this, layoutDirection, IntSize(width, height)) {
            translate(pad - dx, pad - dy) { drawLayer(source.layer) }
        }
        blurLayer.renderEffect = effect
        blurLayer.colorFilter = filter
        drawLayer(blurLayer)
    }
}
