package com.jcsoftdev.ui.chart.core

import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Ticks, scales and extents against the React math (fixtures `ticks` and `scales`). */
class ScalesParityTest {
    @Test fun tickStepNiceDomainAndTicks() {
        val data = fixture("ticks")
        for (case in data.getList("cases")) {
            val c = case.obj()
            val (min, max, count) = Triple(c.getNum("min"), c.getNum("max"), c.getValue("count").int())
            val label = "[$min, $max] x $count"
            assertEquals(c.getNum("step"), tickStep(min, max, count), "step $label")
            val nice = niceDomain(min, max, count)
            val expected = c.getList("nice").doubles()
            assertEquals(expected[0], nice.first, "nice lo $label")
            assertEquals(expected[1], nice.second, "nice hi $label")
            assertEquals(c.getValue("ticks").doubles().toList(), linearTicks(min, max, count).toList(), "ticks $label")
        }
    }

    @Test fun cleanRoundsToTwelveSignificantDigits() {
        for (case in fixture("ticks").getList("clean")) {
            val c = case.obj()
            assertEquals(c.getNum("clean"), cleanNumber(c.getNum("value")), "clean ${c.getNum("value")}")
        }
    }

    @Test fun linear() {
        for (case in fixture("scales").getList("linear")) {
            val c = case.obj()
            val domain = c.getValue("domain").doubles()
            val range = c.getValue("range").doubles()
            val scale = linearScale(domain[0], domain[1], range[0], range[1], c.getValue("nice").bool(), c.getValue("tickCount").int())
            val resolved = c.getValue("resolved").doubles()
            assertClose(resolved[0], scale.domain.first, message = "domain of ${domain.toList()}")
            assertClose(resolved[1], scale.domain.second, message = "domain of ${domain.toList()}")
            for (probe in c.getList("map")) assertClose(probe.list()[1].num(), scale.map(probe.list()[0].num()), message = "map")
            for (probe in c.getList("invert")) assertClose(probe.list()[1].num(), scale.invert(probe.list()[0].num()), message = "invert")
            assertCloseArray(c.getValue("ticks").doubles(), scale.ticks(), message = "ticks")
            assertCloseArray(c.getValue("ticks7").doubles(), scale.ticks(7), message = "ticks(7)")
        }
    }

    @Test fun log() {
        for (case in fixture("scales").getList("log")) {
            val c = case.obj()
            val domain = c.getValue("domain").doubles()
            val range = c.getValue("range").doubles()
            val scale = logScale(domain[0], domain[1], range[0], range[1])
            val resolved = c.getValue("resolved").doubles()
            // A domain that starts at 0 resolves to 10^-324 = 0 on the web, where mapping 0 gives -Infinity; here it is clamped and finite.
            if (resolved[0] == 0.0) {
                assertTrue(scale.map(0.0).isFinite(), "log map(0) stays finite")
                continue
            }
            assertClose(resolved[0], scale.domain.first, message = "log domain ${domain.toList()}")
            assertClose(resolved[1], scale.domain.second, message = "log domain ${domain.toList()}")
            for (probe in c.getList(
                "map",
            )) {
                assertClose(probe.list()[1].num(), scale.map(probe.list()[0].num()), message = "log map ${probe.list()[0]}")
            }
            for (probe in c.getList(
                "invert",
            )) {
                assertClose(probe.list()[1].num(), scale.invert(probe.list()[0].num()), message = "log invert")
            }
            assertCloseArray(c.getValue("ticks").doubles(), scale.ticks(), message = "log ticks")
        }
    }

    @Test fun band() {
        for (case in fixture("scales").getList("band")) {
            val c = case.obj()
            val range = c.getValue("range").doubles()
            val count = c.getValue("count").int()
            val scale = bandScale(count, range[0], range[1], c.getNum("paddingInner"), c.getNum("paddingOuter"))
            assertClose(c.getNum("step"), scale.step, message = "band step")
            assertClose(c.getNum("bandwidth"), scale.bandwidth, message = "bandwidth")
            c.getValue("starts").doubles().forEachIndexed { i, v -> assertClose(v, scale.start(i), message = "band start $i") }
            c.getValue("centers").doubles().forEachIndexed { i, v -> assertClose(v, scale.center(i), message = "band center $i") }
            for (probe in c.getList(
                "indexAt",
            )) {
                assertEquals(probe.list()[1].int(), scale.indexAt(probe.list()[0].num()), "band indexAt ${probe.list()[0]}")
            }
        }
    }

    @Test fun point() {
        for (case in fixture("scales").getList("point")) {
            val c = case.obj()
            val range = c.getValue("range").doubles()
            val count = c.getValue("count").int()
            val scale = pointScale(count, range[0], range[1], c.getNum("padding"))
            assertClose(c.getNum("step"), scale.step, message = "point step")
            c.getValue("starts").doubles().forEachIndexed { i, v -> assertClose(v, scale.start(i), message = "point start $i") }
            c.getValue("centers").doubles().forEachIndexed { i, v -> assertClose(v, scale.center(i), message = "point center $i") }
            for (probe in c.getList(
                "indexAt",
            )) {
                assertEquals(probe.list()[1].int(), scale.indexAt(probe.list()[0].num()), "point indexAt ${probe.list()[0]}")
            }
        }
    }

    @Test fun extentSkipsNonFiniteAndCoversEmptySingleAndAMillionPoints() {
        for (case in fixture("scales").getList("extent")) {
            val c = case.obj()
            val values = c.getValue("values")?.doubles() ?: DoubleArray(c.getValue("size").int()) { sin(it * 0.001) * 1000 + (it % 977) }
            val expected = c.getValue("extent")?.doubles()
            val actual = extent(values)
            if (expected == null) {
                assertNull(actual, "no finite value")
            } else {
                assertNotNull(actual)
                assertClose(expected[0], actual.first, 1e-12, "extent min")
                assertClose(expected[1], actual.second, 1e-12, "extent max")
            }
        }
    }
}
