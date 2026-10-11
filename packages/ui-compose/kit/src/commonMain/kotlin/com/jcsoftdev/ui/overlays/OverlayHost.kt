package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.currentCompositionLocalContext
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics

/** A piece of UI drawn above the app content; higher [z] draws later. A [modal] layer hides the content below from accessibility. */
@Stable
internal class OverlayLayer(
    val z: Int,
    val modal: Boolean,
) {
    var content: @Composable () -> Unit by mutableStateOf({})
}

@Stable
internal class OverlayHostState {
    val layers = mutableStateListOf<OverlayLayer>()
    val contentFocus = FocusRequester()
}

internal val LocalOverlayHost = staticCompositionLocalOf<OverlayHostState?> { null }

/**
 * Draws sheets, dialogs and toasts above [content] inside the app window, so they follow the window insets (including the
 * keyboard) with no extra platform window. [com.jcsoftdev.ui.theme.UiTheme] installs it only when no host exists yet, and
 * then the host fills the space its parent gives it, so give the outermost `UiTheme` the whole screen. A nested `UiTheme`
 * keeps using the outer host and does not grow.
 */
@Composable
internal fun OverlayHost(content: @Composable () -> Unit) {
    if (LocalOverlayHost.current != null) {
        content()
        return
    }
    val state = remember { OverlayHostState() }
    CompositionLocalProvider(LocalOverlayHost provides state) {
        Box(Modifier.fillMaxSize(), propagateMinConstraints = true) {
            val modalOpen = state.layers.any { it.modal }
            Box(
                Modifier
                    .semantics { if (modalOpen) hideFromAccessibility() }
                    .focusRequester(state.contentFocus)
                    .restoreFocus()
                    .focusGroup(),
                propagateMinConstraints = true,
            ) { content() }
            if (state.layers.isNotEmpty()) {
                Box(Modifier.matchParentSize()) {
                    state.layers.sortedBy { it.z }.forEach { layer -> key(layer) { layer.content() } }
                }
            }
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
private fun Modifier.restoreFocus(): Modifier = focusRestorer()

/**
 * Shows [content] in the host while [active]; without a host it composes in place. The layer keeps the composition locals of
 * the call site, not those of the host. A [modal] layer hides the app content from accessibility and gives focus back to it
 * when the layer leaves.
 */
@Composable
internal fun OverlayLayerEffect(
    active: Boolean,
    z: Int = 0,
    modal: Boolean = false,
    content: @Composable () -> Unit,
) {
    val host = LocalOverlayHost.current
    val locals = currentCompositionLocalContext
    if (host == null) {
        if (active) Box(Modifier.fillMaxSize()) { content() }
        return
    }
    val layer = remember(host, z, modal) { OverlayLayer(z, modal) }
    SideEffect { layer.content = { CompositionLocalProvider(locals) { content() } } }
    DisposableEffect(host, active) {
        if (active) host.layers.add(layer)
        onDispose {
            host.layers.remove(layer)
            if (active && modal) runCatching { host.contentFocus.requestFocus() }
        }
    }
}
