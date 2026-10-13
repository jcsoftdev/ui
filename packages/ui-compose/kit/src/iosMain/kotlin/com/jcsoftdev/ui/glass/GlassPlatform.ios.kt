package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import platform.Foundation.NSNotificationCenter
import platform.Foundation.NSOperationQueue
import platform.UIKit.UIAccessibilityDarkerSystemColorsEnabled
import platform.UIKit.UIAccessibilityDarkerSystemColorsStatusDidChangeNotification
import platform.UIKit.UIAccessibilityIsReduceTransparencyEnabled
import platform.UIKit.UIAccessibilityReduceTransparencyStatusDidChangeNotification

internal actual fun backdropBlurSupported(): Boolean = true

internal actual fun lensSupported(): Boolean = true

@Composable
internal actual fun rememberSystemReduceTransparency(): Boolean =
    rememberUiKitFlag(
        UIAccessibilityReduceTransparencyStatusDidChangeNotification,
    ) { UIAccessibilityIsReduceTransparencyEnabled() }

/** iOS "Increase Contrast" is exposed as darker system colors. */
@Composable
internal actual fun rememberSystemHighContrast(): Boolean =
    rememberUiKitFlag(
        UIAccessibilityDarkerSystemColorsStatusDidChangeNotification,
    ) { UIAccessibilityDarkerSystemColorsEnabled() }

@Composable
private fun rememberUiKitFlag(
    notification: String?,
    read: () -> Boolean,
): Boolean {
    var value by remember { mutableStateOf(read()) }
    DisposableEffect(notification) {
        val center = NSNotificationCenter.defaultCenter
        val token = center.addObserverForName(notification, null, NSOperationQueue.mainQueue) { value = read() }
        onDispose { center.removeObserver(token) }
    }
    return value
}
