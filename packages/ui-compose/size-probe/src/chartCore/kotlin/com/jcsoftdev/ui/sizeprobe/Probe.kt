package com.jcsoftdev.ui.sizeprobe

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.jcsoftdev.ui.chart.core.CoreModule

@Composable
internal fun ProbeContent() {
    remember { CoreModule.id }
}
