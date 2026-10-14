package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.max

public enum class StackMode { None, Normal, Percent }

/** One stacked layer: for every index, where the segment starts and ends. [values] keeps the original value (`NaN` for a gap). */
public class StackLayer(
    public val y0: DoubleArray,
    public val y1: DoubleArray,
    public val values: DoubleArray,
)

/**
 * Stacks series on top of each other per index. Positive values grow up from zero, negative values grow down, so diverging data
 * stays readable. In [StackMode.Percent] each index is normalised to a 0-1 share of its absolute total. A `NaN` or infinite value is a
 * gap: it contributes nothing and shows as `NaN` in [StackLayer.values]. [StackMode.None] returns no layers.
 */
public fun stackLayers(
    series: Array<DoubleArray>,
    mode: StackMode,
): List<StackLayer> {
    if (mode == StackMode.None) return emptyList()
    var length = 0
    for (data in series) length = max(length, data.size)
    val totals = DoubleArray(length)
    for (data in series) for (i in data.indices) if (data[i].isFinite()) totals[i] += abs(data[i])
    val up = DoubleArray(length)
    val down = DoubleArray(length)
    return series.map { data ->
        val y0 = DoubleArray(length)
        val y1 = DoubleArray(length)
        val values = DoubleArray(length) { if (it < data.size && data[it].isFinite()) data[it] else Double.NaN }
        for (i in 0 until length) {
            val raw = if (values[i].isNaN()) 0.0 else values[i]
            val value = if (mode == StackMode.Percent) (if (totals[i] != 0.0) raw / totals[i] else 0.0) else raw
            val base = if (value >= 0) up[i] else down[i]
            y0[i] = base
            y1[i] = base + value
            if (value >= 0) up[i] = base + value else down[i] = base + value
        }
        StackLayer(y0, y1, values)
    }
}
