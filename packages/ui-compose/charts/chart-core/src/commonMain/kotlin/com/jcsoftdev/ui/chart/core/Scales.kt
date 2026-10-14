package com.jcsoftdev.ui.chart.core

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

public enum class ScaleType { Linear, Log, Time }

/**
 * Maps a data domain onto a pixel range. A non-finite input maps to `NaN` ("no position"), never to an infinite coordinate,
 * so a bad datum can be skipped by the geometry builders instead of corrupting a path.
 */
public interface ContinuousScale {
    public val type: ScaleType
    public val domain: NumberRange
    public val range: NumberRange

    /** Tick count `ticks()` uses when none is given. */
    public val tickCount: Int

    public fun map(value: Double): Double

    public fun invert(pixel: Double): Double

    public fun ticks(count: Int): DoubleArray
}

public fun ContinuousScale.ticks(): DoubleArray = ticks(tickCount)

/** Min and max of the finite numbers in `values`, or null when there are none. */
public fun extent(values: DoubleArray): NumberRange? {
    var lo = Double.POSITIVE_INFINITY
    var hi = Double.NEGATIVE_INFINITY
    for (value in values) {
        if (!value.isFinite()) continue
        if (value < lo) lo = value
        if (value > hi) hi = value
    }
    return if (lo == Double.POSITIVE_INFINITY) null else NumberRange(lo, hi)
}

private fun finiteOr(
    value: Double,
    fallback: Double,
): Double = if (value.isFinite()) value else fallback

private class LinearScale(
    private val d0: Double,
    d1: Double,
    override val range: NumberRange,
    override val tickCount: Int,
) : ContinuousScale {
    private val span = if (d1 - d0 == 0.0) 1.0 else d1 - d0
    private val r0 = range.first
    private val rSpan = range.second - range.first
    override val type: ScaleType get() = ScaleType.Linear
    override val domain: NumberRange = NumberRange(d0, d1)

    override fun map(value: Double): Double = if (value.isFinite()) r0 + (value - d0) / span * rSpan else Double.NaN

    override fun invert(pixel: Double): Double =
        if (pixel.isFinite()) d0 + (pixel - r0) / (if (rSpan == 0.0) 1.0 else rSpan) * span else Double.NaN

    override fun ticks(count: Int): DoubleArray = linearTicks(domain.first, domain.second, count)
}

/** Linear scale. `nice` extends the domain to round tick values; a non-finite domain end or range end becomes 0 / 1. */
public fun linearScale(
    domainStart: Double,
    domainEnd: Double,
    rangeStart: Double,
    rangeEnd: Double,
    nice: Boolean = true,
    tickCount: Int = 5,
): ContinuousScale {
    val a = finiteOr(domainStart, 0.0)
    val b = finiteOr(domainEnd, 1.0)
    val d = if (nice) niceDomain(a, b, tickCount) else NumberRange(a, b)
    return LinearScale(d.first, d.second, NumberRange(finiteOr(rangeStart, 0.0), finiteOr(rangeEnd, 1.0)), tickCount)
}

private class LogScale(
    private val e0: Int,
    private val e1: Int,
    override val range: NumberRange,
) : ContinuousScale {
    override val tickCount: Int get() = 5
    private val floorValue = max(pow10(e0), Double.MIN_VALUE)
    private val span = (e1 - e0).toDouble()
    private val r0 = range.first
    private val rSpan = range.second - range.first
    override val type: ScaleType get() = ScaleType.Log
    override val domain: NumberRange = NumberRange(pow10(e0), pow10(e1))

    override fun map(value: Double): Double =
        if (value.isNaN() || value == Double.POSITIVE_INFINITY) {
            Double.NaN
        } else {
            r0 + (log10(max(value, floorValue)) - e0) / span * rSpan
        }

    override fun invert(pixel: Double): Double =
        if (pixel.isFinite()) 10.0.pow(e0 + (pixel - r0) / (if (rSpan == 0.0) 1.0 else rSpan) * span) else Double.NaN

    override fun ticks(count: Int): DoubleArray {
        val multiples = if (span <= 2) doubleArrayOf(1.0, 2.0, 5.0) else doubleArrayOf(1.0)
        val out = DoubleArray((e1 - e0 + 1) * multiples.size)
        var size = 0
        val top = pow10(e1)
        for (e in e0..e1) {
            for (m in multiples) {
                val tick = cleanNumber(m * pow10(e))
                if (tick <= top) out[size++] = tick
            }
        }
        return out.copyOf(size)
    }
}

/** Base-10 logarithmic scale extended to whole decades. Non-positive values are clamped to the smallest positive number. */
public fun logScale(
    domainStart: Double,
    domainEnd: Double,
    rangeStart: Double,
    rangeEnd: Double,
): ContinuousScale {
    val a = finiteOr(domainStart, 1.0)
    val b = finiteOr(domainEnd, 10.0)
    val lo = max(min(a, b), Double.MIN_VALUE)
    val hi = max(max(a, b), lo)
    val e0 = floor(log10(lo)).toInt()
    val e1 = max(ceil(log10(hi)).toInt(), e0 + 1)
    return LogScale(e0, e1, NumberRange(finiteOr(rangeStart, 0.0), finiteOr(rangeEnd, 1.0)))
}

/**
 * Index-based categorical scale. A band scale gives every category a slot with a bar-sized `bandwidth`; a point scale spreads
 * categories edge to edge (bandwidth 0), which suits lines and areas.
 */
public interface BandScale {
    public val count: Int
    public val range: NumberRange
    public val step: Double
    public val bandwidth: Double

    /** Leading edge of category `index`. */
    public fun start(index: Int): Double

    /** Center of category `index`. */
    public fun center(index: Int): Double

    /** Category under `pixel`, clamped to the valid range; -1 when empty or the pixel is not finite. */
    public fun indexAt(pixel: Double): Int
}

private class Band(
    override val count: Int,
    override val range: NumberRange,
    override val step: Double,
    override val bandwidth: Double,
    private val offset: Double,
    private val gap: Double,
) : BandScale {
    override fun start(index: Int): Double = offset + index * step

    override fun center(index: Int): Double = offset + index * step + bandwidth / 2

    override fun indexAt(pixel: Double): Int {
        if (count == 0 || !pixel.isFinite()) return -1
        val raw = floor((pixel - offset + gap / 2) / step)
        return min((count - 1).toDouble(), max(0.0, raw)).toInt()
    }
}

public fun bandScale(
    count: Int,
    rangeStart: Double,
    rangeEnd: Double,
    paddingInner: Double = 0.2,
    paddingOuter: Double = 0.1,
): BandScale {
    val r0 = finiteOr(rangeStart, 0.0)
    val r1 = finiteOr(rangeEnd, 1.0)
    val slots = max(1.0, count - paddingInner + paddingOuter * 2)
    val step = (r1 - r0) / slots
    val bandwidth = step * (1 - paddingInner)
    return Band(count, NumberRange(r0, r1), step, bandwidth, r0 + step * paddingOuter, step - bandwidth)
}

private class Point(
    override val count: Int,
    override val range: NumberRange,
    override val step: Double,
    private val offset: Double,
) : BandScale {
    override val bandwidth: Double get() = 0.0

    override fun start(index: Int): Double = center(index)

    override fun center(index: Int): Double = if (count <= 1) offset else offset + index * step

    override fun indexAt(pixel: Double): Int {
        if (count == 0 || !pixel.isFinite()) return -1
        if (count == 1) return 0
        return min((count - 1).toDouble(), max(0.0, floor((pixel - offset) / step + 0.5))).toInt()
    }
}

/** Points edge to edge. `padding` is the space before the first and after the last point, as a fraction of the step. */
public fun pointScale(
    count: Int,
    rangeStart: Double,
    rangeEnd: Double,
    padding: Double = 0.0,
): BandScale {
    val r0 = finiteOr(rangeStart, 0.0)
    val r1 = finiteOr(rangeEnd, 1.0)
    val range = NumberRange(r0, r1)
    if (count <= 1) return Point(count, range, r1 - r0, (r0 + r1) / 2)
    val step = (r1 - r0) / (count - 1 + padding * 2)
    return Point(count, range, step, r0 + step * padding)
}
