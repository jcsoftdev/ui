package com.jcsoftdev.ui.foundation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf

/** Who answers the system back first: a higher priority wins, and among equals the latest registered one does. */
public object BackPriority {
    public const val TAB: Int = 0
    public const val OVERLAY: Int = 100
    public const val EDITOR: Int = 200
    public const val SHEET: Int = 300
}

/**
 * Stack of back handlers shared by every screen. The platform entry point calls [dispatch] and uses [hasHandler]
 * to intercept back only while something in the app can consume it, so otherwise the system leaves the app.
 */
@Stable
public class BackDispatcher {
    private class Entry(
        val priority: Int,
        val order: Long,
        val onBack: () -> Unit,
    )

    private val entries = mutableStateListOf<Entry>()
    private var counter = 0L

    public val hasHandler: Boolean get() = entries.isNotEmpty()

    /** Adds a handler and returns the function that removes it. */
    public fun register(
        priority: Int,
        onBack: () -> Unit,
    ): () -> Unit {
        val entry = Entry(priority, counter++, onBack)
        entries.add(entry)
        return { entries.remove(entry) }
    }

    /** Runs the winning handler; false when nobody is registered. */
    public fun dispatch(): Boolean {
        val top = entries.maxWithOrNull(compareBy<Entry> { it.priority }.thenBy { it.order }) ?: return false
        top.onBack()
        return true
    }
}

private val NoBack = BackDispatcher()

/** Platforms without a system back gesture keep the default, which nothing dispatches to. */
public val LocalBackDispatcher: ProvidableCompositionLocal<BackDispatcher> = staticCompositionLocalOf { NoBack }

@Composable
public fun BackHandler(
    enabled: Boolean = true,
    priority: Int = BackPriority.OVERLAY,
    onBack: () -> Unit,
) {
    val dispatcher = LocalBackDispatcher.current
    val current by rememberUpdatedState(onBack)
    DisposableEffect(dispatcher, enabled, priority) {
        val unregister = if (enabled) dispatcher.register(priority) { current() } else null
        onDispose { unregister?.invoke() }
    }
}
