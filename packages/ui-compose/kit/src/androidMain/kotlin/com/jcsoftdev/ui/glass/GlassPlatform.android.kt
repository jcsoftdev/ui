package com.jcsoftdev.ui.glass

import android.app.UiModeManager
import android.content.Context
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

// RenderEffect (the blur) exists from Android 12.
internal actual fun backdropBlurSupported(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

// Android has no "reduce transparency" setting. Window blur toggles (developer options, battery saver) concern
// cross-window blur, not the in-app blur this kit draws, so they are deliberately not mapped to it.
@Composable
internal actual fun rememberSystemReduceTransparency(): Boolean = false

private const val HIGH_TEXT_CONTRAST = "high_text_contrast_enabled"

/** High-contrast text (hidden but stable secure key), or the Android 14+ contrast level at medium or higher. */
@Composable
internal actual fun rememberSystemHighContrast(): Boolean {
    val context = LocalContext.current
    var highText by remember(context) { mutableStateOf(context.highTextContrast()) }
    var level by remember(context) { mutableFloatStateOf(context.contrastLevel()) }
    DisposableEffect(context) {
        val observer =
            object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean) {
                    highText = context.highTextContrast()
                }
            }
        val resolver = context.contentResolver
        resolver.registerContentObserver(Settings.Secure.getUriFor(HIGH_TEXT_CONTRAST), false, observer)
        val unregisterContrast = context.listenContrast { level = it }
        onDispose {
            resolver.unregisterContentObserver(observer)
            unregisterContrast()
        }
    }
    return highText || level >= MEDIUM_CONTRAST
}

private const val MEDIUM_CONTRAST = 0.5f

private fun Context.highTextContrast(): Boolean = Settings.Secure.getInt(contentResolver, HIGH_TEXT_CONTRAST, 0) == 1

private fun Context.contrastLevel(): Float =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        (getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager)?.contrast ?: 0f
    } else {
        0f
    }

/** Android 14+ pushes contrast changes to a listener; returns the function that stops listening. */
private fun Context.listenContrast(onChange: (Float) -> Unit): () -> Unit {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return {}
    val manager = getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager ?: return {}
    val listener = UiModeManager.ContrastChangeListener { onChange(it) }
    manager.addContrastChangeListener(mainExecutor, listener)
    return { manager.removeContrastChangeListener(listener) }
}
