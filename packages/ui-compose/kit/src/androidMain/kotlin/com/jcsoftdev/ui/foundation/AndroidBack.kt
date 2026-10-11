package com.jcsoftdev.ui.foundation

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember

/**
 * One call in the activity's `setContent` wires the system back to [LocalBackDispatcher]. Back is intercepted
 * only while a kit handler is registered, otherwise the system closes the app as usual.
 */
@Composable
public fun ProvideAndroidBack(
    dispatcher: BackDispatcher = remember { BackDispatcher() },
    content: @Composable () -> Unit,
) {
    BackHandler(enabled = dispatcher.hasHandler) { dispatcher.dispatch() }
    CompositionLocalProvider(LocalBackDispatcher provides dispatcher, content = content)
}
