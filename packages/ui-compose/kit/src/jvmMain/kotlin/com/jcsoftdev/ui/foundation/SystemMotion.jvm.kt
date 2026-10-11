package com.jcsoftdev.ui.foundation

import androidx.compose.runtime.Composable

@Composable
internal actual fun rememberSystemMotion(): Motion = FullMotion

private val FullMotion = Motion()
