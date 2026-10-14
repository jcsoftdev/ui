package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/** A labelled tick. [key] is stable across redraws: the value of a value tick, the category index of a category tick. */
public class AxisTick(
    public val key: Double,
    public val position: Double,
    public val label: String,
)

/** Approximate rendered width of a tick label at [fontSize] (tabular figures). Real text measurement belongs to the renderer. */
public fun estimateTextWidth(
    text: String,
    fontSize: Double = 11.0,
): Double = text.length * fontSize * 0.58

/**
 * Drops labels that would collide, keeping an even rhythm (every 2nd, 3rd, ...) so the first label always stays. The rhythm comes
 * from the first two ticks, so ticks must be evenly spaced.
 */
public fun thinTicks(
    ticks: List<AxisTick>,
    gap: Double = 10.0,
): List<AxisTick> {
    if (ticks.size < 3) return ticks.toList()
    var widest = 0.0
    for (tick in ticks) widest = max(widest, estimateTextWidth(tick.label))
    val spacing = abs(ticks[1].position - ticks[0].position).let { if (it == 0.0 || it.isNaN()) 1.0 else it }
    val every = max(1, ceil((widest + gap) / spacing).toInt())
    return ticks.filterIndexed { index, _ -> index % every == 0 }
}

/** Ticks of a continuous scale that fall inside its domain, as pixel-positioned labels. */
public fun valueTicks(
    scale: ContinuousScale,
    count: Int,
    format: ValueFormatter,
): List<AxisTick> {
    val lo = scale.domain.low - 1e-9
    val hi = scale.domain.high + 1e-9
    val out = ArrayList<AxisTick>()
    for (value in scale.ticks(count)) {
        if (value >= lo && value <= hi) out.add(AxisTick(value, scale.map(value), format.format(value)))
    }
    return out
}

public enum class CategoryAxisMode { Point, Band, Time }

/** Pixel positions, ticks and hit testing of a horizontal category axis. */
public class CategoryAxis(
    public val mode: CategoryAxisMode,
    /** Pixel center of every category; `NaN` for a category with no position (a non-finite time). */
    public val positions: DoubleArray,
    /** Distance between neighbours (the smallest gap on a time axis). */
    public val step: Double,
    /** Width available to a mark centered on a category (bars, candles). */
    public val bandwidth: Double,
    public val ticks: List<AxisTick>,
    private val locate: (Double) -> Int,
) {
    /** Nearest category to a pixel; -1 when there are none or the pixel is not finite. */
    public fun indexAt(pixel: Double): Int = locate(pixel)
}

/**
 * Category axis for point and band layouts. [labels] holds one already formatted label per category. [padding] is the space at both
 * ends as a fraction of the step (band default 0.1, point default 0); [paddingInner] is the band gap.
 */
public fun categoryAxis(
    labels: List<String>,
    width: Double,
    mode: CategoryAxisMode,
    paddingInner: Double = 0.25,
    padding: Double? = null,
): CategoryAxis {
    val count = labels.size
    val band = mode == CategoryAxisMode.Band
    val scale =
        if (band) bandScale(count, 0.0, width, paddingInner, padding ?: 0.1) else pointScale(count, 0.0, width, padding ?: 0.0)
    val positions = DoubleArray(count) { scale.center(it) }
    val ticks = thinTicks(List(count) { AxisTick(it.toDouble(), positions[it], labels[it]) })
    return CategoryAxis(
        if (band) CategoryAxisMode.Band else CategoryAxisMode.Point,
        positions,
        scale.step,
        if (scale.bandwidth != 0.0) scale.bandwidth else scale.step,
        ticks,
        scale::indexAt,
    )
}

/** "6 oct": the short axis label of a date. */
public fun shortDateLabel(
    epochMillis: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): String = if (epochMillis.isFinite()) "${dayOfMonth(epochMillis, locale, timeZone)} ${shortMonth(epochMillis, locale, timeZone)}" else ""

/**
 * Calendar-aligned time axis over category [times] (epoch milliseconds). Ticks sit on midnights, Mondays, month starts or January;
 * [tickCount] defaults to one per 84 px. A non-finite time has no position and is never returned by [CategoryAxis.indexAt].
 */
public fun timeCategoryAxis(
    times: DoubleArray,
    width: Double,
    locale: ChartLocale,
    timeZone: String? = null,
    tickCount: Int? = null,
): CategoryAxis {
    val range = extent(times)
    val scale = timeScale(range?.first ?: 0.0, range?.second ?: 0.0, 0.0, width, locale, timeZone)
    val positions = DoubleArray(times.size) { scale.map(times[it]) }
    var step = width
    var sorted = positions.none { it.isNaN() }
    for (i in 1 until positions.size) {
        val gap = abs(positions[i] - positions[i - 1])
        if (gap > 0) step = min(step, gap)
        if (positions[i] < positions[i - 1]) sorted = false
    }
    val count = tickCount ?: max(2, (width / 84).toInt())
    val ticks = scale.timeTicks(count).map { AxisTick(it.value, scale.map(it.value), it.label) }
    val locate: (Double) -> Int =
        if (sorted) {
            { pixel -> nearestSortedIndex(positions, pixel) }
        } else {
            { pixel -> nearestIndex(positions, pixel) }
        }
    return CategoryAxis(CategoryAxisMode.Time, positions, step, step, ticks, locate)
}
