package com.jcsoftdev.ui.sizeprobe

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.jcsoftdev.ui.chart.geo.world.GeoWorldModule

@Composable
internal fun ProbeContent() {
    remember { GeoWorldModule.id }
}
