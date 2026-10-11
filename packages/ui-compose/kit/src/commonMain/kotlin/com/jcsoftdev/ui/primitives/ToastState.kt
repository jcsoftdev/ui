package com.jcsoftdev.ui.primitives

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

public enum class ToastTone { Neutral, Success, Error, Info }

/** The web `action: { label, onClick }` of a toast. */
@Immutable
public class ToastAction(
    public val label: String,
    public val onClick: () -> Unit,
)

/** One toast as handed to a toast UI. */
@Immutable
public class ToastItem internal constructor(
    public val id: Long,
    public val message: String,
    public val tone: ToastTone,
    public val action: ToastAction?,
    public val durationMillis: Long,
) {
    /** True for a toast that never expires by itself ([ToastHostState.INDEFINITE]). */
    public val isIndefinite: Boolean get() = durationMillis == ToastHostState.INDEFINITE
}

/**
 * Pure queue behind [ToastHostState]: at most [maxVisible] items show, the rest wait and take free slots in order. It
 * holds plain mutable fields, so it is deliberately not `@Stable`; only [ToastHostState] publishes its snapshot as state.
 */
internal class ToastQueue(
    private val maxVisible: Int,
) {
    init {
        require(maxVisible >= 1) { "maxVisible must be at least 1" }
    }

    private var waiting: List<ToastItem> = emptyList()
    private var nextId = 0L

    var visible: List<ToastItem> = emptyList()
        private set

    val pendingCount: Int get() = waiting.size

    fun push(
        message: String,
        tone: ToastTone,
        action: ToastAction?,
        durationMillis: Long,
    ): ToastItem {
        val item = ToastItem(nextId++, message, tone, action, durationMillis)
        waiting = waiting + item
        promote()
        return item
    }

    fun dismiss(id: Long) {
        waiting = waiting.filterNot { it.id == id }
        visible = visible.filterNot { it.id == id }
        promote()
    }

    fun dismissAll() {
        waiting = emptyList()
        visible = emptyList()
    }

    private fun promote() {
        val room = maxVisible - visible.size
        if (room <= 0 || waiting.isEmpty()) return
        visible = visible + waiting.take(room)
        waiting = waiting.drop(room)
    }
}

/** Pure countdown of one toast: it runs down by the time that passes while it is not paused. Not `@Stable`: plain mutable field. */
internal class ToastTimer(
    totalMillis: Long,
) {
    var remainingMillis: Long = totalMillis.coerceAtLeast(0L)
        private set

    val expired: Boolean get() = remainingMillis <= 0L

    /** Lets [elapsedMillis] pass; a paused timer keeps its remaining time. Returns [expired]. */
    fun advance(
        elapsedMillis: Long,
        paused: Boolean,
    ): Boolean {
        if (!paused) remainingMillis = (remainingMillis - elapsedMillis).coerceAtLeast(0L)
        return expired
    }
}

/**
 * Controller with the shape of the web `toast` API: `toast(message)`, `success`, `error`, `info`, an optional [ToastAction]
 * and `dismiss`. At most [maxVisible] toasts show at once; the rest wait in a queue and take a free slot in order.
 * Pass the same instance to [ToastHost] (headless) or to the styled `Toaster`. [toasts] is an immutable snapshot, so
 * reading it only recomposes when it changes.
 *
 * A `durationMillis` of zero or less is not "forever": the toast is dismissed on the first countdown tick (about 100ms),
 * which is rarely wanted. Pass [INDEFINITE] for a toast that stays until it is dismissed with [dismiss] (or its action).
 *
 * ```
 * val toasts = remember { ToastHostState() }
 * toasts.success("Saved", ToastAction("Undo") { undo() })
 * ```
 */
@Stable
public class ToastHostState(
    maxVisible: Int = 2,
    private val defaultDurationMillis: Long = 6000L,
) {
    private val queue = ToastQueue(maxVisible)

    public companion object {
        /** Duration of a toast that never expires by itself; the countdown and the accessibility timeout are skipped. */
        public const val INDEFINITE: Long = Long.MAX_VALUE
    }

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
        if (id == null) queue.dismissAll() else queue.dismiss(id)
        toasts = queue.visible
    }

    private fun push(
        message: String,
        tone: ToastTone,
        action: ToastAction?,
        durationMillis: Long,
    ): Long {
        val item = queue.push(message, tone, action, durationMillis)
        toasts = queue.visible
        return item.id
    }
}
