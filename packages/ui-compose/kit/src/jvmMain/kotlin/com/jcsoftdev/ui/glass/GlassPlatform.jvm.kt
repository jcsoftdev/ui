package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable

internal actual fun backdropBlurSupported(): Boolean = true

internal actual fun lensSupported(): Boolean = true

@Composable
internal actual fun rememberSystemReduceTransparency(): Boolean = false

@Composable
internal actual fun rememberSystemHighContrast(): Boolean = false
