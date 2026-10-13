package com.jcsoftdev.ui.glass

import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import com.jcsoftdev.ui.theme.UiGlass
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.ceil

/** Frosted glass: blur, tint, dim, edge highlight and border. [SurfaceMaterial.Glass] and [SurfaceMaterial.GlassClear]. */
internal class FrostedGlass(
    private val clear: Boolean,
) : SurfaceMaterial() {
    override fun tokens(dark: Boolean): GlassMaterial =
        when {
            clear -> if (dark) UiGlass.ClearDark else UiGlass.ClearLight
            else -> if (dark) UiGlass.RegularDark else UiGlass.RegularLight
        }

    @Composable
    override fun glassSurface(
        modifier: Modifier,
        resolved: ResolvedMaterial,
        shape: Shape,
        glass: GlassState?,
        observe: (() -> Float)?,
        interactionSource: InteractionSource?,
        interactive: Boolean,
    ): Modifier {
        val colors = UiTheme.colors
        return modifier.clip(shape) then
            FrostedSurfaceElement(
                shape = shape,
                tokens = tokens(LocalUiDark.current),
                blur = resolved.mode != SurfaceMode.Tint,
                base = colors.bg,
                veil = if (resolved.mode == SurfaceMode.Tint) colors.float.copy(alpha = TINT_VEIL_ALPHA) else Color.Unspecified,
                state = glass,
                borderWidth = UiTheme.sizes.borderWidth,
                observe = observe,
            )
    }

    override fun toString(): String = if (clear) "GlassClear" else "Glass"
}

internal val FrostedRegular: SurfaceMaterial = FrostedGlass(clear = false)
internal val FrostedClear: SurfaceMaterial = FrostedGlass(clear = true)

private val EdgeFade: Dp = 28.dp

private data class FrostedSurfaceElement(
    val shape: Shape,
    val tokens: GlassMaterial,
    val blur: Boolean,
    val base: Color,
    val veil: Color,
    val state: GlassState?,
    val borderWidth: Dp,
    val observe: (() -> Float)?,
) : ModifierNodeElement<FrostedSurfaceNode>() {
    override fun create(): FrostedSurfaceNode = FrostedSurfaceNode(shape, tokens, blur, base, veil, state, borderWidth, observe)

    override fun update(node: FrostedSurfaceNode) {
        node.updateBackdrop(shape, tokens, blur, base, veil, state, borderWidth, observe)
        node.invalidateDraw()
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSurface"
    }
}

private class FrostedSurfaceNode(
    shape: Shape,
    tokens: GlassMaterial,
    blur: Boolean,
    base: Color,
    veil: Color,
    state: GlassState?,
    borderWidth: Dp,
    observe: (() -> Float)?,
) : BackdropSurfaceNode(shape, tokens, blur, base, veil, state, borderWidth, observe) {
    private var edgeBrush: Brush? = null
    private var edgeColor = Color.Unspecified
    private var edgeFade = -1f

    override fun ContentDrawScope.draw() {
        observe?.invoke()
        val outline = outline()
        val source = recordingSource()
        if (source != null) {
            val blurLayer = backdropLayer()
            // Opaque base: where the source is transparent (or ends) the content under the surface must not show through.
            drawRect(base)
            source.surfaceDraws++
            measureRootFrame()
            val radius = tokens.blur.toPx()
            recordBackdrop(source, blurLayer, ceil(radius).toInt(), opaqueBase = false)
            blurLayer.renderEffect = blurFor(radius)
            blurLayer.colorFilter = saturationFilter()
            drawLayer(blurLayer)
        }
        drawVeil()
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
        drawContent()
    }
}
