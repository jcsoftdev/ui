package com.jcsoftdev.ui.primitives

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.overlays.OverlayLayerEffect

/**
 * Places [content] in the kit overlay host, above the app content and inside the window insets, with no platform window.
 * Nothing is drawn by the layer itself: the scrim, surface, shape and motion are whatever [content] draws. Without a host
 * (a `UiTheme` always installs one) the content composes in place.
 *
 * - A [modal] layer hides the app content from accessibility while it is [visible] and gives focus back to it when it leaves.
 * - Layers with a higher [z] draw later; the kit toasts use 10.
 * - System back is routed through the kit [com.jcsoftdev.ui.foundation.BackDispatcher] at [backPriority] while [backEnabled]
 *   and the layer is modal or has an [onDismissRequest]. [dismissOnBack] decides whether back calls [onDismissRequest] or is
 *   only consumed, which is how a dialog can require an explicit choice.
 * - [captureFocus] moves focus into the layer when it appears.
 *
 * ```
 * OverlayLayer(visible = open, onDismissRequest = { open = false }) {
 *     Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
 *         MyCard(onClose = { open = false })
 *     }
 * }
 * ```
 */
@Composable
public fun OverlayLayer(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onDismissRequest: (() -> Unit)? = null,
    modal: Boolean = true,
    z: Int = 0,
    backPriority: Int = BackPriority.OVERLAY,
    dismissOnBack: Boolean = true,
    backEnabled: Boolean = visible,
    captureFocus: Boolean = modal,
    content: @Composable BoxScope.() -> Unit,
) {
    val currentDismiss by rememberUpdatedState(onDismissRequest)
    BackHandler(enabled = backEnabled && (modal || onDismissRequest != null), priority = backPriority) {
        if (dismissOnBack) currentDismiss?.invoke()
    }
    OverlayLayerEffect(active = visible, z = z, modal = modal) {
        val focus = remember { FocusRequester() }
        if (captureFocus) LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
        Box(
            modifier.fillMaxSize().then(if (captureFocus) Modifier.focusRequester(focus).focusable() else Modifier),
            content = content,
        )
    }
}

/**
 * Modal layer with a scrim: a [OverlayLayer] whose [scrim] sits below [content] and, when [dismissOnScrimTap], turns a tap
 * into [onDismissRequest]. This is the behaviour behind the kit sheet and dialog.
 *
 * [open] drives back handling while [present] keeps the layer composed, so an exit animation can finish after [open] turns
 * false (see [rememberOverlayPresence]). [scrim] receives a modifier that already carries the tap and the accessibility
 * action named [dismissLabel] (already localized); apply it to the node that draws the scrim.
 *
 * ```
 * val presence = rememberOverlayPresence(open)
 * ModalLayer(
 *     open = open,
 *     present = presence.present,
 *     onDismissRequest = { open = false },
 *     scrim = { tap -> Box(tap.fillMaxSize().graphicsLayer { alpha = presence.progress }.background(Color.Black.copy(0.4f))) },
 * ) {
 *     Box(Modifier.align(Alignment.Center)) { MyDialogCard() }
 * }
 * ```
 */
@Composable
public fun ModalLayer(
    open: Boolean,
    onDismissRequest: () -> Unit,
    scrim: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
    present: Boolean = open,
    dismissOnBack: Boolean = true,
    dismissOnScrimTap: Boolean = true,
    dismissLabel: String? = null,
    backPriority: Int = BackPriority.SHEET,
    captureFocus: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    OverlayLayer(
        visible = present,
        modifier = modifier,
        onDismissRequest = onDismissRequest,
        modal = true,
        backPriority = backPriority,
        dismissOnBack = dismissOnBack,
        backEnabled = open,
        captureFocus = captureFocus,
    ) {
        scrim(Modifier.dismissOnTap(dismissOnScrimTap, dismissLabel, onDismissRequest))
        content()
    }
}

/**
 * Turns a tap on this node into [onDismissRequest] while [enabled], and, given a [label] (already localized), exposes it
 * as an accessibility click action so screen-reader users can dismiss the layer too. Without a [label] the node is not
 * announced.
 *
 * ```
 * Box(Modifier.fillMaxSize().background(Color.Black.copy(0.4f)).dismissOnTap(true, "Close") { open = false })
 * ```
 */
@Composable
public fun Modifier.dismissOnTap(
    enabled: Boolean,
    label: String?,
    onDismissRequest: () -> Unit,
): Modifier {
    val current by rememberUpdatedState(onDismissRequest)
    return this
        .pointerInput(enabled) { detectTapGestures { if (enabled) current() } }
        .semantics {
            if (enabled && label != null) {
                contentDescription = label
                onClick(label) {
                    current()
                    true
                }
            }
        }
}

/**
 * Requests focus for this node when it enters the composition and makes it focusable; use it on the first thing a modal
 * layer wants focused.
 *
 * ```
 * Column(Modifier.semantics { paneTitle = "Confirm" }.initialFocus()) { ... }
 * ```
 */
@Composable
public fun Modifier.initialFocus(enabled: Boolean = true): Modifier {
    if (!enabled) return this
    val focus = remember { FocusRequester() }
    LaunchedEffect(focus) { runCatching { focus.requestFocus() } }
    return this.focusRequester(focus).focusable()
}
