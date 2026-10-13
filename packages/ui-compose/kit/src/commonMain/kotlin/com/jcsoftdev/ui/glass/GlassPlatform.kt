package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Composable

/** True when the platform can blur what is behind a surface (Android 31+, Skia targets). */
internal expect fun backdropBlurSupported(): Boolean

/** True when a runtime shader can refract the backdrop (Android 13+, Skia targets). */
internal expect fun lensSupported(): Boolean

/** The OS "reduce transparency" preference where the platform has one; false elsewhere. */
@Composable
internal expect fun rememberSystemReduceTransparency(): Boolean

/** The OS "increase contrast" preference where the platform has one; false elsewhere. */
@Composable
internal expect fun rememberSystemHighContrast(): Boolean
