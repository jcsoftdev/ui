package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals

/** Spatial index and box hit testing against the React math. */
class HitTestParityTest {
    private val data = fixture("hit-test")

    /** The fixture generator's Lehmer stream, so point sets need no fixture of their own. */
    private class Stream(
        private var s: Long,
    ) {
        fun next(): Double {
            s = s * 16807 % 2147483647
            return s / 2147483647.0
        }

        fun between(
            lo: Double,
            hi: Double,
        ): Double = lo + next() * (hi - lo)
    }

    @Test fun pointIndexMatchesTheWebNearest() {
        for (case in data.getList("points")) {
            val c = case.obj()
            val n = c.getValue("n").int()
            val stream = Stream(c.getNum("seed").toLong())
            val bubbles = c.getValue("bubbles").bool()
            val xs = DoubleArray(n)
            val ys = DoubleArray(n)
            val rs = DoubleArray(n)
            for (i in 0 until n) {
                xs[i] = stream.between(-50.0, 800.0)
                ys[i] = stream.between(-20.0, 400.0)
                if (bubbles) rs[i] = stream.between(0.0, 12.0)
            }
            val index = PointIndex(xs, ys, if (bubbles) rs else null, c.getNum("cell"))
            val picks = doubleArrayOf(4.0, 12.0, 16.0, 40.0)
            for (q in 0 until 150) {
                val x = stream.between(-80.0, 830.0)
                val y = stream.between(-50.0, 430.0)
                val r = picks[(stream.next() * 4).toInt()]
                val expected = c.getList("queries")[q].obj()
                assertEquals(expected.getValue("index").int(), index.nearest(x, y, r), "seed ${c.getNum("seed")} query $q at ($x, $y) r=$r")
            }
        }
    }

    @Test fun boxAtMatchesTheWebWithLaterBoxesWinningTies() {
        for (case in data.getList("boxes")) {
            val c = case.obj()
            val count = c.getValue("count").int()
            val items = c.getList("items").map { it.obj() }
            val x0 = DoubleArray(count) { items[it].getNum("x0") }
            val y0 = DoubleArray(count) { items[it].getNum("y0") }
            val x1 = DoubleArray(count) { items[it].getNum("x1") }
            val y1 = DoubleArray(count) { items[it].getNum("y1") }
            for ((q, query) in c.getList("queries").withIndex()) {
                val e = query.obj()
                assertEquals(
                    e.getValue("index").int(),
                    boxAt(x0, y0, x1, y1, e.getNum("x"), e.getNum("y"), e.getNum("r")),
                    "boxes=$count query $q",
                )
            }
        }
    }

    @Test fun pointIndexIgnoresNonFinitePointsAndQueries() {
        val index = PointIndex(doubleArrayOf(1.0, Double.NaN, 5.0, Double.POSITIVE_INFINITY), doubleArrayOf(1.0, 2.0, Double.NaN, 3.0))
        assertEquals(0, index.nearest(2.0, 2.0))
        assertEquals(-1, index.nearest(Double.NaN, 2.0))
        assertEquals(-1, index.nearest(500.0, 500.0))
        assertEquals(-1, PointIndex(DoubleArray(0), DoubleArray(0)).nearest(0.0, 0.0))
        assertEquals(-1, PointIndex(doubleArrayOf(Double.NaN), doubleArrayOf(Double.NaN)).nearest(0.0, 0.0))
    }

    @Test fun aSpreadOutIndexStaysSmall() {
        val index = PointIndex(doubleArrayOf(-1e9, 1e9), doubleArrayOf(-1e9, 1e9))
        assertEquals(1, index.nearest(1e9, 1e9, 5.0))
    }

    @Test fun selectionSurvivesReorderByKeyAndDropsWhenTheKeyDisappears() {
        val before = listOf("a", "b", "c")
        val after = listOf("c", "a", "z")
        assertEquals(1, indexOfKey(before, "b"))
        assertEquals(2, indexOfKey(after, "z"))
        assertEquals("a", retainKey(after, "a"))
        assertEquals(null, retainKey(after, "b"))
        assertEquals(-1, indexOfKey(after, null))
    }
}
