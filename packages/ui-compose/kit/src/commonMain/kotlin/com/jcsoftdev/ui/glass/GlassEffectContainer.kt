package com.jcsoftdev.ui.glass

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.node.requireDensity
import androidx.compose.ui.node.requireGraphicsContext
import androidx.compose.ui.node.requireLayoutDirection
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.ceil
import kotlin.math.min

/** Where one merged shape sits: its center and half size in the root, and its corner radius, all in pixels. */
internal class MergedShape(
    val centerX: Float,
    val centerY: Float,
    val halfWidth: Float,
    val halfHeight: Float,
    val radius: Float,
)

/** The shapes a [GlassEffectContainer] merges, by slot, and whether it merges at all on this platform. */
@Stable
internal class GlassEffectGroup {
    val shapes = mutableStateMapOf<Int, MergedShape>()
    var merged: Boolean by mutableStateOf(false)
    private val taken = BooleanArray(MAX_MERGED_SHAPES)

    /** The first free slot, or -1 when [MAX_MERGED_SHAPES] shapes are already merged. */
    fun claim(): Int {
        val slot = taken.indexOfFirst { !it }
        if (slot >= 0) taken[slot] = true
        return slot
    }

    fun release(slot: Int) {
        if (slot < 0) return
        taken[slot] = false
        shapes.remove(slot)
    }
}

private val LocalGlassEffectGroup = staticCompositionLocalOf<GlassEffectGroup?> { null }

/**
 * Merges the Liquid shapes of its children into one piece of glass: where two shapes (marked with [glassEffect]) come within
 * [LiquidGlassStyle.blend] of each other they flow together like drops of liquid, with one lens, one rim and one shadow per shape
 * across the joined outline. The shapes are joined with a signed-distance smooth union in the lens shader (Android 13+ AGSL, Skia
 * SkSL on desktop and iOS), so up to [MAX_MERGED_SHAPES] children merge; any further child, and every child where the lens shader
 * is unavailable (older Android, `UiTheme(backdropBlur = false)`, reduced transparency), is drawn as its own separate
 * [SurfaceMaterial.Liquid] surface instead.
 *
 * A merged piece is static: no press swell, drag squash or touch glow (use separate surfaces for those), and it draws the rim and
 * shadow of the style but no hairline border. Its refraction follows the joined outline in a band of [LiquidGlassStyle.bevelWidth].
 *
 * ```
 * GlassEffectContainer(Modifier.fillMaxWidth()) {
 *     Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
 *         repeat(3) { Box(Modifier.size(56.dp).glassEffect(CircleShape)) }
 *     }
 * }
 * ```
 *
 * @param style the Liquid look, including how far shapes pull into each other ([LiquidGlassStyle.blend]).
 * @param material [SurfaceMaterial.Liquid] or [SurfaceMaterial.LiquidClear]: the base tint and blur.
 * @param glass the backdrop to refract; defaults to the one the overlay host provides.
 */
@Composable
public fun GlassEffectContainer(
    modifier: Modifier = Modifier,
    style: LiquidGlassStyle = LocalLiquidGlassStyle.current,
    material: SurfaceMaterial = SurfaceMaterial.Liquid,
    glass: GlassState? = LocalGlassState.current,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    val group = remember { GlassEffectGroup() }
    val merged = resolved.liquid && resolved.mode == SurfaceMode.Lens
    group.merged = merged
    val tokens = style.applyTo(glassTokens(resolved.variant, LocalUiDark.current))
    val base = UiTheme.colors.bg
    val surface =
        if (merged) {
            modifier then MergedGlassElement(group, style, tokens, base, glass)
        } else {
            modifier
        }
    CompositionLocalProvider(LocalGlassEffectGroup provides group) {
        Box(surface) { content() }
    }
}

/**
 * Marks this node as one of the shapes of the enclosing [GlassEffectContainer], with [shape] as its outline (a rounded
 * rectangle: the sharpest corner radius is used for the merge). Outside a container, or when it does not merge, it is simply a
 * separate [SurfaceMaterial.Liquid] surface of [shape].
 */
@Composable
public fun Modifier.glassEffect(
    shape: Shape,
    style: LiquidGlassStyle = LocalLiquidGlassStyle.current,
    material: SurfaceMaterial = SurfaceMaterial.Liquid,
): Modifier {
    val group = LocalGlassEffectGroup.current
    val slot = remember(group) { group?.claim() ?: -1 }
    DisposableEffect(group, slot) { onDispose { group?.release(slot) } }
    return if (group != null && group.merged && slot >= 0) {
        this then MergedChildElement(group, slot, shape)
    } else {
        material(material, shape, style = style)
    }
}

private data class MergedChildElement(
    val group: GlassEffectGroup,
    val slot: Int,
    val shape: Shape,
) : ModifierNodeElement<MergedChildNode>() {
    override fun create() = MergedChildNode(group, slot, shape)

    override fun update(node: MergedChildNode) {
        node.shape = shape
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "glassEffect"
    }
}

private class MergedChildNode(
    val group: GlassEffectGroup,
    val slot: Int,
    var shape: Shape,
) : Modifier.Node(),
    GlobalPositionAwareModifierNode {
    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        if (!coordinates.isAttached) return
        val position = coordinates.positionInRoot()
        val size = Size(coordinates.size.width.toFloat(), coordinates.size.height.toFloat())
        val rounded = shape.createOutline(size, requireLayoutDirection(), requireDensity()).asRoundRect()
        val radius =
            rounded?.let {
                minOf(
                    it.topLeftCornerRadius.x,
                    it.topRightCornerRadius.x,
                    it.bottomRightCornerRadius.x,
                    it.bottomLeftCornerRadius.x,
                )
            }
                ?: 0f
        val next = MergedShape(position.x + size.width / 2f, position.y + size.height / 2f, size.width / 2f, size.height / 2f, radius)
        val old = group.shapes[slot]
        if (old == null || !old.sameAs(next)) group.shapes[slot] = next
    }

    override fun onDetach() {
        group.shapes.remove(slot)
    }
}

private fun MergedShape.sameAs(other: MergedShape) =
    centerX == other.centerX &&
        centerY == other.centerY &&
        halfWidth == other.halfWidth &&
        halfHeight == other.halfHeight &&
        radius == other.radius

private data class MergedGlassElement(
    val group: GlassEffectGroup,
    val style: LiquidGlassStyle,
    val tokens: GlassMaterial,
    val base: Color,
    val state: GlassState?,
) : ModifierNodeElement<MergedGlassNode>() {
    override fun create() = MergedGlassNode(group, style, tokens, base, state)

    override fun update(node: MergedGlassNode) {
        node.group = group
        node.style = style
        node.tokens = tokens
        node.base = base
        node.state = state
        node.sync()
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "mergedGlass"
    }
}

private class MergedGlassNode(
    var group: GlassEffectGroup,
    var style: LiquidGlassStyle,
    var tokens: GlassMaterial,
    var base: Color,
    var state: GlassState?,
) : Modifier.Node(),
    DrawModifierNode,
    GlobalPositionAwareModifierNode {
    private var coordinates: LayoutCoordinates? = null
    private var layer: GraphicsLayer? = null
    private var registered: GlassState? = null
    private val engine by lazy { LensEngine() }
    private var key: MergeParams? = null
    private var effect: RenderEffect? = null

    override fun onAttach() {
        layer = requireGraphicsContext().createGraphicsLayer()
        sync()
    }

    override fun onDetach() {
        registered?.let { it.consumers = (it.consumers - 1).coerceAtLeast(0) }
        registered = null
        layer?.let { requireGraphicsContext().releaseGraphicsLayer(it) }
        layer = null
    }

    fun sync() {
        if (state === registered) return
        registered?.let { it.consumers = (it.consumers - 1).coerceAtLeast(0) }
        state?.let { it.consumers += 1 }
        registered = state
    }

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        this.coordinates = coordinates
    }

    override fun ContentDrawScope.draw() {
        val source = state
        val backdrop = layer
        val origin = coordinates?.takeIf { it.isAttached }?.positionInRoot()
        val shapes =
            group.shapes.entries
                .sortedBy { it.key }
                .map { it.value }
        if (source == null || backdrop == null || origin == null || !source.isRecording || shapes.isEmpty()) {
            drawContent()
            return
        }
        for (shape in shapes) {
            val rect =
                RoundRect(
                    shape.centerX - origin.x - shape.halfWidth,
                    shape.centerY - origin.y - shape.halfHeight,
                    shape.centerX - origin.x + shape.halfWidth,
                    shape.centerY - origin.y + shape.halfHeight,
                    shape.radius,
                    shape.radius,
                )
            drawSoftShadow(rect, style.shadow, min(shape.halfWidth, shape.halfHeight) * 2f)
        }
        source.surfaceDraws++
        val blur = tokens.blur.toPx()
        val pad = ceil(blur).toInt()
        val width = size.width.toInt() + pad * 2
        val height = size.height.toInt() + pad * 2
        val dx = origin.x - source.originX
        val dy = origin.y - source.originY
        backdrop.topLeft = IntOffset(-pad, -pad)
        backdrop.record(this, layoutDirection, IntSize(width, height)) {
            drawRect(base)
            translate(pad - dx, pad - dy) { drawLayer(source.layer) }
        }
        val packed = FloatArray(shapes.size.coerceAtMost(MAX_MERGED_SHAPES) * 5)
        shapes.take(MAX_MERGED_SHAPES).forEachIndexed { i, s ->
            packed[i * 5] = s.centerX - origin.x + pad
            packed[i * 5 + 1] = s.centerY - origin.y + pad
            packed[i * 5 + 2] = s.halfWidth
            packed[i * 5 + 3] = s.halfHeight
            packed[i * 5 + 4] = s.radius
        }
        val smallestHalf = shapes.minOf { min(it.halfWidth, it.halfHeight) }.coerceAtLeast(1f)
        val params = MergeParams(packed, packed.size / 5, style.blend.toPx().coerceAtLeast(0.5f), lensParams(pad, blur, smallestHalf))
        if (params != key) {
            key = params
            effect = engine.merged(params)
        }
        backdrop.renderEffect = effect
        drawLayer(backdrop)
        drawContent()
    }

    private fun ContentDrawScope.lensParams(
        pad: Int,
        blur: Float,
        smallestHalf: Float,
    ): LensParams {
        val light = lightFromAngle(style.specular.angleDegrees)
        return LensParams(
            width = size.width,
            height = size.height,
            pad = pad.toFloat(),
            tl = 0f,
            tr = 0f,
            br = 0f,
            bl = 0f,
            exponent = 2f,
            strength = min(smallestHalf * 1.1f, 20.dp.toPx()) * style.refraction.coerceAtLeast(0f),
            dispersion = style.dispersion,
            blur = blur,
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
            veilEdge = 0.35f,
            rimDepth =
                style.bevelWidth
                    .toPx()
                    .coerceAtMost(smallestHalf)
                    .coerceAtLeast(1f),
            glintWidth = 1.5f.dp.toPx(),
            glintStrength = tokens.edge.alpha * style.specular.intensity.coerceAtLeast(0f),
            lightX = light.x,
            lightY = light.y,
            fresnel = style.fresnel,
            grain = style.grain,
            brightness = style.brightness,
            thickness = style.rim * sizeScale(smallestHalf, REFERENCE_SIZE.toPx() / 2f),
        )
    }
}
