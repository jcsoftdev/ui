package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.ReadOnlyComposable
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
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme
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

/** Colors of the [Toaster]: surface, text and the status dot of each tone (the neutral tone has no dot). */
@Immutable
public class ToastColors(
    public val container: Color,
    public val content: Color,
    public val success: Color,
    public val error: Color,
    public val info: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
        success: Color = this.success,
        error: Color = this.error,
        info: Color = this.info,
    ): ToastColors = ToastColors(container, content, success, error, info)

    internal fun dot(tone: ToastTone): Color? =
        when (tone) {
            ToastTone.Neutral -> null
            ToastTone.Success -> success
            ToastTone.Error -> error
            ToastTone.Info -> info
        }
}

/** Default colors, shape and metrics of the [Toaster]. */
public object ToasterDefaults {
    /** Colors in the active theme; the surface is dark in both themes, so the dots use the dark palette. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): ToastColors {
        val c = UiTheme.colors
        return ToastColors(c.toastBg, c.toastInk, UiColors.Dark.success, UiColors.Dark.danger, UiColors.Dark.info)
    }

    /** Shape of a toast; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Widest a toast grows. */
    public val maxWidth: Dp = 420.dp

    /** Padding inside a toast. */
    public val contentPadding: PaddingValues = PaddingValues(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 6.dp)

    /** Diameter of the tone dot. */
    public val dotSize: Dp = 8.dp

    /** Message style; the theme `control`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control
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
    colors: ToastColors = ToasterDefaults.colors(),
    shape: Shape = ToasterDefaults.shape,
    maxWidth: Dp = ToasterDefaults.maxWidth,
    contentPadding: PaddingValues = ToasterDefaults.contentPadding,
    textStyle: TextStyle = ToasterDefaults.textStyle,
) {
    val sizes = UiTheme.sizes
    OverlayLayerEffect(active = true, z = TOAST_Z) {
        Box(
            modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom))
                .padding(start = sizes.space12, end = sizes.space12, bottom = bottomBarHeight + sizes.space12),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(sizes.space8), horizontalAlignment = Alignment.CenterHorizontally) {
                state.toasts.forEach { item -> key(item.id) { ToastRow(item, state, colors, shape, maxWidth, contentPadding, textStyle) } }
            }
        }
    }
}

private const val TOAST_Z = 10

@Composable
private fun ToastRow(
    item: ToastItem,
    state: ToastHostState,
    colors: ToastColors,
    shape: Shape,
    maxWidth: Dp,
    contentPadding: PaddingValues,
    textStyle: TextStyle,
) {
    val sizes = UiTheme.sizes
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
            .widthIn(max = maxWidth)
            .clip(shape)
            .background(colors.container)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        touched = event.changes.any { it.pressed }
                    }
                }
            }.onFocusChanged { focused = it.hasFocus }
            .semantics { liveRegion = LiveRegionMode.Polite }
            .defaultMinSize(minHeight = sizes.minTouchTarget)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(sizes.space10),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val dot = colors.dot(item.tone)
        if (dot != null) Box(Modifier.size(ToasterDefaults.dotSize).background(dot, CircleShape))
        Text(item.message, Modifier.weight(1f, fill = false), style = textStyle, color = colors.content)
        val action = item.action
        if (action != null) {
            Box(
                Modifier
                    .defaultMinSize(minHeight = sizes.minTouchTarget)
                    .clip(shape)
                    .clickable(role = Role.Button) {
                        action.onClick()
                        dismiss()
                    }.padding(horizontal = sizes.space12),
                contentAlignment = Alignment.Center,
            ) {
                Text(action.label, style = textStyle.copy(fontWeight = FontWeight.Bold), color = colors.content)
            }
        }
    }
}
