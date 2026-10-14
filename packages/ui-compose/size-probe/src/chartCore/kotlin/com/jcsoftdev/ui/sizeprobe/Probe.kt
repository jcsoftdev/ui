package com.jcsoftdev.ui.sizeprobe

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.jcsoftdev.ui.chart.core.ChartLocales
import com.jcsoftdev.ui.chart.core.Curve
import com.jcsoftdev.ui.chart.core.formatNumber
import com.jcsoftdev.ui.chart.core.linePath
import com.jcsoftdev.ui.chart.core.linearScale
import com.jcsoftdev.ui.chart.core.lttbIndices

@Composable
internal fun ProbeContent() {
    // One real call into each part of chart-core a chart reaches: scale, sampling, path and formatting.
    remember {
        val xs = DoubleArray(64) { it.toDouble() }
        val ys = DoubleArray(64) { (it * it % 17).toDouble() }
        val scale = linearScale(0.0, 100.0, 0.0, 240.0)
        val kept = lttbIndices(xs, ys, 16)
        val path = linePath(DoubleArray(kept.size) { scale.map(xs[kept[it]]) }, DoubleArray(kept.size) { ys[kept[it]] }, Curve.Smooth)
        path.toSvg() + formatNumber(scale.map(42.0), ChartLocales.system)
    }
}
