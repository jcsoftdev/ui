package com.jcsoftdev.ui.sizeprobe

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.jcsoftdev.ui.chart.core.ChartLocales
import com.jcsoftdev.ui.chart.core.formatNumber
import com.jcsoftdev.ui.chart.core.linearScale
import com.jcsoftdev.ui.chart.core.ticks

@Composable
internal fun ProbeContent() {
    // One real call into the parts of chart-core a chart reaches: scale, ticks and formatting.
    remember {
        val scale = linearScale(0.0, 100.0, 0.0, 240.0)
        scale.ticks(5).joinToString { formatNumber(it, ChartLocales.system) }
    }
}
