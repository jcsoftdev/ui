package com.jcsoftdev.ui.sizeprobe

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.jcsoftdev.ui.chart.geo.peru.GeoPeruModule

@Composable
internal fun ProbeContent() {
    remember { GeoPeruModule.id }
}
