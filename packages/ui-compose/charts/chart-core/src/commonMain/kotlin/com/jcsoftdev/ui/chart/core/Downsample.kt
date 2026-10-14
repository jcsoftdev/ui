package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

private fun identity(n: Int) = IntArray(n) { it }

/** Indices LTTB keeps from the first [n] points, over finite data. */
private fun lttb(
    xs: DoubleArray,
    ys: DoubleArray,
    n: Int,
    keep: Int,
): IntArray {
    if (keep >= n || keep < 3) return identity(n)
    val picked = IntArray(keep)
    picked[0] = 0
    val bucket = (n - 2).toDouble() / (keep - 2)
    var anchor = 0
    for (b in 0 until keep - 2) {
        val from = floor(b * bucket).toInt() + 1
        val to = min(n - 1, floor((b + 1) * bucket).toInt() + 1)
        val nextTo = min(n, floor((b + 2) * bucket).toInt() + 1)
        var avgX = 0.0
        var avgY = 0.0
        for (i in to until nextTo) {
            avgX += xs[i]
            avgY += ys[i]
        }
        val size = max(1, nextTo - to)
        avgX /= size
        avgY /= size
        val ax = xs[anchor]
        val ay = ys[anchor]
        var best = from
        var bestArea = -1.0
        for (i in from until to) {
            val area = abs((ax - avgX) * (ys[i] - ay) - (ax - xs[i]) * (avgY - ay))
            if (area > bestArea) {
                bestArea = area
                best = i
            }
        }
        picked[b + 1] = best
        anchor = best
    }
    picked[keep - 1] = n - 1
    return picked
}

/**
 * Largest-Triangle-Three-Buckets: the indices (ascending, first and last included) of at most [threshold] points that keep the
 * shape of a dense series. A point with a non-finite coordinate is dropped before sampling, and the indices refer to the input.
 * Returns every finite index when [threshold] is not smaller than the number of finite points or below 3.
 */
public fun lttbIndices(
    xs: DoubleArray,
    ys: DoubleArray,
    threshold: Int,
): IntArray {
    val size = min(xs.size, ys.size)
    var finite = 0
    for (i in 0 until size) if (xs[i].isFinite() && ys[i].isFinite()) finite++
    if (finite == size) return lttb(xs, ys, size, threshold)
    val where = IntArray(finite)
    val fx = DoubleArray(finite)
    val fy = DoubleArray(finite)
    var k = 0
    for (i in 0 until size) {
        if (xs[i].isFinite() && ys[i].isFinite()) {
            where[k] = i
            fx[k] = xs[i]
            fy[k++] = ys[i]
        }
    }
    val picked = lttb(fx, fy, finite, threshold)
    return IntArray(picked.size) { where[picked[it]] }
}

/**
 * Per-pixel-column min/max for a line or area over ascending [xs]: in each of [columns] equal columns of `[x0, x1]` the first, the
 * lowest, the highest and the last point survive, so every spike is drawn and the cost is bounded by the width, not the data. A
 * non-finite point ends its column, which keeps gaps. Indices are ascending and refer to the input.
 */
public fun minMaxIndices(
    xs: DoubleArray,
    ys: DoubleArray,
    x0: Double,
    x1: Double,
    columns: Int,
): IntArray {
    val size = min(xs.size, ys.size)
    if (columns <= 0 || !(x1 > x0) || !x0.isFinite() || !x1.isFinite()) return IntArray(0)
    val out = IntArrayBuilder(min(size, columns * 4))
    var column = -1
    var first = -1
    var lo = -1
    var hi = -1
    var last = -1

    fun flush() {
        if (first < 0) return
        val picks = intArrayOf(first, lo, hi, last).also { it.sort() }
        for (i in picks.indices) if (i == 0 || picks[i] != picks[i - 1]) out.add(picks[i])
        first = -1
        column = -1
    }
    val scale = columns / (x1 - x0)
    for (i in 0 until size) {
        val x = xs[i]
        val y = ys[i]
        if (!x.isFinite() || !y.isFinite()) {
            flush()
            continue
        }
        val c = min(columns - 1, max(0, floor((x - x0) * scale).toInt()))
        if (c != column) {
            flush()
            column = c
            first = i
            lo = i
            hi = i
        } else {
            if (y < ys[lo]) lo = i
            if (y > ys[hi]) hi = i
        }
        last = i
    }
    flush()
    return out.toArray()
}

private class IntArrayBuilder(
    capacity: Int,
) {
    private var data = IntArray(max(capacity, 8))
    private var size = 0

    fun add(value: Int) {
        if (size == data.size) data = data.copyOf(size * 2)
        data[size++] = value
    }

    fun toArray(): IntArray = data.copyOf(size)
}

/**
 * Indices to keep so several series that share one category axis stay aligned: the union of the LTTB picks of each series (over its
 * finite values; `NaN` is a gap), plus the neighbours of every gap so a gap is never bridged. Ascending. Null means the data is
 * small enough and nothing should be dropped.
 */
public fun sharedSampleIndices(
    series: Array<DoubleArray>,
    threshold: Int,
): IntArray? {
    var count = 0
    for (data in series) count = max(count, data.size)
    if (count <= threshold || threshold < 3) return null
    val keep = BooleanArray(count)
    keep[0] = true
    keep[count - 1] = true
    for (data in series) {
        var present = 0
        for (i in data.indices) if (data[i].isFinite()) present++
        val where = IntArray(present)
        val px = DoubleArray(present)
        val py = DoubleArray(present)
        var k = 0
        for (i in data.indices) {
            if (!data[i].isFinite()) {
                if (i > 0) keep[i - 1] = true
                if (i < count - 1) keep[i + 1] = true
            } else {
                where[k] = i
                px[k] = i.toDouble()
                py[k++] = data[i]
            }
        }
        for (picked in lttb(px, py, present, threshold)) keep[where[picked]] = true
    }
    return IntArray(keep.count { it }).also { out ->
        var j = 0
        for (i in 0 until count) if (keep[i]) out[j++] = i
    }
}
