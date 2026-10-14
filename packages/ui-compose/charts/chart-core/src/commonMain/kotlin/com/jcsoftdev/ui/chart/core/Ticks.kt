package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** A closed interval of finite numbers, ascending or descending as the caller gave it. */
public class NumberRange(
    public val first: Double,
    public val second: Double,
) {
    public val low: Double get() = min(first, second)
    public val high: Double get() = max(first, second)

    override fun toString(): String = "[$first, $second]"
}

internal fun pow10(exponent: Int): Double = 10.0.pow(exponent)

/** Rounds away binary noise such as 0.30000000000000004 by keeping 12 significant digits. */
public fun cleanNumber(value: Double): Double {
    if (value == 0.0 || !value.isFinite()) return value
    val exponent = floor(log10(abs(value))).toInt()
    if (exponent < -280 || exponent > 280) return value
    val shift = 11 - exponent
    return if (shift >= 0) {
        val p = pow10(shift)
        floor(value * p + 0.5) / p
    } else {
        val p = pow10(-shift)
        floor(value / p + 0.5) * p
    }
}

/** Step between ticks: 1, 2 or 5 times a power of ten, close to `span / count`. */
public fun tickStep(
    start: Double,
    end: Double,
    count: Int,
): Double {
    val raw = abs(end - start) / max(1, count)
    if (raw == 0.0 || !raw.isFinite()) return 1.0
    val power = pow10(floor(log10(raw)).toInt())
    val error = raw / power
    val factor =
        when {
            error >= 7.5 -> 10.0
            error >= 3.5 -> 5.0
            error >= 1.5 -> 2.0
            else -> 1.0
        }
    return factor * power
}

/** Widens `[min, max]` so both ends land on a tick. A flat domain gets some room. Non-finite ends fall back to `[0, 1]`. */
public fun niceDomain(
    start: Double,
    end: Double,
    count: Int = 5,
): NumberRange {
    if (!start.isFinite() || !end.isFinite()) return NumberRange(0.0, 1.0)
    var lo = min(start, end)
    var hi = max(start, end)
    if (lo == hi) {
        when {
            lo == 0.0 -> hi = 1.0
            lo > 0 -> {
                hi *= 2
                lo = 0.0
            }
            else -> {
                lo *= 2
                hi = 0.0
            }
        }
    }
    repeat(2) {
        val step = tickStep(lo, hi, count)
        lo = cleanNumber(floor(lo / step) * step)
        hi = cleanNumber(ceil(hi / step) * step)
    }
    return NumberRange(lo, hi)
}

/** Evenly spaced round values inside `[min, max]`; empty for a non-finite end. */
public fun linearTicks(
    start: Double,
    end: Double,
    count: Int = 5,
): DoubleArray {
    if (!start.isFinite() || !end.isFinite()) return DoubleArray(0)
    val lo = min(start, end)
    val hi = max(start, end)
    if (lo == hi) return doubleArrayOf(lo)
    val step = tickStep(lo, hi, count)
    val first = ceil(lo / step - 1e-9).toLong()
    val last = floor(hi / step + 1e-9).toLong()
    val size = (last - first + 1).coerceIn(0L, MAX_TICKS.toLong()).toInt()
    return DoubleArray(size) { cleanNumber((first + it) * step) }
}

private const val MAX_TICKS = 10_000
