package com.jcsoftdev.ui.primitives

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

private const val TICK_MILLIS = 100L

/** Layer z of the toast host: above sheets and dialogs. */
public const val TOAST_LAYER_Z: Int = 10

/**
 * Headless toast host. It owns everything except the looks: it places the toasts of [state] in the overlay host
 * (above sheets and dialogs), stacks them at [alignment] inside [windowInsets] and [contentPadding], runs each countdown
 * and calls [content] for every toast, so the caller draws it.
 *
 * Each toast is a polite live region; touching or focusing it pauses its countdown, and the system accessibility timeout
 * (when the platform gives one) replaces its duration. When a toast's own action is chosen, call
 * `state.dismiss(item.id)` from [content].
 *
 * ```
 * ToastHost(state) { toast ->
 *     Row(Modifier.background(Color.Black)) {
 *         Text(toast.message, color = Color.White)
 *         toast.action?.let { a -> Text(a.label, Modifier.clickable { a.onClick(); state.dismiss(toast.id) }) }
 *     }
 * }
 * ```
 */
@Composable
public fun ToastHost(
    state: ToastHostState,
    modifier: Modifier = Modifier,
    alignment: Alignment = Alignment.BottomCenter,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    spacing: Dp = 8.dp,
    windowInsets: WindowInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom),
    z: Int = TOAST_LAYER_Z,
    content: @Composable (ToastItem) -> Unit,
) {
    OverlayLayer(visible = true, modal = false, z = z, captureFocus = false) {
        Box(
            modifier.fillMaxSize().windowInsetsPadding(windowInsets).padding(contentPadding),
            contentAlignment = alignment,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(spacing), horizontalAlignment = Alignment.CenterHorizontally) {
                state.toasts.forEach { item -> key(item.id) { ToastSlot(item, state, content) } }
            }
        }
    }
}

@Composable
private fun ToastSlot(
    item: ToastItem,
    state: ToastHostState,
    content: @Composable (ToastItem) -> Unit,
) {
    var touched by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val accessibility = LocalAccessibilityManager.current
    val total =
        remember(item.id, accessibility) {
            if (item.isIndefinite) return@remember item.durationMillis
            accessibility?.calculateRecommendedTimeoutMillis(
                originalTimeoutMillis = item.durationMillis,
                containsIcons = false,
                containsText = true,
                containsControls = item.action != null,
            ) ?: item.durationMillis
        }
    val paused by rememberUpdatedState(touched || focused)
    if (!item.isIndefinite) {
        LaunchedEffect(item.id, total) {
            val timer = ToastTimer(total)
            while (!timer.expired) {
                delay(TICK_MILLIS)
                timer.advance(TICK_MILLIS, paused)
            }
            state.dismiss(item.id)
        }
    }
    Box(
        Modifier
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        touched = event.changes.any { it.pressed }
                    }
                }
            }.onFocusChanged { focused = it.hasFocus }
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) { content(item) }
}
