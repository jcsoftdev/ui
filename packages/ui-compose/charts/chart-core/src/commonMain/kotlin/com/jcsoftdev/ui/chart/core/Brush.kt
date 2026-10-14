package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** Normalized rectangle in data units (x0 <= x1, y0 <= y1). An infinite edge means "unbounded"; `NaN` is never stored. */
public class BrushRect(
    public val x0: Double,
    public val x1: Double,
    public val y0: Double,
    public val y1: Double,
) {
    public fun contains(
        x: Double,
        y: Double,
    ): Boolean = x >= x0 && x <= x1 && y >= y0 && y <= y1
}

/** One range filter per axis; a null axis is unbounded and not filtered. */
public class BrushRanges(
    public val x: NumberRange?,
    public val y: NumberRange?,
)

public enum class BrushKey { Left, Right, Up, Down }

private fun clamp(
    value: Double,
    lo: Double,
    hi: Double,
): Double = min(hi, max(lo, value))

private fun orElse(
    value: Double,
    fallback: Double,
): Double = if (value.isNaN()) fallback else value

/** Rectangle spanned by two corners, whatever the drag direction. A `NaN` coordinate collapses onto the other corner. */
public fun rectFromCorners(
    ax: Double,
    ay: Double,
    bx: Double,
    by: Double,
): BrushRect {
    val x0 = orElse(ax, bx)
    val x1 = orElse(bx, ax)
    val y0 = orElse(ay, by)
    val y1 = orElse(by, ay)
    return BrushRect(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1))
}

/** Keeps the rectangle inside the plot domains. */
public fun clampRect(
    rect: BrushRect,
    xDomain: NumberRange,
    yDomain: NumberRange,
): BrushRect =
    BrushRect(
        clamp(rect.x0, xDomain.low, xDomain.high),
        clamp(rect.x1, xDomain.low, xDomain.high),
        clamp(rect.y0, yDomain.low, yDomain.high),
        clamp(rect.y1, yDomain.low, yDomain.high),
    )

/** One range filter per axis; an unbounded axis gives null. */
public fun rectToRanges(rect: BrushRect): BrushRanges {
    fun bounded(
        lo: Double,
        hi: Double,
    ) = if (lo.isFinite() && hi.isFinite()) NumberRange(min(lo, hi), max(lo, hi)) else null
    return BrushRanges(bounded(rect.x0, rect.x1), bounded(rect.y0, rect.y1))
}

/** Rectangle of the active range filters; an axis nobody filters stays unbounded. */
public fun rangesToRect(
    x: NumberRange?,
    y: NumberRange?,
): BrushRect? {
    if (x == null && y == null) return null
    return BrushRect(
        x?.low ?: Double.NEGATIVE_INFINITY,
        x?.high ?: Double.POSITIVE_INFINITY,
        y?.low ?: Double.NEGATIVE_INFINITY,
        y?.high ?: Double.POSITIVE_INFINITY,
    )
}

/** True when the drag moved less than [min] pixels in both axes: it was a click. */
public fun isClick(
    ax: Double,
    ay: Double,
    bx: Double,
    by: Double,
    min: Double = 4.0,
): Boolean = abs(ax - bx) < min && abs(ay - by) < min

/** Brush that keyboard users start from: the middle half of both domains. */
public fun defaultBrush(
    xDomain: NumberRange,
    yDomain: NumberRange,
): BrushRect {
    val xs = xDomain.high - xDomain.low
    val ys = yDomain.high - yDomain.low
    return BrushRect(xDomain.low + xs * 0.25, xDomain.low + xs * 0.75, yDomain.low + ys * 0.25, yDomain.low + ys * 0.75)
}

private fun shift(
    lo: Double,
    hi: Double,
    delta: Double,
    dLo: Double,
    dHi: Double,
): DoubleArray {
    val size = hi - lo
    val start = clamp(lo + delta, dLo, dHi - size)
    return doubleArrayOf(start, start + size)
}

private fun resize(
    lo: Double,
    hi: Double,
    delta: Double,
    minSize: Double,
    dHi: Double,
): DoubleArray = doubleArrayOf(lo, clamp(hi + delta, min(dHi, lo + minSize), dHi))

/**
 * Keyboard step. Arrows move the rectangle by [fraction] (5%) of the domain; with [grow] they resize it instead (right and up make it
 * larger, left and down smaller). It never leaves the domains and never collapses below one step.
 */
public fun stepBrush(
    rect: BrushRect,
    key: BrushKey,
    grow: Boolean,
    xDomain: NumberRange,
    yDomain: NumberRange,
    fraction: Double = 0.05,
): BrushRect {
    val dx = (xDomain.high - xDomain.low) * fraction
    val dy = (yDomain.high - yDomain.low) * fraction
    val sign = if (key == BrushKey.Right || key == BrushKey.Up) 1.0 else -1.0
    if (key == BrushKey.Left || key == BrushKey.Right) {
        val r =
            if (grow) {
                resize(rect.x0, rect.x1, sign * dx, dx, xDomain.high)
            } else {
                shift(rect.x0, rect.x1, sign * dx, xDomain.low, xDomain.high)
            }
        return BrushRect(r[0], r[1], rect.y0, rect.y1)
    }
    val r =
        if (grow) {
            resize(
                rect.y0,
                rect.y1,
                sign * dy,
                dy,
                yDomain.high,
            )
        } else {
            shift(rect.y0, rect.y1, sign * dy, yDomain.low, yDomain.high)
        }
    return BrushRect(rect.x0, rect.x1, r[0], r[1])
}

public const val TOUCH_BRUSH_DELAY: Double = 350.0

public enum class TouchIntent { Wait, Brush, Scroll }

/**
 * What a touch that went down at (`fromX`, `fromY`) means once it is at (`toX`, `toY`) after [elapsed] ms. Moving more than a few
 * pixels before the long-press delay is a scroll (the brush never starts); holding still past the delay arms the brush. The clock
 * is the caller's: this takes elapsed time, never reads one.
 */
public fun touchIntent(
    fromX: Double,
    fromY: Double,
    toX: Double,
    toY: Double,
    elapsed: Double,
    delay: Double = TOUCH_BRUSH_DELAY,
    slop: Double = 10.0,
): TouchIntent =
    when {
        elapsed >= delay -> TouchIntent.Brush
        hypot(toX - fromX, toY - fromY) > slop -> TouchIntent.Scroll
        else -> TouchIntent.Wait
    }

/** Inclusive window over category indices. */
public class IndexRange(
    public val from: Int,
    public val to: Int,
)

public sealed interface IndexDrag {
    public data object Start : IndexDrag

    public data object End : IndexDrag

    public class Move(
        public val offset: Int,
    ) : IndexDrag

    public class New(
        public val anchor: Int,
    ) : IndexDrag
}

private const val MIN_SPAN = 1

/** Orders and clamps a window to `0..count-1`, never narrower than one step. */
public fun clampIndexRange(
    a: Int,
    b: Int,
    count: Int,
): IndexRange {
    val lo = max(0, min(a, b))
    val hi = min(count - 1, max(a, b))
    if (hi - lo >= MIN_SPAN) return IndexRange(lo, hi)
    return if (lo + MIN_SPAN <= count - 1) IndexRange(lo, lo + MIN_SPAN) else IndexRange(max(0, hi - MIN_SPAN), hi)
}

/**
 * What a pointer press at pixel [x] grabs: the start or end handle (within [slop] pixels), the window body, or empty track (draws a
 * new window). [x0] and [x1] are the handle pixels.
 */
public fun pickIndexDrag(
    x: Double,
    x0: Double,
    x1: Double,
    indexAt: (Double) -> Int,
    start: Int,
    slop: Double = 10.0,
): IndexDrag =
    when {
        abs(x - x0) <= slop -> IndexDrag.Start
        abs(x - x1) <= slop -> IndexDrag.End
        x > x0 && x < x1 -> IndexDrag.Move(indexAt(x) - start)
        else -> IndexDrag.New(indexAt(x))
    }

/** The window after dragging [mode] to [index], or null when it did not change. */
public fun dragIndexRange(
    mode: IndexDrag,
    index: Int,
    range: IndexRange,
    count: Int,
): IndexRange? =
    when (mode) {
        IndexDrag.Start -> clampIndexRange(min(index, range.to - MIN_SPAN), range.to, count)
        IndexDrag.End -> clampIndexRange(range.from, max(index, range.from + MIN_SPAN), count)
        is IndexDrag.New -> clampIndexRange(mode.anchor, index, count)
        is IndexDrag.Move -> {
            val span = range.to - range.from
            val lo = min(max(0, index - mode.offset), count - 1 - span)
            if (lo == range.from) null else IndexRange(lo, lo + span)
        }
    }

public enum class IndexKey { Left, Right, Up, Down, Home, End }

/** Keyboard step: arrows pan the window by one index, [grow] resizes its end instead, Home and End jump it to the ends. */
public fun stepIndexRange(
    range: IndexRange,
    key: IndexKey,
    grow: Boolean,
    count: Int,
): IndexRange {
    val span = range.to - range.from

    fun by(delta: Int): IndexRange {
        if (grow) return clampIndexRange(range.from, max(range.from + MIN_SPAN, range.to + delta), count)
        val lo = min(max(0, range.from + delta), count - 1 - span)
        return IndexRange(lo, lo + span)
    }
    return when (key) {
        IndexKey.Right, IndexKey.Up -> by(1)
        IndexKey.Left, IndexKey.Down -> by(-1)
        IndexKey.Home -> IndexRange(0, span)
        IndexKey.End -> IndexRange(count - 1 - span, count - 1)
    }
}
