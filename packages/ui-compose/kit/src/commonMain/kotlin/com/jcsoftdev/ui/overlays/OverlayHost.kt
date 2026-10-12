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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import com.jcsoftdev.ui.glass.GlassState
import com.jcsoftdev.ui.glass.LocalGlassState
import com.jcsoftdev.ui.glass.glassSource
import com.jcsoftdev.ui.glass.rememberGlassState

/**
 * A layer registered in the host: a piece of UI drawn above the app content; higher [z] draws later (equal [z] keeps the
 * open order). A [modal] layer hides everything below it from accessibility. [z] and [modal] can change while the layer
 * stays registered.
 */
@Stable
internal class OverlayEntry(
    z: Int,
    modal: Boolean,
) {
    var z: Int by mutableIntStateOf(z)
    var modal: Boolean by mutableStateOf(modal)
    var content: @Composable () -> Unit by mutableStateOf({})
    val focus = FocusRequester()
}

@Stable
internal class OverlayHostState(
    val glass: GlassState,
) {
    val layers = mutableStateListOf<OverlayEntry>()
    val contentFocus = FocusRequester()

    /** Layers from the bottom to the top; the sort is stable, so equal z keeps the open order. */
    fun ordered(): List<OverlayEntry> = layers.sortedBy { it.z }

    fun topModal(): OverlayEntry? = ordered().lastOrNull { it.modal }

    /** Where focus goes when the topmost modal layer leaves: the next modal layer below it, else the app content. */
    fun focusTarget(): FocusRequester = topModal()?.focus ?: contentFocus

    /** Gives focus to the first modal layer, from the top, that has something to focus, else to the app content. */
    @OptIn(ExperimentalComposeUiApi::class)
    fun restoreFocus() {
        val layers = ordered().filter { it.modal }.asReversed()
        for (layer in layers) if (runCatching { layer.focus.requestFocus(FocusDirection.Enter) }.getOrDefault(false)) return
        runCatching { contentFocus.requestFocus(FocusDirection.Enter) }
    }
}

internal val LocalOverlayHost = staticCompositionLocalOf<OverlayHostState?> { null }

/**
 * Draws sheets, dialogs and toasts above [content] inside the app window, so they follow the window insets (including the
 * keyboard) with no extra platform window. [com.jcsoftdev.ui.theme.UiTheme] installs it for you; use this composable
 * directly when you build on the headless primitives without `UiTheme`. Without `UiTheme` the primitives use the default
 * [com.jcsoftdev.ui.foundation.Motion] (full motion, no system scale) and every styled component falls back to the
 * theme defaults, so only the primitives are meant to be used that way.
 *
 * It installs itself only when no host exists yet, and then fills the space its parent gives it, so give the outermost
 * host the whole screen. A nested host keeps using the outer one and does not grow.
 *
 * While a modal layer is open, the app content and every layer below the topmost modal are hidden from accessibility, and
 * when the topmost modal leaves, focus goes back to the modal layer below it, or to the app content.
 *
 * ```
 * OverlayHost { MyApp() } // MyApp may now use OverlayLayer, ModalLayer and ToastHost
 * ```
 */
@Composable
public fun OverlayHost(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    if (LocalOverlayHost.current != null) {
        content()
        return
    }
    val glass = rememberGlassState()
    val state = remember(glass) { OverlayHostState(glass) }
    CompositionLocalProvider(LocalOverlayHost provides state) {
        Box(modifier.fillMaxSize(), propagateMinConstraints = true) {
            val ordered = state.ordered()
            val topModal = ordered.indexOfLast { it.modal }
            Box(
                Modifier
                    .glassSource(glass)
                    .semantics { if (topModal >= 0) hideFromAccessibility() }
                    .focusRequester(state.contentFocus)
                    .restoreFocus()
                    .focusGroup(),
                propagateMinConstraints = true,
            ) { content() }
            if (ordered.isNotEmpty()) {
                Box(Modifier.matchParentSize()) {
                    ordered.forEachIndexed { index, layer ->
                        key(layer) {
                            Box(
                                Modifier
                                    .matchParentSize()
                                    .semantics { if (index < topModal) hideFromAccessibility() }
                                    .focusRequester(layer.focus)
                                    .restoreFocus()
                                    .focusGroup(),
                            ) { layer.content() }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
private fun Modifier.restoreFocus(): Modifier = focusRestorer()

/**
 * Shows [content] in the host while [active]; without a host it composes in place. The layer keeps the composition locals of
 * the call site, not those of the host. A [modal] layer hides what is below it from accessibility and, when it leaves as the
 * topmost modal, gives focus back to the modal layer below it or to the app content. Changing [z] or [modal] while the
 * layer is shown updates it in place.
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
    val layer = remember(host) { OverlayEntry(z, modal) }
    SideEffect {
        layer.z = z
        layer.modal = modal
        layer.content = { CompositionLocalProvider(locals) { CompositionLocalProvider(LocalGlassState provides host.glass) { content() } } }
    }
    DisposableEffect(host, layer, active) {
        if (active) host.layers.add(layer)
        onDispose {
            val restore = active && layer.modal && host.topModal() === layer
            host.layers.remove(layer)
            if (restore) host.restoreFocus()
        }
    }
}
