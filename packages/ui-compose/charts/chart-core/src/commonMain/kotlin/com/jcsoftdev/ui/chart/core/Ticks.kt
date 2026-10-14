package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** A closed interval of finite numbers, ascending or descending as the caller gave it. */
public class NumberRange(
    public val first: Double,
    public val second: Double,
) {
    public val low: Double get() = min(first, second)
    public val high: Double get() = max(first, second)

    override fun toString(): String = "[$first, $second]"
}

/**
 * Powers of ten whose `10 ** n` in V8 (Node 22) is one ulp off the exact value. The web tick code computes its step as `10 ** n`, so
 * its results carry that error (the nice domain of a series around 0.3542 ends at 0.35427 rather than 0.35426). A platform `pow` cannot
 * reproduce it: glibc and Apple's libm round correctly, fdlibm-based ones differ in other places. The table pins what the parity
 * fixtures were generated with, for the exponents a chart can plausibly reach.
 */
private val V8_POW10 =
    mapOf(
        -39 to 1.0000000000000001e-39,
        -32 to 9.999999999999999e-33,
        -29 to 1.0000000000000001e-29,
        -24 to 1.0000000000000001e-24,
        -23 to 1.0000000000000001e-23,
        -21 to 1.0000000000000001e-21,
        -20 to 1.0000000000000001e-20,
        -17 to 9.999999999999999e-18,
        -5 to 0.000009999999999999999,
        -4 to 0.00009999999999999999,
        26 to 9.999999999999999e+25,
        29 to 1.0000000000000001e+29,
        34 to 1.0000000000000001e+34,
        36 to 9.999999999999999e+35,
        39 to 1.0000000000000001e+39,
    )

/** 10^[exponent] as the web computes it: the table above where V8's `10 ** n` is off, otherwise the correctly rounded value. */
internal fun pow10(exponent: Int): Double = V8_POW10[exponent] ?: exactPow10(exponent)

private fun exactPow10(exponent: Int): Double = "1E$exponent".toDouble()

private const val LN_10 = 2.302585092994046

/**
 * floor(log10(x)) for finite x > 0, as JavaScript's `Math.floor(Math.log10(x))` gives it with a correctly rounded log10: the exact
 * floor from the decimal digits, lifted by one when x is so close under a power of ten that log10 rounds to it (9.999999999999998e-6
 * has log10 -5, not -5.0000000000000001). Libm implementations differ in that last ulp, this does not.
 */
internal fun floorLog10(value: Double): Int {
    val exact = decimalOf(value).pointExp - 1
    val next = exact + 1
    val power = exactPow10(next)
    if (value >= power) return next
    val below = (power - value) / power
    return if (next - below / LN_10 == next.toDouble()) next else exact
}

/** ceil(log10(x)) for finite x > 0, by the same rule: a value just above a power of ten whose log10 rounds to it ceils to it. */
internal fun ceilLog10(value: Double): Int {
    val decimal = decimalOf(value)
    val exact = decimal.pointExp - 1
    if (decimal.digits == "1") return exact
    val power = exactPow10(exact)
    val above = (value - power) / power
    return if (exact + above / LN_10 == exact.toDouble()) exact else exact + 1
}

/**
 * Rounds away binary noise such as 0.30000000000000004 by keeping 12 significant digits, like JavaScript's `toPrecision(12)`.
 * The rounding acts on the shortest decimal the number prints as, half away from zero, and never returns -0. It differs from
 * `toPrecision` only for a number whose 13-digit shortest form ends in 5 while its binary value sits just below the tie.
 */
public fun cleanNumber(value: Double): Double {
    if (!value.isFinite()) return value
    if (value == 0.0) return 0.0
    val decimal = decimalOf(abs(value))
    val rounded = decimal.rounded(12 - decimal.pointExp)
    val result = rounded.toDouble()
    return if (result == 0.0) {
        0.0
    } else if (value < 0) {
        -result
    } else {
        result
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
    val power = pow10(floorLog10(raw))
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
