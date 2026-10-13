package com.jcsoftdev.ui.glass

import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.requireGraphicsContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import com.jcsoftdev.ui.theme.GlassMaterial
import kotlin.math.abs

// Without a backdrop the glass tint cannot keep text legible over arbitrary content, so the tint fallback is a mostly opaque veil.
internal const val TINT_VEIL_ALPHA = 0.9f

private const val SCALE_EPSILON = 0.002f

/**
 * What every glass surface shares, frosted or Liquid: the registration with its [GlassState], the backdrop layer (made on the
 * first draw that blurs, so a tint surface never holds one), where the surface sits in the root, the outline and border caches,
 * the blur and the saturation filter. The look itself is the subclass's draw.
 */
internal abstract class BackdropSurfaceNode(
    var shape: Shape,
    var tokens: GlassMaterial,
    var blur: Boolean,
    var base: Color,
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

    private var cachedOutline: Outline? = null
    private var outlineSize = Size.Unspecified
    private var outlineDirection: LayoutDirection? = null
    private var outlineDensity = 0f
    private var cachedStroke: Stroke? = null

    /** The unscaled top left of this surface in the root and the scale of the layer it is drawn in, from [measureRootFrame]. */
    protected var frameLeft = 0f
    protected var frameTop = 0f
    protected var frameScaleX = 1f
    protected var frameScaleY = 1f

    fun updateBackdrop(
        shape: Shape,
        tokens: GlassMaterial,
        blur: Boolean,
        base: Color,
        veil: Color,
        state: GlassState?,
        borderWidth: Dp,
        observe: (() -> Float)?,
    ) {
        if (shape != this.shape) cachedOutline = null
        this.shape = shape
        this.tokens = tokens
        this.blur = blur
        this.base = base
        this.veil = veil
        this.state = state
        this.borderWidth = borderWidth
        this.observe = observe
        syncRegistration()
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

    /** The backdrop to draw now, or null when this surface does not blur or nothing records it. */
    protected fun recordingSource(): GlassState? = state?.takeIf { blur && it.isRecording }

    /** The layer the backdrop is recorded into. */
    protected fun backdropLayer(): GraphicsLayer = layer ?: requireGraphicsContext().createGraphicsLayer().also { layer = it }

    /** The outline of the current size, made once per size. */
    protected fun ContentDrawScope.outline(): Outline {
        val kept = cachedOutline
        if (kept != null && outlineSize == size && outlineDirection == layoutDirection && outlineDensity == density) return kept
        val made = shape.createOutline(size, layoutDirection, this)
        cachedOutline = made
        outlineSize = size
        outlineDirection = layoutDirection
        outlineDensity = density
        return made
    }

    protected fun ContentDrawScope.borderStroke(): Stroke {
        val width = borderWidth.toPx() * 2f
        val kept = cachedStroke
        if (kept != null && kept.width == width) return kept
        return Stroke(width = width).also { cachedStroke = it }
    }

    /** The tint fallback veil, or the token tint and dim, over whatever the backdrop drew. */
    protected fun ContentDrawScope.drawVeil() {
        if (veil.isSpecified) {
            drawRect(veil)
        } else {
            drawRect(tokens.tint)
            drawRect(tokens.dim)
        }
    }

    /**
     * Records [source] into [blurLayer], [pad] px beyond the surface on every side, and positions the layer under the surface.
     * A swell or squash scales the layer this node is drawn in, so the position in the root is that of the scaled top left; the
     * backdrop is recorded in unscaled space, so the (scale invariant) center gives the unscaled top left, and the backdrop is
     * counter-scaled so it stays put under the glass. [opaqueBase] fills the layer first (the lens samples beyond the source).
     */
    protected fun ContentDrawScope.recordBackdrop(
        source: GlassState,
        blurLayer: GraphicsLayer,
        pad: Int,
        opaqueBase: Boolean,
    ) {
        val dx = frameLeft - source.originX
        val dy = frameTop - source.originY
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        val scaleX = frameScaleX
        val scaleY = frameScaleY
        blurLayer.topLeft = IntOffset(-pad, -pad)
        val pivot = Offset(dx + size.width / 2f, dy + size.height / 2f)
        blurLayer.record(this, layoutDirection, IntSize(width, height)) {
            if (opaqueBase) drawRect(base)
            translate(pad - dx, pad - dy) {
                if (scaleX == 1f && scaleY == 1f) {
                    drawLayer(source.layer)
                } else {
                    scale(1f / scaleX, 1f / scaleY, pivot) { drawLayer(source.layer) }
                }
            }
        }
    }

    // Fills the frame* fields: the unscaled top left of this surface in the root and the scale of the layer it is drawn in.
    protected fun ContentDrawScope.measureRootFrame() {
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

    protected fun blurFor(radius: Float): RenderEffect? {
        if (radius != effectRadius || effect == null) {
            effectRadius = radius
            effect = BlurEffect(radius, radius, TileMode.Clamp)
        }
        return effect
    }

    protected fun saturationFilter(): ColorFilter? {
        if (tokens.saturate != filterSaturation) {
            filterSaturation = tokens.saturate
            filter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(tokens.saturate) })
        }
        return filter
    }
}
