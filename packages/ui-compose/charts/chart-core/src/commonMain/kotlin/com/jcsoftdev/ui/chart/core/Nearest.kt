package com.jcsoftdev.ui.chart.core

import kotlin.math.abs

/**
 * Index of the element of ascending, finite [xs] closest to [x] by binary search, O(log n). A tie goes to the lower index. Returns
 * -1 for an empty array or a non-finite [x]. Use [nearestIndex] when the array may be unsorted or hold `NaN`.
 */
public fun nearestSortedIndex(
    xs: DoubleArray,
    x: Double,
): Int {
    if (xs.isEmpty() || !x.isFinite()) return -1
    var lo = 0
    var hi = xs.size - 1
    while (lo < hi) {
        val mid = (lo + hi) ushr 1
        if (xs[mid] < x) lo = mid + 1 else hi = mid
    }
    val best = if (lo > 0 && abs(xs[lo - 1] - x) <= abs(xs[lo] - x)) lo - 1 else lo
    return firstEqual(xs, best)
}

/** Lowest index holding the same value as `xs[index]`, so duplicates resolve like the linear scan. */
private fun firstEqual(
    xs: DoubleArray,
    index: Int,
): Int {
    var lo = 0
    var hi = index
    while (lo < hi) {
        val mid = (lo + hi) ushr 1
        if (xs[mid] < xs[index]) lo = mid + 1 else hi = mid
    }
    return lo
}

/** Linear-scan variant of [nearestSortedIndex] for unsorted input; `NaN` elements are skipped. Ties go to the lower index. */
public fun nearestIndex(
    xs: DoubleArray,
    x: Double,
): Int {
    if (!x.isFinite()) return -1
    var best = -1
    var bestGap = Double.POSITIVE_INFINITY
    for (i in xs.indices) {
        val gap = abs(xs[i] - x)
        if (gap < bestGap) {
            best = i
            bestGap = gap
        }
    }
    return best
}
