package com.jcsoftdev.ui.foundation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

@Composable
internal actual fun rememberSystemMotion(): Motion = remember { Motion(if (UIAccessibilityIsReduceMotionEnabled()) 0f else 1f) }
