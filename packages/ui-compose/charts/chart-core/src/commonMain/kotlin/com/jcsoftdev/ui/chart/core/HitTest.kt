package com.jcsoftdev.ui.chart.core

import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Uniform-grid spatial index for dense scatter plots. Building is O(n) over primitive arrays, a lookup visits only the few cells around
 * the pointer, so hit testing 50 000 points costs microseconds. Points with a non-finite coordinate are not indexed. Cells are exact
 * (the web index hashes cells and can collide).
 */
public class PointIndex(
    private val xs: DoubleArray,
    private val ys: DoubleArray,
    private val radii: DoubleArray? = null,
    cellSize: Double = 24.0,
) {
    private val originX: Double
    private val originY: Double
    private val cell: Double
    private val cols: Int
    private val rows: Int
    private val starts: IntArray
    private val items: IntArray
    private val maxRadius: Double

    init {
        val n = min(xs.size, ys.size)
        var loX = Double.POSITIVE_INFINITY
        var loY = Double.POSITIVE_INFINITY
        var hiX = Double.NEGATIVE_INFINITY
        var hiY = Double.NEGATIVE_INFINITY
        var maxR = 0.0
        var count = 0
        for (i in 0 until n) {
            if (!xs[i].isFinite() || !ys[i].isFinite()) continue
            count++
            loX = min(loX, xs[i])
            hiX = max(hiX, xs[i])
            loY = min(loY, ys[i])
            hiY = max(hiY, ys[i])
            radii?.getOrNull(i)?.let { if (it.isFinite()) maxR = max(maxR, it) }
        }
        maxRadius = maxR
        var size = max(4.0, cellSize)
        if (count == 0) {
            originX = 0.0
            originY = 0.0
            cell = size
            cols = 0
            rows = 0
            starts = IntArray(1)
            items = IntArray(0)
        } else {
            // Keep the grid within a few million cells however spread out the points are.
            val area = (hiX - loX + 1) * (hiY - loY + 1)
            size = max(size, sqrt(area / MAX_CELLS))
            originX = loX
            originY = loY
            cell = size
            cols = floor((hiX - loX) / size).toInt() + 1
            rows = floor((hiY - loY) / size).toInt() + 1
            starts = IntArray(cols * rows + 1)
            val cellOf = IntArray(n) { -1 }
            for (i in 0 until n) {
                if (!xs[i].isFinite() || !ys[i].isFinite()) continue
                val id = cx(xs[i]) * rows + cy(ys[i])
                cellOf[i] = id
                starts[id + 1]++
            }
            for (i in 1 until starts.size) starts[i] += starts[i - 1]
            val fill = starts.copyOf()
            items = IntArray(count)
            for (i in 0 until n) if (cellOf[i] >= 0) items[fill[cellOf[i]]++] = i
        }
    }

    private fun cx(x: Double): Int = floor((x - originX) / cell).toInt()

    private fun cy(y: Double): Int = floor((y - originY) / cell).toInt()

    /**
     * Index of the mark closest to ([x], [y]) within [radius] pixels of its edge (a pointer inside a mark is at distance 0), or -1.
     * A tie goes to the smaller mark, so a small bubble inside a big one stays reachable; then to the earlier one in grid order.
     */
    public fun nearest(
        x: Double,
        y: Double,
        radius: Double = 16.0,
    ): Int {
        if (!x.isFinite() || !y.isFinite() || cols == 0) return -1
        val reach = radius + maxRadius
        val x0 = max(0, cx(x - reach))
        val x1 = min(cols - 1, cx(x + reach))
        val y0 = max(0, cy(y - reach))
        val y1 = min(rows - 1, cy(y + reach))
        var best = -1
        var bestDistance = Double.POSITIVE_INFINITY
        var bestRadius = Double.POSITIVE_INFINITY
        for (gx in x0..x1) {
            for (gy in y0..y1) {
                val id = gx * rows + gy
                for (k in starts[id] until starts[id + 1]) {
                    val i = items[k]
                    val r = radii?.getOrNull(i) ?: 0.0
                    val distance = max(0.0, hypot(xs[i] - x, ys[i] - y) - r)
                    if (distance > radius) continue
                    if (distance < bestDistance || (distance == bestDistance && r < bestRadius)) {
                        best = i
                        bestDistance = distance
                        bestRadius = r
                    }
                }
            }
        }
        return best
    }

    private companion object {
        const val MAX_CELLS = 4_000_000.0
    }
}

/** Gap (px) a pointer may sit in between two adjacent cells and still count as on the nearest one. */
public const val GUTTER_SNAP: Double = 6.0

/**
 * Index of the box (`x0[i]..x1[i]`, `y0[i]..y1[i]`) containing ([x], [y]), else the nearest one within [radius] px, else -1. Later boxes
 * win ties, like paint order, so crossing the thin gutter between two cells goes A to B without an empty frame in between.
 */
public fun boxAt(
    x0: DoubleArray,
    y0: DoubleArray,
    x1: DoubleArray,
    y1: DoubleArray,
    x: Double,
    y: Double,
    radius: Double = GUTTER_SNAP,
): Int {
    if (!x.isFinite() || !y.isFinite()) return -1
    var best = -1
    var gap = radius
    for (i in min(min(x0.size, y0.size), min(x1.size, y1.size)) - 1 downTo 0) {
        val dx = max(max(x0[i] - x, 0.0), x - x1[i])
        val dy = max(max(y0[i] - y, 0.0), y - y1[i])
        if (dx.isNaN() || dy.isNaN()) continue
        if (dx == 0.0 && dy == 0.0) return i
        val distance = hypot(dx, dy)
        if (distance <= gap && (best == -1 || distance < gap)) {
            best = i
            gap = distance
        }
    }
    return best
}

/** Position of [key] in [keys], or -1. Selection is kept by key so it survives a reorder and drops when the key disappears. */
public fun <K> indexOfKey(
    keys: List<K>,
    key: K?,
): Int = if (key == null) -1 else keys.indexOf(key)

/** [key] if it is still among [keys], else null: what a pinned or hovered mark becomes after the data changes. */
public fun <K> retainKey(
    keys: List<K>,
    key: K?,
): K? = if (key != null && keys.contains(key)) key else null
