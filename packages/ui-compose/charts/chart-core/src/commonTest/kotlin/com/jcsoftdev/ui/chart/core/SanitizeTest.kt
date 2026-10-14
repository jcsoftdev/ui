package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The boundary rules the web charts lack: NaN and Infinity never become a coordinate, and bad input never loops or throws. */
class SanitizeTest {
    private val nan = Double.NaN
    private val inf = Double.POSITIVE_INFINITY

    @Test fun scalesMapNonFiniteToNaNNeverToAnInfiniteCoordinate() {
        val scales =
            listOf(
                linearScale(0.0, 100.0, 0.0, 200.0),
                logScale(1.0, 1000.0, 0.0, 200.0),
                timeScale(0.0, 86_400_000.0 * 10, 0.0, 200.0, ChartLocales.forTag("en-US"), "UTC"),
            )
        for (scale in scales) {
            for (bad in doubleArrayOf(nan, inf, -inf)) {
                val mapped = scale.map(bad)
                assertTrue(mapped.isNaN() || (scale.type == ScaleType.Log && mapped.isFinite()), "${scale.type} map($bad) = $mapped")
                assertTrue(scale.invert(bad).isNaN(), "${scale.type} invert($bad)")
            }
        }
    }

    @Test fun scalesWithANonFiniteDomainFallBackToAUsableOne() {
        val scale = linearScale(nan, inf, nan, 100.0)
        assertTrue(scale.domain.first.isFinite() && scale.domain.second.isFinite())
        assertTrue(scale.map(0.5).isFinite())
        assertEquals(0, linearTicks(0.0, inf).size, "an infinite tick span yields no ticks instead of looping")
        assertEquals(0, linearTicks(nan, 1.0).size)
        val time = timeScale(nan, nan, 0.0, 100.0, ChartLocales.forTag("en-US"), "UTC")
        assertTrue(time.domain.first.isFinite() && time.domain.second > time.domain.first)
        assertEquals(0, timeTicks(nan, 1.0, ChartLocales.forTag("en-US"), "UTC").size)
    }

    @Test fun bandAndPointScalesHandleEmptySingleAndBadPixels() {
        for (scale in listOf(bandScale(0, 0.0, 100.0), pointScale(0, 0.0, 100.0))) assertEquals(-1, scale.indexAt(10.0))
        assertEquals(0, pointScale(1, 0.0, 100.0).indexAt(99.0))
        assertEquals(50.0, pointScale(1, 0.0, 100.0).center(0))
        assertEquals(-1, bandScale(5, 0.0, 100.0).indexAt(nan))
        assertEquals(4, bandScale(5, 0.0, 100.0).indexAt(inf.coerceAtMost(1e300)))
    }

    @Test fun nearestSearchesAgreeAndRejectBadInput() {
        val xs = doubleArrayOf(0.0, 10.0, 10.0, 25.0, 100.0)
        for (x in doubleArrayOf(-5.0, 0.0, 4.9, 5.0, 5.1, 10.0, 17.5, 17.6, 99.0, 1e9)) {
            assertEquals(nearestIndex(xs, x), nearestSortedIndex(xs, x), "x = $x")
        }
        assertEquals(0, nearestSortedIndex(xs, 5.0), "a tie goes to the lower index")
        assertEquals(-1, nearestSortedIndex(DoubleArray(0), 1.0))
        assertEquals(-1, nearestSortedIndex(xs, nan))
        assertEquals(1, nearestIndex(doubleArrayOf(nan, 3.0, 9.0), 4.0), "NaN entries are skipped")
    }

    @Test fun formattersNeverPrintNaNOrInfinity() {
        val locale = ChartLocales.forTag("en-US")
        for (bad in doubleArrayOf(nan, inf, -inf)) {
            assertEquals(NON_FINITE_LABEL, formatNumber(bad, locale))
            assertEquals(NON_FINITE_LABEL, formatPercent(bad, locale))
            assertEquals(NON_FINITE_LABEL, formatCompact(bad, locale))
            assertEquals(NON_FINITE_LABEL, formatCurrency(bad, "USD", locale))
        }
        assertEquals("", formatDate(nan, locale, "UTC"))
    }

    @Test fun anEmptyCurrencyIsAPlainNumberAndNeverGuessed() {
        val locale = ChartLocales.forTag("en-US")
        assertEquals("1,234.50", formatCurrency(1234.5, null, locale))
        assertEquals("1,234.50", formatCurrency(1234.5, "", locale))
    }

    @Test fun aNegativeThatRoundsToZeroHasNoSign() {
        val locale = ChartLocales.forTag("en-US")
        assertEquals("0", formatNumber(-0.001, locale))
        assertEquals("0", formatNumber(-0.0, locale))
    }

    @Test fun timeAxisIgnoresNonFiniteTimes() {
        val locale = ChartLocales.forTag("en-US")
        val day = 86_400_000.0
        val axis = timeCategoryAxis(doubleArrayOf(0.0, nan, day * 2, inf, day * 4), 400.0, locale, "UTC")
        assertTrue(axis.positions[1].isNaN() && axis.positions[3].isNaN())
        assertEquals(2, axis.indexAt(abs(axis.positions[2]) + 1))
        assertContentEquals(listOf(0, 2, 4), (0..4).filter { axis.positions[it].isFinite() })
        assertEquals(-1, timeCategoryAxis(DoubleArray(0), 400.0, locale, "UTC").indexAt(10.0))
        assertEquals(-1, timeCategoryAxis(doubleArrayOf(nan), 400.0, locale, "UTC").indexAt(10.0))
    }
}
