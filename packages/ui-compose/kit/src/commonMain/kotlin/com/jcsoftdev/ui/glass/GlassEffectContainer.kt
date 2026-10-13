package com.jcsoftdev.ui.glass

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.RememberObserver
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
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

/**
 * The shapes a [GlassEffectContainer] merges, by slot, whether it merges at all on this platform, and the [material] the
 * container gives its children. Everything the container's draw reads is cached per [revision], so a frame in
 * which no shape moved allocates nothing.
 */
@Stable
internal class GlassEffectGroup {
    private val table = HashMap<Int, MergedShape>()
    private var sortedCache: List<MergedShape> = emptyList()
    private var sortedRevision = -1
    private val taken = BooleanArray(MAX_MERGED_SHAPES)

    /** Bumps whenever a shape is added, moved, resized or removed; the container's draw reads it to redraw. */
    var revision: Int by mutableIntStateOf(0)
        private set

    /** Bumps whenever a slot is released, so a child that was over the cap can try to claim it. */
    var released: Int by mutableIntStateOf(0)
        private set
    var merged: Boolean by mutableStateOf(false)
    var material: LiquidGlass? by mutableStateOf(null)
    var glass: GlassState? by mutableStateOf(null)

    /** The first free slot, or -1 when [MAX_MERGED_SHAPES] shapes are already merged. */
    fun claim(): Int {
        val slot = taken.indexOfFirst { !it }
        if (slot >= 0) taken[slot] = true
        return slot
    }

    fun release(slot: Int) {
        if (slot < 0) return
        taken[slot] = false
        remove(slot)
        released++
    }

    fun put(
        slot: Int,
        shape: MergedShape,
    ) {
        val old = table[slot]
        if (old != null && old.sameAs(shape)) return
        table[slot] = shape
        revision++
    }

    fun remove(slot: Int) {
        if (table.remove(slot) != null) revision++
    }

    /** The shapes in slot order. Reads [revision], so a draw that calls it is redrawn when a shape changes. */
    fun sorted(): List<MergedShape> {
        val current = revision
        if (current != sortedRevision) {
            sortedCache = table.entries.sortedBy { it.key }.map { it.value }
            sortedRevision = current
        }
        return sortedCache
    }

    /**
     * Whether a child that asks for [childMaterial] (null: no preference) is drawn with the container's own look. A child that
     * explicitly asks for something else is not merged: it is its own surface of what it asked for.
     */
    fun accepts(childMaterial: LiquidGlass?): Boolean = childMaterial == null || childMaterial == material
}

/** A child's hold on one slot of a [GlassEffectGroup]; released when the child leaves the composition or is abandoned. */
internal class SlotClaim(
    private val group: GlassEffectGroup,
) : RememberObserver {
    var slot: Int = group.claim()
        private set

    /** Tries again; [releasedCount] is the group's release counter, read by the caller so it recomposes when a slot frees up. */
    fun retry(releasedCount: Int) {
        if (slot < 0 && releasedCount >= 0) slot = group.claim()
    }

    override fun onRemembered() = Unit

    override fun onForgotten() = giveBack()

    override fun onAbandoned() = giveBack()

    private fun giveBack() {
        group.release(slot)
        slot = -1
    }
}

internal val LocalGlassEffectGroup = staticCompositionLocalOf<GlassEffectGroup?> { null }

/**
 * Merges the Liquid shapes of its children into one piece of glass: where two shapes (marked with [glassEffect]) come within
 * [LiquidGlass.blend] of each other they flow together like drops of liquid, with one lens, one rim and one shadow per shape
 * across the joined outline. The shapes are joined with a signed-distance smooth union in the lens shader (Android 13+ AGSL, Skia
 * SkSL on desktop and iOS), so up to [MAX_MERGED_SHAPES] children merge; any further child, every child where the lens shader is
 * unavailable (older Android, `UiTheme(backdropBlur = false)`, reduced transparency), and every child of a [material] without a
 * [LiquidGlass.lens], is drawn as its own separate surface of [material] instead.
 *
 * **Material precedence.** The container's [material] is what its children get: a child drawn merged is part of the one joined
 * surface and takes it from the container, and a child that falls back to its own surface (over the cap, or where the lens shader
 * is unavailable) is drawn with the container's [material] too; the container's `glass` is the backdrop they sample as well. A
 * child that passes its own `material` to [glassEffect] that differs from the container's wins: it is drawn as a separate surface
 * of its own look and does not merge. (Child explicit, then container.)
 *
 * A merged piece is static: no press swell, drag squash or touch glow (use separate surfaces for those), and it draws the rim and
 * shadow of the material but no hairline border. Its refraction follows the joined outline in a band of [LiquidGlass.bevelWidth],
 * whatever the lens profile. The shadow is cast once from the union of the shapes (each ring of the shadow stack is one path), so
 * it does not double where shapes overlap. It does not follow the smooth neck itself: where shapes are closer than the shadow
 * reaches, their shadows meet and fill the gap, and a neck wider than that shows less shadow under it than under the shapes.
 *
 * ```
 * GlassEffectContainer(Modifier.fillMaxWidth()) {
 *     Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
 *         repeat(3) { Box(Modifier.size(56.dp).glassEffect(CircleShape)) }
 *     }
 * }
 * ```
 *
 * @param material the Liquid look, including how far shapes pull into each other ([LiquidGlass.blend]); it merges only with a lens.
 * @param glass the backdrop to refract; defaults to the one the overlay host provides.
 */
@Composable
public fun GlassEffectContainer(
    modifier: Modifier = Modifier,
    material: LiquidGlass = LiquidGlass.Regular,
    glass: GlassState? = LocalGlassState.current,
    content: @Composable BoxScope.() -> Unit,
) {
    val resolved = rememberResolvedMaterial(material, SurfaceRole.Content, glass)
    val group = remember { GlassEffectGroup() }
    val lens = material.lens
    val merged = lens != null && resolved.mode == SurfaceMode.Lens
    group.merged = merged
    group.material = material
    group.glass = glass
    val surface =
        if (merged) {
            val dark = LocalUiDark.current
            // Remembered so a custom material does not make new tokens, and update the merged node, on every recomposition.
            val tokens = remember(material, dark) { material.tokens(dark) }
            modifier then MergedGlassElement(group, material, lens!!, tokens, UiTheme.colors.bg, glass)
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
 * separate Liquid surface of [shape].
 *
 * [material] defaults to null, meaning "the container's" (and, outside a container, [LiquidGlass.Regular]). Passing one that
 * differs from the container's makes this child a separate surface of that look instead of a merged shape; see
 * [GlassEffectContainer] for the precedence.
 */
@Composable
public fun Modifier.glassEffect(
    shape: Shape,
    material: LiquidGlass? = null,
): Modifier {
    val group = LocalGlassEffectGroup.current
    val joins = group != null && group.accepts(material)
    val claim = remember(group, joins) { if (joins) SlotClaim(group!!) else null }
    if (claim != null && claim.slot < 0) claim.retry(group!!.released)
    val slot = claim?.slot ?: -1
    return if (group != null && group.merged && slot >= 0) {
        this then MergedChildElement(group, slot, shape)
    } else {
        material(
            material ?: group?.material ?: LiquidGlass.Regular,
            shape,
            glass = if (group != null) group.glass else LocalGlassState.current,
        )
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
        group.put(slot, next)
    }

    override fun onDetach() {
        group.remove(slot)
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
    val material: LiquidGlass,
    val lens: LiquidLens,
    val tokens: GlassMaterial,
    val base: Color,
    val state: GlassState?,
) : ModifierNodeElement<MergedGlassNode>() {
    override fun create() = MergedGlassNode(group, material, lens, tokens, base, state)

    override fun update(node: MergedGlassNode) {
        node.group = group
        node.material = material
        node.lens = lens
        node.tokens = tokens
        node.base = base
        node.state = state
        node.materialChanged()
        node.sync()
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "mergedGlass"
    }
}

private class MergedGlassNode(
    var group: GlassEffectGroup,
    var material: LiquidGlass,
    var lens: LiquidLens,
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
    private var keyProgram: MergeProgram? = null
    private var effect: RenderEffect? = null

    // What the last draw computed, reused while the shapes, the container and the material stay as they were.
    private var shapes: List<MergedShape> = emptyList()
    private var relative = FloatArray(0)
    private var shadowPaths: Array<Path>? = null
    private var shadowKey: LiquidShadow? = null
    private var shadowDensity = 0f
    private var scratch = FloatArray(0)
    private var smallestHalf = 1f
    private var lastPad = -1
    private var lastSize = Size.Unspecified
    private var lastBlur = -1f
    private var lastBlend = -1f
    private var lastDensity = -1f
    private var lastOrigin = Offset.Unspecified
    private var seenOrigin = Offset.Unspecified
    private var inputsStale = true

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

    fun materialChanged() {
        inputsStale = true
        shadowPaths = null
        shadowKey = null
    }

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        this.coordinates = coordinates
        // The backdrop under the container follows its position in the root, so a move redraws it even when no shape changed.
        val origin = if (coordinates.isAttached) coordinates.positionInRoot() else Offset.Unspecified
        if (origin != lastOrigin) {
            lastOrigin = origin
            invalidateDraw()
        }
    }

    override fun ContentDrawScope.draw() {
        val source = state
        val backdrop = layer
        val origin = coordinates?.takeIf { it.isAttached }?.positionInRoot()
        val current = group.sorted()
        if (source == null || backdrop == null || origin == null || !source.isRecording || current.isEmpty()) {
            drawContent()
            return
        }
        val geometryChanged = syncShapes(current, origin)
        drawShadow(geometryChanged)
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
        backdrop.renderEffect = effectFor(geometryChanged, pad, blur)
        drawLayer(backdrop)
        drawContent()
    }

    // Container-relative geometry of the shapes. Returns true when it differs from the previous draw.
    private fun syncShapes(
        current: List<MergedShape>,
        origin: Offset,
    ): Boolean {
        if (current === shapes && origin == seenOrigin) return false
        shapes = current
        seenOrigin = origin
        val count = current.size.coerceAtMost(MAX_MERGED_SHAPES)
        if (scratch.size != count * 5) scratch = FloatArray(count * 5)
        for (i in 0 until count) {
            val s = current[i]
            scratch[i * 5] = s.centerX - origin.x
            scratch[i * 5 + 1] = s.centerY - origin.y
            scratch[i * 5 + 2] = s.halfWidth
            scratch[i * 5 + 3] = s.halfHeight
            scratch[i * 5 + 4] = s.radius
        }
        if (scratch.contentEquals(relative)) return false
        val swap = relative
        relative = scratch
        scratch = if (swap.size == count * 5) swap else FloatArray(count * 5)
        shadowPaths = null
        smallestHalf = current.take(count).minOf { min(it.halfWidth, it.halfHeight) }.coerceAtLeast(1f)
        return true
    }

    // One shadow for the joined outline: each ring of the stack is the union of the grown shapes, so it does not double where
    // shapes overlap and it spans the neck between them.
    private fun ContentDrawScope.drawShadow(geometryChanged: Boolean) {
        val shadow = material.shadow
        if (shadow.opacity <= 0f || shadow.spread.value <= 0f) return
        if (geometryChanged || shadowPaths == null || shadowKey != shadow || shadowDensity != density) {
            shadowPaths = buildShadowPaths(shadow)
            shadowKey = shadow
            shadowDensity = density
        }
        val paths = shadowPaths ?: return
        val color = Color.Black.copy(alpha = shadowStepAlpha(shadow))
        translate(0f, shadow.offsetY.toPx()) {
            for (path in paths) drawPath(path, color)
        }
    }

    private fun DrawScope.buildShadowPaths(shadow: LiquidShadow): Array<Path> {
        val count = relative.size / 5
        return Array(SHADOW_STEPS) { index ->
            val k = SHADOW_STEPS - index
            var ring = Path()
            for (i in 0 until count) {
                val halfW = relative[i * 5 + 2]
                val halfH = relative[i * 5 + 3]
                val reach = shadow.spread.toPx() * sizeScale(min(halfW, halfH) * 2f, REFERENCE_SIZE_DP.dp.toPx())
                val grow = reach * k / SHADOW_STEPS
                val radius = relative[i * 5 + 4] + grow
                val one =
                    Path().apply {
                        addRoundRect(
                            RoundRect(
                                relative[i * 5] - halfW - grow,
                                relative[i * 5 + 1] - halfH - grow,
                                relative[i * 5] + halfW + grow,
                                relative[i * 5 + 1] + halfH + grow,
                                radius,
                                radius,
                            ),
                        )
                    }
                ring = if (i == 0) one else Path.combine(PathOperation.Union, ring, one)
            }
            ring
        }
    }

    private fun ContentDrawScope.effectFor(
        geometryChanged: Boolean,
        pad: Int,
        blur: Float,
    ): RenderEffect? {
        val blend = material.blend.toPx().coerceAtLeast(0.5f)
        val unchanged =
            !geometryChanged &&
                !inputsStale &&
                pad == lastPad &&
                size == lastSize &&
                blur == lastBlur &&
                blend == lastBlend &&
                density == lastDensity
        if (unchanged) return effect
        lastPad = pad
        lastSize = size
        lastBlur = blur
        lastBlend = blend
        lastDensity = density
        inputsStale = false
        val count = relative.size / 5
        val padded = FloatArray(count * 5)
        for (i in 0 until count) {
            padded[i * 5] = relative[i * 5] + pad
            padded[i * 5 + 1] = relative[i * 5 + 1] + pad
            padded[i * 5 + 2] = relative[i * 5 + 2]
            padded[i * 5 + 3] = relative[i * 5 + 3]
            padded[i * 5 + 4] = relative[i * 5 + 4]
        }
        val fresh = MergeParams(padded, count, blend, lensParams(pad, blur, smallestHalf))
        val program = lens.dispersion?.mergeProgram ?: PlainMergeProgram.value
        if (fresh != key || program !== keyProgram) {
            key = fresh
            keyProgram = program
            effect = engine.merged(program, fresh)
        }
        return effect
    }

    private fun ContentDrawScope.lensParams(
        pad: Int,
        blur: Float,
        smallestHalf: Float,
    ): LensParams {
        val light = lightFromAngle(material.specular.angleDegrees)
        return LensParams(
            width = size.width,
            height = size.height,
            pad = pad.toFloat(),
            tl = 0f,
            tr = 0f,
            br = 0f,
            bl = 0f,
            exponent = 2f,
            strength = min(smallestHalf * 1.1f, 20.dp.toPx()) * lens.refraction.coerceAtLeast(0f),
            dispersion = lens.dispersion?.amount ?: 0f,
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
            rimDepth = rimDepthFor(material.bevelWidth.toPx(), smallestHalf),
            glintWidth = 1.5f.dp.toPx(),
            glintStrength = tokens.edge.alpha * material.specular.intensity.coerceAtLeast(0f),
            lightX = light.x,
            lightY = light.y,
            fresnel = material.fresnel,
            grain = material.grain,
            brightness = material.brightness,
            thickness = material.rim * sizeScale(smallestHalf, REFERENCE_SIZE_DP.dp.toPx() / 2f),
        )
    }
}
