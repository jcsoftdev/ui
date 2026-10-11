package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography
import kotlinx.coroutines.delay

public enum class ToastTone { Neutral, Success, Error, Info }

/** The web `action: { label, onClick }` of a toast. */
@Immutable
public class ToastAction(
    public val label: String,
    public val onClick: () -> Unit,
)

/** One toast as shown by [Toaster]. */
@Immutable
public class ToastItem internal constructor(
    public val id: Long,
    public val message: String,
    public val tone: ToastTone,
    public val action: ToastAction?,
    public val durationMillis: Long,
)

/**
 * Controller with the shape of the web `toast` API: `toast(message)`, `success`, `error`, `info`, an optional [ToastAction]
 * and `dismiss`. At most [maxVisible] toasts show at once; the rest wait in a queue and take a free slot in order.
 * Pass the same instance to [Toaster]. [toasts] is an immutable snapshot, so reading it only recomposes when it changes.
 */
@Stable
public class ToastHostState(
    private val maxVisible: Int = 2,
    private val defaultDurationMillis: Long = 6000L,
) {
    init {
        require(maxVisible >= 1) { "maxVisible must be at least 1" }
    }

    private var queue: List<ToastItem> = emptyList()
    private var nextId = 0L

    /** The toasts on screen, oldest first. */
    public var toasts: List<ToastItem> by mutableStateOf(emptyList())
        private set

    /** Shows [message]; returns the toast id for [dismiss]. */
    public fun toast(
        message: String,
        action: ToastAction? = null,
        durationMillis: Long = defaultDurationMillis,
    ): Long = push(message, ToastTone.Neutral, action, durationMillis)

    public fun success(
        message: String,
        action: ToastAction? = null,
        durationMillis: Long = defaultDurationMillis,
    ): Long = push(message, ToastTone.Success, action, durationMillis)

    public fun error(
        message: String,
        action: ToastAction? = null,
        durationMillis: Long = defaultDurationMillis,
    ): Long = push(message, ToastTone.Error, action, durationMillis)

    public fun info(
        message: String,
        action: ToastAction? = null,
        durationMillis: Long = defaultDurationMillis,
    ): Long = push(message, ToastTone.Info, action, durationMillis)

    /** Removes one toast, shown or queued; without an id, all of them. */
    public fun dismiss(id: Long? = null) {
        if (id == null) {
            queue = emptyList()
            toasts = emptyList()
            return
        }
        queue = queue.filterNot { it.id == id }
        toasts = toasts.filterNot { it.id == id }
        promote()
    }

    private fun push(
        message: String,
        tone: ToastTone,
        action: ToastAction?,
        durationMillis: Long,
    ): Long {
        val item = ToastItem(nextId++, message, tone, action, durationMillis)
        queue = queue + item
        promote()
        return item.id
    }

    private fun promote() {
        val room = maxVisible - toasts.size
        if (room <= 0 || queue.isEmpty()) return
        toasts = toasts + queue.take(room)
        queue = queue.drop(room)
    }
}

private const val TICK_MILLIS = 100L

/**
 * Draws the toasts of [state] centered above the bottom safe insets (which include the keyboard), lifted by
 * [bottomBarHeight] when the host screen has its own bottom bar. Each toast is a polite live region; touching or focusing a toast
 * pauses its countdown, and the system accessibility timeout (when the platform gives one) replaces its duration.
 * [Toaster] draws above sheets and dialogs.
 */
@Composable
public fun Toaster(
    state: ToastHostState,
    modifier: Modifier = Modifier,
    bottomBarHeight: Dp = 0.dp,
) {
    OverlayLayerEffect(active = true, z = TOAST_Z) {
        Box(
            modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom))
                .padding(start = 12.dp, end = 12.dp, bottom = bottomBarHeight + 12.dp),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                state.toasts.forEach { item -> key(item.id) { ToastRow(item, state) } }
            }
        }
    }
}

private const val TOAST_Z = 10

@Composable
private fun ToastRow(
    item: ToastItem,
    state: ToastHostState,
) {
    val colors = UiTheme.colors
    var touched by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val paused = touched || focused
    val accessibility = LocalAccessibilityManager.current
    val total =
        remember(item.id, accessibility) {
            accessibility?.calculateRecommendedTimeoutMillis(
                originalTimeoutMillis = item.durationMillis,
                containsIcons = false,
                containsText = true,
                containsControls = item.action != null,
            ) ?: item.durationMillis
        }
    val remaining = remember(total) { mutableLongStateOf(total) }
    val dismiss by rememberUpdatedState { state.dismiss(item.id) }
    LaunchedEffect(remaining) {
        while (remaining.longValue > 0) {
            delay(TICK_MILLIS)
            if (!paused) remaining.longValue -= TICK_MILLIS
        }
        dismiss()
    }
    Row(
        Modifier
            .widthIn(max = 420.dp)
            .clip(UiShapes.control)
            .background(colors.toastBg)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        touched = event.changes.any { it.pressed }
                    }
                }
            }.onFocusChanged { focused = it.hasFocus }
            .semantics { liveRegion = LiveRegionMode.Polite }
            .defaultMinSize(minHeight = 48.dp)
            .padding(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val dot = item.tone.dot()
        if (dot != null) Box(Modifier.size(8.dp).background(dot, CircleShape))
        Text(item.message, Modifier.weight(1f, fill = false), style = UiTypography.control, color = colors.toastInk)
        val action = item.action
        if (action != null) {
            Box(
                Modifier
                    .defaultMinSize(minHeight = 48.dp)
                    .clip(UiShapes.control)
                    .clickable(role = Role.Button) {
                        action.onClick()
                        dismiss()
                    }.padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(action.label, style = UiTypography.control.copy(fontWeight = FontWeight.Bold), color = colors.toastInk)
            }
        }
    }
}

/** The toast surface is dark in both themes, so the dot uses the dark palette. */
private fun ToastTone.dot(): Color? =
    when (this) {
        ToastTone.Neutral -> null
        ToastTone.Success -> UiColors.Dark.success
        ToastTone.Error -> UiColors.Dark.danger
        ToastTone.Info -> UiColors.Dark.info
    }
