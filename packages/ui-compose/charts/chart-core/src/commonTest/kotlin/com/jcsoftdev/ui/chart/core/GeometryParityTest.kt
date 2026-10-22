package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Path, downsampling and stacking against the React math. */
class GeometryParityTest {
    private fun curve(name: String): Curve =
        when (name) {
            "linear" -> Curve.Linear
            "smooth" -> Curve.Smooth
            "step" -> Curve.Step
            "step-before" -> Curve.StepBefore
            else -> Curve.StepAfter
        }

    @Test fun linePathsMatchTheWebSvgByteForByte() {
        for (case in fixture("path").getList("lines")) {
            val c = case.obj()
            val path = linePath(c.getValue("xs").doubles(), c.getValue("ys").doubles(), curve(c.getStr("curve")))
            assertEquals(c.getStr("svg"), path.toSvg(), "${c.getStr("name")} ${c.getStr("curve")}")
        }
    }

    @Test fun areaPathsMatchTheWebSvgByteForByte() {
        for (case in fixture("path").getList("areas")) {
            val c = case.obj()
            val xs = c.getValue("xs").doubles()
            val path = areaPath(xs, c.getValue("ys").doubles(), xs, DoubleArray(xs.size) { c.getNum("base") }, curve(c.getStr("curve")))
            assertEquals(c.getStr("svg"), path.toSvg(), "${c.getStr("name")} ${c.getStr("curve")}")
        }
    }

    @Test fun monotoneTangents() {
        for (case in fixture("path").getList("tangents")) {
            val c = case.obj()
            assertCloseArray(
                c.getValue("tangents").doubles(),
                monotoneTangents(c.getValue("xs").doubles(), c.getValue("ys").doubles()),
                message = c.getStr("name"),
            )
        }
    }

    @Test fun barAndRoundedRectPaths() {
        for (case in fixture("path").getList("bars")) {
            val c = case.obj()
            val end = BarEnd.valueOf(c.getStr("end").replaceFirstChar { it.uppercase() })
            val svg = barPath(c.getNum("x"), c.getNum("y"), c.getNum("w"), c.getNum("h"), c.getNum("r"), end).toSvg()
            assertEquals(c.getStr("svg"), svg, "bar ${c.getStr("end")} ${c.getNum("x")}")
        }
        for (case in fixture("path").getList("rounded")) {
            val c = case.obj()
            val r = c.getObj("radii")
            val svg =
                roundedRectPath(
                    c.getNum("x"),
                    c.getNum("y"),
                    c.getNum("w"),
                    c.getNum("h"),
                    r.getNum("tl"),
                    r.getNum("tr"),
                    r.getNum("br"),
                    r.getNum("bl"),
                ).toSvg()
            assertEquals(c.getStr("svg"), svg)
        }
    }

    /** The same Lehmer random walk as the fixture generator, so a million points need no fixture of their own. */
    private fun walk(
        seed: Long,
        n: Int,
    ): DoubleArray {
        var s = seed
        var y = 0.0
        return DoubleArray(n) {
            s = s * 16807 % 2147483647
            y += s / 2147483647.0 - 0.5
            y
        }
    }

    @Test fun lttbMatchesIncludingNonFiniteInput() {
        for (case in fixture("downsample").getList("lttb")) {
            val c = case.obj()
            val ys = c.getValue("ys").doubles()
            val xs = c["xs"]?.doubles() ?: DoubleArray(ys.size) { it.toDouble() }
            val actual = lttbIndices(xs, ys, c.getValue("threshold").int())
            assertContentEquals(
                c.getList("indices").map { it.int() }.toIntArray(),
                actual,
                "n=${ys.size} threshold=${c.getValue("threshold")}",
            )
        }
    }

    @Test fun lttbOverAMillionPoints() {
        for (case in fixture("downsample").getList("million")) {
            val c = case.obj()
            val ys = walk(c.getNum("seed").toLong(), c.getValue("n").int())
            val xs = DoubleArray(ys.size) { it.toDouble() }
            val actual = lttbIndices(xs, ys, c.getValue("threshold").int())
            assertContentEquals(c.getList("indices").map { it.int() }.toIntArray(), actual, "million, threshold ${c.getValue("threshold")}")
        }
    }

    @Test fun sharedSampleIndicesAlignSeriesAndKeepGapNeighbours() {
        for (case in fixture("downsample").getList("shared")) {
            val c = case.obj()
            val series = c.getList("series").map { it.doubles() }.toTypedArray()
            val actual = sharedSampleIndices(series, c.getValue("threshold").int())
            val expected = c.getValue("indices")
            if (expected ==
                null
            ) {
                assertNull(actual)
            } else {
                assertContentEquals(expected.list().map { it.int() }.toIntArray(), actual, "count ${c.getValue("count")}")
            }
        }
    }

    @Test fun stackLayers() {
        for (case in fixture("stack").getList("cases")) {
            val c = case.obj()
            val mode = if (c.getStr("mode") == "percent") StackMode.Percent else StackMode.Normal
            val layers = stackLayers(c.getList("series").map { it.doubles() }.toTypedArray(), mode)
            val expected = c.getList("layers")
            assertEquals(expected.size, layers.size, "layers of ${c.getStr("name")}")
            expected.forEachIndexed { i, layer ->
                val l = layer.obj()
                val label = "${c.getStr("name")} ${c.getStr("mode")} layer $i"
                assertCloseArray(l.getValue("y0").doubles(), layers[i].y0, message = "y0 $label")
                assertCloseArray(l.getValue("y1").doubles(), layers[i].y1, message = "y1 $label")
                assertCloseArray(l.getValue("values").doubles(), layers[i].values, message = "values $label")
            }
        }
    }

    @Test fun pathsNeverCarryNonFiniteCoordinates() {
        val svg =
            linePath(
                doubleArrayOf(0.0, 1.0, Double.NaN, 3.0, 4.0),
                doubleArrayOf(1.0, Double.POSITIVE_INFINITY, 2.0, 3.0, 4.0),
            ).toSvg()
        assertEquals("M0,1M3,3L4,4", svg)
        assertTrue(!svg.contains("NaN") && !svg.contains("Infinity"))
        assertTrue(linePath(DoubleArray(0), DoubleArray(0)).isEmpty)
        assertTrue(roundedRectPath(Double.NaN, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0).isEmpty)
    }

    @Test fun minMaxKeepsEverySpikeWithinABoundedBudget() {
        val n = 1_000_000
        val xs = DoubleArray(n) { it.toDouble() }
        val ys = DoubleArray(n) { if (it % 100_000 == 7) 1e6 else (it % 13).toDouble() }
        val picked = minMaxIndices(xs, ys, 0.0, n.toDouble(), 800)
        assertTrue(picked.size <= 800 * 4, "at most four points per column, got ${picked.size}")
        for (spike in 0 until 10) assertTrue(picked.contains(spike * 100_000 + 7), "spike $spike survives")
        for (i in 1 until picked.size) assertTrue(picked[i] > picked[i - 1], "ascending and unique")
        assertEquals(0, picked.first())
        assertEquals(n - 1, picked.last())
    }

    @Test fun minMaxKeepsGapsAndHandlesEmptyInput() {
        val xs = doubleArrayOf(0.0, 1.0, 2.0, 3.0, 4.0, 5.0)
        val ys = doubleArrayOf(1.0, 2.0, Double.NaN, Double.NaN, 5.0, 6.0)
        assertContentEquals(intArrayOf(0, 1, 4, 5), minMaxIndices(xs, ys, 0.0, 6.0, 6))
        assertEquals(0, minMaxIndices(DoubleArray(0), DoubleArray(0), 0.0, 1.0, 10).size)
        assertEquals(0, minMaxIndices(xs, ys, 5.0, 5.0, 10).size)
        assertEquals(0, minMaxIndices(xs, ys, 0.0, 6.0, 0).size)
    }
}
