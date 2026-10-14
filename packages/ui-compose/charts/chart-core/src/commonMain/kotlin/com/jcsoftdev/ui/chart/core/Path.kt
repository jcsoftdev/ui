package com.jcsoftdev.ui.chart.core

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** `Smooth` is a monotone cubic; the `Step*` curves hold a value until the next sample (After), jump to it early (Before) or change halfway. */
public enum class Curve { Linear, Smooth, Step, StepBefore, StepAfter }

/** Receives path commands without allocating; the Compose layer turns them into a `Path`, tests into SVG. Coordinates are pixels. */
public interface PathVisitor {
    public fun moveTo(
        x: Double,
        y: Double,
    )

    public fun lineTo(
        x: Double,
        y: Double,
    )

    public fun horizontalTo(x: Double)

    public fun verticalTo(y: Double)

    public fun cubicTo(
        x1: Double,
        y1: Double,
        x2: Double,
        y2: Double,
        x: Double,
        y: Double,
    )

    /** Quarter circle of [radius] drawn clockwise to ([x], [y]). */
    public fun arcTo(
        radius: Double,
        x: Double,
        y: Double,
    )

    public fun close()
}

/** A path as flat primitive arrays: one op byte per command and its coordinates in order. Non-finite coordinates are never stored. */
public class PathCommands {
    private var ops = ByteArray(16)
    private var coords = DoubleArray(64)
    private var opCount = 0
    private var coordCount = 0

    public val isEmpty: Boolean get() = opCount == 0
    public val commandCount: Int get() = opCount

    private fun op(code: Int) {
        if (opCount == ops.size) ops = ops.copyOf(opCount * 2)
        ops[opCount++] = code.toByte()
    }

    private fun put(value: Double) {
        if (coordCount == coords.size) coords = coords.copyOf(coordCount * 2)
        coords[coordCount++] = value
    }

    internal fun moveTo(
        x: Double,
        y: Double,
    ) {
        op(MOVE)
        put(x)
        put(y)
    }

    internal fun lineTo(
        x: Double,
        y: Double,
    ) {
        op(LINE)
        put(x)
        put(y)
    }

    internal fun horizontalTo(x: Double) {
        op(HORIZONTAL)
        put(x)
    }

    internal fun verticalTo(y: Double) {
        op(VERTICAL)
        put(y)
    }

    internal fun cubicTo(
        x1: Double,
        y1: Double,
        x2: Double,
        y2: Double,
        x: Double,
        y: Double,
    ) {
        op(CUBIC)
        put(x1)
        put(y1)
        put(x2)
        put(y2)
        put(x)
        put(y)
    }

    internal fun arcTo(
        radius: Double,
        x: Double,
        y: Double,
    ) {
        op(ARC)
        put(radius)
        put(x)
        put(y)
    }

    internal fun close() = op(CLOSE)

    public fun visit(visitor: PathVisitor) {
        var c = 0
        for (i in 0 until opCount) {
            when (ops[i].toInt()) {
                MOVE -> visitor.moveTo(coords[c], coords[c + 1]).also { c += 2 }
                LINE -> visitor.lineTo(coords[c], coords[c + 1]).also { c += 2 }
                HORIZONTAL -> visitor.horizontalTo(coords[c++])
                VERTICAL -> visitor.verticalTo(coords[c++])
                CUBIC ->
                    visitor
                        .cubicTo(
                            coords[c],
                            coords[c + 1],
                            coords[c + 2],
                            coords[c + 3],
                            coords[c + 4],
                            coords[c + 5],
                        ).also { c += 6 }
                ARC -> visitor.arcTo(coords[c], coords[c + 1], coords[c + 2]).also { c += 3 }
                else -> visitor.close()
            }
        }
    }

    /** SVG path data rounded to 0.01 px, byte for byte what the web charts emit. */
    public fun toSvg(): String {
        val out = StringBuilder()
        visit(
            object : PathVisitor {
                override fun moveTo(
                    x: Double,
                    y: Double,
                ) {
                    out
                        .append('M')
                        .append(fmt(x))
                        .append(',')
                        .append(fmt(y))
                }

                override fun lineTo(
                    x: Double,
                    y: Double,
                ) {
                    out
                        .append('L')
                        .append(fmt(x))
                        .append(',')
                        .append(fmt(y))
                }

                override fun horizontalTo(x: Double) {
                    out.append('H').append(fmt(x))
                }

                override fun verticalTo(y: Double) {
                    out.append('V').append(fmt(y))
                }

                override fun cubicTo(
                    x1: Double,
                    y1: Double,
                    x2: Double,
                    y2: Double,
                    x: Double,
                    y: Double,
                ) {
                    out
                        .append('C')
                        .append(fmt(x1))
                        .append(',')
                        .append(fmt(y1))
                        .append(' ')
                    out
                        .append(fmt(x2))
                        .append(',')
                        .append(fmt(y2))
                        .append(' ')
                        .append(fmt(x))
                        .append(',')
                        .append(fmt(y))
                }

                override fun arcTo(
                    radius: Double,
                    x: Double,
                    y: Double,
                ) {
                    out
                        .append(
                            'A',
                        ).append(fmt(radius))
                        .append(',')
                        .append(fmt(radius))
                        .append(" 0 0 1 ")
                        .append(fmt(x))
                        .append(',')
                        .append(fmt(y))
                }

                override fun close() {
                    out.append('Z')
                }
            },
        )
        return out.toString()
    }

    private companion object {
        const val MOVE = 0
        const val LINE = 1
        const val HORIZONTAL = 2
        const val VERTICAL = 3
        const val CUBIC = 4
        const val ARC = 5
        const val CLOSE = 6
    }
}

/** Rounds half up to 0.01 and prints without exponent or trailing zeros, like JavaScript's `Math.round(v * 100) / 100`. */
internal fun fmt(value: Double): String {
    val scaled = floor(value * 100 + 0.5)
    if (scaled == 0.0 || !scaled.isFinite()) return "0"
    val n = scaled.toLong()
    val abs = if (n < 0) -n else n
    val whole = abs / 100
    val frac = (abs % 100).toInt()
    val sign = if (n < 0) "-" else ""
    return when {
        frac == 0 -> "$sign$whole"
        frac % 10 == 0 -> "$sign$whole.${frac / 10}"
        else -> "$sign$whole.${if (frac < 10) "0" else ""}$frac"
    }
}

private fun finite(
    x: Double,
    y: Double,
): Boolean = x.isFinite() && y.isFinite()

/**
 * Tangents of a monotone cubic through points `from until to` (Fritsch-Butland): the curve never overshoots between two samples, so
 * a peak in the data is a peak on screen.
 */
public fun monotoneTangents(
    xs: DoubleArray,
    ys: DoubleArray,
    from: Int = 0,
    to: Int = xs.size,
): DoubleArray {
    val n = to - from
    if (n < 2) return DoubleArray(max(n, 1))
    val widths = DoubleArray(n - 1) { xs[from + it + 1] - xs[from + it] }
    val slopes = DoubleArray(n - 1) { if (widths[it] == 0.0) 0.0 else (ys[from + it + 1] - ys[from + it]) / widths[it] }
    val tangents = DoubleArray(n)
    tangents[0] = slopes[0]
    for (k in 1 until n - 1) {
        val d0 = slopes[k - 1]
        val d1 = slopes[k]
        val h0 = widths[k - 1]
        val h1 = widths[k]
        tangents[k] = if (d0 * d1 <= 0) 0.0 else (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1)
    }
    tangents[n - 1] = slopes[n - 2]
    return tangents
}

/** Commands through points `from until to`. The first command is `M`, or `L` when [join] is set so the run extends a path (areas). */
private fun PathCommands.curve(
    xs: DoubleArray,
    ys: DoubleArray,
    from: Int,
    to: Int,
    curve: Curve,
    join: Boolean,
) {
    if (to <= from) return
    if (join) lineTo(xs[from], ys[from]) else moveTo(xs[from], ys[from])
    val count = to - from
    when {
        curve == Curve.Step || curve == Curve.StepBefore || curve == Curve.StepAfter ->
            for (k in from + 1 until to) {
                when (curve) {
                    Curve.StepAfter -> {
                        horizontalTo(xs[k])
                        verticalTo(ys[k])
                    }
                    Curve.StepBefore -> {
                        verticalTo(ys[k])
                        horizontalTo(xs[k])
                    }
                    else -> {
                        horizontalTo(round2((xs[k - 1] + xs[k]) / 2))
                        verticalTo(ys[k])
                        horizontalTo(xs[k])
                    }
                }
            }
        curve == Curve.Linear || count < 3 -> for (k in from + 1 until to) lineTo(xs[k], ys[k])
        else -> {
            val m = monotoneTangents(xs, ys, from, to)
            for (k in 0 until count - 1) {
                val ax = xs[from + k]
                val ay = ys[from + k]
                val bx = xs[from + k + 1]
                val by = ys[from + k + 1]
                val h = (bx - ax) / 3
                cubicTo(ax + h, ay + m[k] * h, bx - h, by - m[k + 1] * h, bx, by)
            }
        }
    }
}

private fun round2(value: Double): Double = floor(value * 100 + 0.5) / 100

/** Index ranges `[start, end)` of consecutive points with finite coordinates. */
private inline fun runs(
    size: Int,
    isPoint: (Int) -> Boolean,
    action: (Int, Int) -> Unit,
) {
    var start = -1
    for (i in 0 until size) {
        if (isPoint(i)) {
            if (start < 0) start = i
        } else if (start >= 0) {
            action(start, i)
            start = -1
        }
    }
    if (start >= 0) action(start, size)
}

/** Line through `(xs[i], ys[i])`. A point with a non-finite coordinate is a gap that breaks the line. */
public fun linePath(
    xs: DoubleArray,
    ys: DoubleArray,
    curve: Curve = Curve.Linear,
): PathCommands {
    val out = PathCommands()
    val size = min(xs.size, ys.size)
    runs(size, { finite(xs[it], ys[it]) }) { s, e -> out.curve(xs, ys, s, e, curve, false) }
    return out
}

private fun mirror(curve: Curve): Curve =
    when (curve) {
        Curve.StepBefore -> Curve.StepAfter
        Curve.StepAfter -> Curve.StepBefore
        else -> curve
    }

/**
 * Closed area between a top and a bottom edge sampled at the same positions (`bottom[i]` pairs with `top[i]`). A position where
 * either edge is non-finite breaks the area.
 */
public fun areaPath(
    topX: DoubleArray,
    topY: DoubleArray,
    bottomX: DoubleArray,
    bottomY: DoubleArray,
    curve: Curve = Curve.Linear,
): PathCommands {
    val out = PathCommands()
    val size = min(min(topX.size, topY.size), min(bottomX.size, bottomY.size))
    runs(size, { finite(topX[it], topY[it]) && finite(bottomX[it], bottomY[it]) }) { s, e ->
        out.curve(topX, topY, s, e, curve, false)
        val n = e - s
        val rx = DoubleArray(n) { bottomX[e - 1 - it] }
        val ry = DoubleArray(n) { bottomY[e - 1 - it] }
        out.curve(rx, ry, 0, n, mirror(curve), true)
        out.close()
    }
    return out
}

/** A corner radius, or zero when it is not a finite number (a NaN radius must not reach the path). */
private fun radius(value: Double): Double = if (value.isFinite()) max(0.0, value) else 0.0

/** Rectangle with an independent radius per corner, clamped to fit. */
public fun roundedRectPath(
    x: Double,
    y: Double,
    width: Double,
    height: Double,
    topLeft: Double,
    topRight: Double,
    bottomRight: Double,
    bottomLeft: Double,
): PathCommands {
    val out = PathCommands()
    if (!(x.isFinite() && y.isFinite() && width.isFinite() && height.isFinite())) return out
    val w = max(0.0, width)
    val h = max(0.0, height)
    val cap = min(w, h) / 2
    val tl = min(radius(topLeft), cap)
    val tr = min(radius(topRight), cap)
    val br = min(radius(bottomRight), cap)
    val bl = min(radius(bottomLeft), cap)
    out.moveTo(x + tl, y)
    out.horizontalTo(x + w - tr)
    if (tr != 0.0) out.arcTo(tr, x + w, y + tr)
    out.verticalTo(y + h - br)
    if (br != 0.0) out.arcTo(br, x + w - br, y + h)
    out.horizontalTo(x + bl)
    if (bl != 0.0) out.arcTo(bl, x, y + h - bl)
    out.verticalTo(y + tl)
    if (tl != 0.0) out.arcTo(tl, x + tl, y)
    out.close()
    return out
}

public enum class BarEnd { Top, Bottom, Left, Right, All, None }

/** Bar rounded only at its value end, the way the eye reads the bar's length. */
public fun barPath(
    x: Double,
    y: Double,
    width: Double,
    height: Double,
    radius: Double,
    end: BarEnd,
): PathCommands {
    val all = end == BarEnd.All

    fun on(corner: Boolean) = if (corner) radius else 0.0
    return roundedRectPath(
        x,
        y,
        width,
        height,
        on(all || end == BarEnd.Top || end == BarEnd.Left),
        on(all || end == BarEnd.Top || end == BarEnd.Right),
        on(all || end == BarEnd.Bottom || end == BarEnd.Right),
        on(all || end == BarEnd.Bottom || end == BarEnd.Left),
    )
}
