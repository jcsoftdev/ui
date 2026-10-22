package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals

/** Calendar ticks, date labels, time scale and range windows against the React math, with locale names taken from the fixture. */
class TimeParityTest {
    private val time = fixture("time")

    private fun unit(name: String): TimeUnit = TimeUnit.valueOf(name.replaceFirstChar { it.uppercase() })

    @Test fun calendarTicksInEveryZoneAcrossDaylightSavingChanges() {
        for (case in time.getList("ticks")) {
            val c = case.obj()
            val locale = fixtureLocale(c.getStr("locale"))
            val zone = c.getStr("zone")
            val ticks = timeTicks(c.getNum("start"), c.getNum("end"), locale, zone, c.getValue("count").int())
            val expected = c.getList("ticks")
            val label = "$zone ${c.getNum("start")}..${c.getNum("end")}"
            assertEquals(expected.size, ticks.size, "tick count $label")
            expected.forEachIndexed { i, tick ->
                val t = tick.obj()
                assertEquals(t.getNum("value"), ticks[i].value, "tick $i value $label")
                assertEquals(unit(t.getStr("unit")), ticks[i].unit, "tick $i unit $label")
                assertEquals(t.getStr("label"), ticks[i].label, "tick $i label $label")
            }
        }
    }

    @Test fun dateLabels() {
        for (case in time.getList("formats")) {
            val c = case.obj()
            val locale = fixtureLocale(c.getStr("locale"))
            val (value, zone) = c.getNum("value") to c.getStr("zone")
            assertEquals(c.getStr("text"), formatDate(value, locale, zone), "formatDate $value $zone")
            assertEquals(c.getStr("month"), shortMonth(value, locale, zone), "month")
            assertEquals(c.getStr("weekday"), shortWeekday(value, locale, zone), "weekday")
            assertEquals(c.getValue("day").int(), dayOfMonth(value, locale, zone), "day")
        }
    }

    @Test fun timeScale() {
        val c = time.getObj("scale")
        val start = 1_767_225_600_000.0
        val scale = timeScale(start, start + 30 * DAY_MS, 10.0, 410.0, fixtureLocale("es-PE"), "UTC")
        assertCloseArray(c.getValue("domain").doubles(), doubleArrayOf(scale.domain.first, scale.domain.second))
        for (probe in c.getList("map")) assertClose(probe.list()[1].num(), scale.map(probe.list()[0].num()), message = "time map")
        for (probe in c.getList("invert")) assertClose(probe.list()[1].num(), scale.invert(probe.list()[0].num()), message = "time invert")
        val flat = timeScale(start, start, 0.0, 100.0, fixtureLocale("es-PE"), "UTC")
        assertCloseArray(c.getValue("flatDomain").doubles(), doubleArrayOf(flat.domain.first, flat.domain.second))
    }

    @Test fun shiftDateAndRangeWindow() {
        val data = fixture("time-range")
        val locale = fixtureLocale("es-PE")
        for (case in data.getList("shifts")) {
            val c = case.obj()
            val unit = TimeRangeUnit.valueOf(c.getStr("unit").replaceFirstChar { it.uppercase() })
            val actual = shiftDate(c.getNum("value"), unit, c.getValue("count").int(), locale, c.getStr("zone"))
            assertEquals(
                c.getNum("shifted"),
                actual,
                "shift ${c.getNum("value")} ${c.getStr("unit")} ${c.getValue("count")} in ${c.getStr("zone")}",
            )
        }
        val series = data.getObj("series").mapValues { it.value.doubles() }
        for (case in data.getList("windows")) {
            val c = case.obj()
            val unit = TimeRangeUnit.valueOf(c.getStr("unit").replaceFirstChar { it.uppercase() })
            val window = rangeWindow(series.getValue(c.getStr("name")), unit, c.getValue("count").int(), locale, c.getStr("zone"))
            val expected = c.getValue("window").doubles()
            val label = "${c.getStr("name")} ${c.getStr("unit")} ${c.getValue("count")} ${c.getStr("zone")}"
            assertEquals(expected[0].toInt(), window.from, "window.from $label")
            assertEquals(expected[1].toInt(), window.to, "window.to $label")
        }
    }
}
