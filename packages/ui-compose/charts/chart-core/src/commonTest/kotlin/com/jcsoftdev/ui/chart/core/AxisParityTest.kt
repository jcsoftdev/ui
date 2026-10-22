package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals

/** Tick thinning, value ticks and category axes against the React math. */
class AxisParityTest {
    private val data = fixture("axis")

    /** `String(number)` on the web: whole numbers without ".0". */
    private fun jsString(value: Double): String =
        if (value == kotlin.math.floor(value) &&
            kotlin.math.abs(value) < 1e15
        ) {
            value.toLong().toString()
        } else {
            value.toString()
        }

    private fun assertTicks(
        expected: List<Any?>,
        actual: List<AxisTick>,
        message: String,
    ) {
        assertEquals(expected.size, actual.size, "tick count $message")
        expected.forEachIndexed { i, tick ->
            val t = tick.obj()
            assertClose(t.getNum("key"), actual[i].key, message = "key $i $message")
            assertClose(t.getNum("position"), actual[i].position, message = "position $i $message")
            assertEquals(t.getStr("label"), actual[i].label, "label $i $message")
        }
    }

    @Test fun thinTicksKeepsAnEvenRhythm() {
        for (case in data.getList("thin")) {
            val c = case.obj()
            val ticks = c.getList("ticks").map { AxisTick(it.obj().getNum("key"), it.obj().getNum("position"), it.obj().getStr("label")) }
            val kept = thinTicks(ticks, c.getNum("gap")).map { it.key.toInt() }
            assertEquals(c.getList("kept").map { it.int() }, kept, "gap ${c.getNum("gap")} over ${ticks.map { it.label }}")
        }
    }

    @Test fun valueTicksStayInsideTheDomain() {
        for (case in data.getList("valueTicks")) {
            val c = case.obj()
            val domain = c.getValue("domain").doubles()
            val scale = linearScale(domain[0], domain[1], 300.0, 0.0, nice = false)
            val ticks = valueTicks(scale, c.getValue("count").int()) { jsString(it) }
            assertTicks(c.getList("ticks"), ticks, "domain ${domain.toList()}")
        }
    }

    @Test fun pointAndBandCategoryAxes() {
        for (case in data.getList("category")) {
            val c = case.obj()
            val labels = c.getList("labels").map { it.str() }
            val mode = if (c.getStr("mode") == "band") CategoryAxisMode.Band else CategoryAxisMode.Point
            val options = c.getObj("options")
            val width = c.getNum("width")
            val axis =
                if (mode == CategoryAxisMode.Band) {
                    categoryAxis(labels, width, mode, options.getNum("paddingInner"), options.getNum("padding"))
                } else {
                    categoryAxis(labels, width, mode)
                }
            val label = "${c.getStr("mode")} ${labels.size} labels at $width"
            assertEquals(mode, axis.mode)
            assertCloseArray(c.getValue("positions").doubles(), axis.positions, message = "positions $label")
            assertClose(c.getNum("step"), axis.step, message = "step $label")
            assertClose(c.getNum("bandwidth"), axis.bandwidth, message = "bandwidth $label")
            assertTicks(c.getList("ticks"), axis.ticks, label)
            for (probe in c.getList(
                "indexAt",
            )) {
                assertEquals(probe.list()[1].int(), axis.indexAt(probe.list()[0].num()), "indexAt ${probe.list()[0]} $label")
            }
        }
    }

    @Test fun timeCategoryAxes() {
        val locale = fixtureLocale("es-PE")
        for (case in data.getList("dated")) {
            val c = case.obj()
            val zone = c.getStr("timeZone")
            val axis = timeCategoryAxis(c.getValue("times").doubles(), c.getNum("width"), locale, zone)
            val label = "${c.getStr("name")} in $zone"
            assertEquals(CategoryAxisMode.Time, axis.mode)
            assertCloseArray(c.getValue("positions").doubles(), axis.positions, message = "positions $label")
            assertClose(c.getNum("step"), axis.step, message = "step $label")
            assertClose(c.getNum("bandwidth"), axis.bandwidth, message = "bandwidth $label")
            assertTicks(c.getList("ticks"), axis.ticks, label)
            for (probe in c.getList(
                "indexAt",
            )) {
                assertEquals(probe.list()[1].int(), axis.indexAt(probe.list()[0].num()), "indexAt ${probe.list()[0]} $label")
            }
        }
    }
}
