package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier

/** A piece of UI drawn above the app content; higher [z] draws later. */
@Stable
internal class OverlayLayer(
    val z: Int,
) {
    var content: @Composable () -> Unit by mutableStateOf({})
}

@Stable
internal class OverlayHostState {
    val layers = mutableStateListOf<OverlayLayer>()
}

internal val LocalOverlayHost = staticCompositionLocalOf<OverlayHostState?> { null }

/**
 * Draws sheets, dialogs and toasts above [content] inside the app window, so they follow the window insets (including the
 * keyboard) with no extra platform window. [com.jcsoftdev.ui.theme.UiTheme] installs it; the host fills the space its parent
 * gives it, so give `UiTheme` the whole screen.
 */
@Composable
internal fun OverlayHost(content: @Composable () -> Unit) {
    val state = remember { OverlayHostState() }
    CompositionLocalProvider(LocalOverlayHost provides state) {
        Box(Modifier.fillMaxSize(), propagateMinConstraints = true) {
            content()
            if (state.layers.isNotEmpty()) {
                Box(Modifier.matchParentSize()) {
                    state.layers.sortedBy { it.z }.forEach { layer -> key(layer) { layer.content() } }
                }
            }
        }
    }
}

/** Shows [content] in the host while [active]; without a host it composes in place. */
@Composable
internal fun OverlayLayerEffect(
    active: Boolean,
    z: Int = 0,
    content: @Composable () -> Unit,
) {
    val host = LocalOverlayHost.current
    if (host == null) {
        if (active) Box(Modifier.fillMaxSize()) { content() }
        return
    }
    val layer = remember(host) { OverlayLayer(z) }
    SideEffect { layer.content = content }
    DisposableEffect(host, active) {
        if (active) host.layers.add(layer)
        onDispose { host.layers.remove(layer) }
    }
}
