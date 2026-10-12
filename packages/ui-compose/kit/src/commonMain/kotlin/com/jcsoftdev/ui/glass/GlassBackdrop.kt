package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.IntSize

/**
 * The backdrop glass surfaces blur: a recording of the content marked with [glassSource]. The content is recorded only
 * while at least one glass surface that blurs is composed ([consumers] > 0), so an app without glass pays nothing.
 *
 * [com.jcsoftdev.ui.overlays.OverlayHost] owns one for the whole app and hands it to the overlays (sheets, dialogs, menus,
 * toasts); in-content chrome such as [com.jcsoftdev.ui.navigation.TopBar] takes one explicitly, from [rememberGlassState].
 */
@Stable
public class GlassState internal constructor(
    internal val layer: GraphicsLayer,
) {
    internal var consumers: Int by mutableIntStateOf(0)

    // Where the source sits in the root; only read in the draw phase, so it needs no snapshot state.
    internal var originX: Float = 0f
    internal var originY: Float = 0f

    // How many times the source was recorded; lets tests prove nothing is captured without a consumer.
    internal var recordings: Int = 0

    // How many times a surface drew its backdrop from this source (tests: a surface follows an animated ancestor).
    internal var surfaceDraws: Int = 0

    /** True while the source is being recorded for at least one glass surface. */
    public val isRecording: Boolean get() = consumers > 0
}

/** Creates a [GlassState] tied to the composition. */
@Composable
public fun rememberGlassState(): GlassState {
    val layer = rememberGraphicsLayer()
    return remember(layer) { GlassState(layer) }
}

/**
 * Marks this node as the content glass surfaces blur. Apply it to the scrolling or busy content, never to a parent of the
 * glass surface itself, and draw the surface after it (later sibling), so the surface does not sample itself.
 *
 * ```
 * val glass = rememberGlassState()
 * Box {
 *     LazyColumn(Modifier.fillMaxSize().glassSource(glass)) { ... }
 *     TopBar("Inbox", glass = glass)
 * }
 * ```
 */
public fun Modifier.glassSource(state: GlassState): Modifier = this then GlassSourceElement(state)

private data class GlassSourceElement(
    val state: GlassState,
) : ModifierNodeElement<GlassSourceNode>() {
    override fun create(): GlassSourceNode = GlassSourceNode(state)

    override fun update(node: GlassSourceNode) {
        node.state = state
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "glassSource"
    }
}

private class GlassSourceNode(
    var state: GlassState,
) : Modifier.Node(),
    DrawModifierNode,
    GlobalPositionAwareModifierNode {
    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        val origin: Offset = coordinates.positionInRoot()
        state.originX = origin.x
        state.originY = origin.y
    }

    override fun ContentDrawScope.draw() {
        if (state.consumers <= 0) {
            drawContent()
            return
        }
        val layer = state.layer
        state.recordings++
        layer.record(size = IntSize(size.width.toInt(), size.height.toInt())) {
            this@draw.drawContent()
        }
        drawLayer(layer)
    }
}
