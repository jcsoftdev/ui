package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Palette, colour scales, brush and pan-zoom against the React math. */
class ColorBrushParityTest {
    private val color = fixture("color")
    private val brush = fixture("brush")
    private val low = ChartColor.parse("#112233")
    private val mid = ChartColor.parse("#ddeeff")
    private val high = ChartColor.parse("#aa3300")

    @Test fun sequentialAndDivergingScales() {
        for (case in color.getList("sequential")) {
            val c = case.obj()
            val strength = sequentialStrength(c.getNum("value"), c.getNum("min"), c.getNum("max"))
            assertClose(c.getNum("strength"), strength, message = "sequential strength")
            assertEquals(c.getValue("percent").int(), tintPercent(strength), "sequential percent at ${c.getNum("value")}")
        }
        for (case in color.getList("diverging")) {
            val c = case.obj()
            val stop = divergingColor(c.getNum("value"), c.getNum("min"), c.getNum("max"), c.getNum("center"), low, mid, high)
            assertClose(c.getNum("strength"), stop.strength, message = "diverging strength")
            assertEquals(c.getValue("percent").int(), tintPercent(stop.strength), "diverging percent")
            if (stop.strength > 0) {
                val t = divergingPosition(c.getNum("value"), c.getNum("min"), c.getNum("max"), c.getNum("center"))
                assertEquals(c.getStr("side"), if (t < 0) "low" else "high", "diverging side")
            }
        }
        for (case in color.getList("normalize")) {
            val c = case.obj()
            assertClose(c.getNum("result"), normalize(c.getNum("value"), c.getNum("min"), c.getNum("max")), message = "normalize")
        }
    }

    @Test fun steppedRangesAndMonochromeShades() {
        val ranges =
            listOf(
                ColorRange("neg", to = 0.0),
                ColorRange("low", 0.0, 10.0),
                ColorRange("mid", 10.0, 50.0),
                ColorRange("high", from = 50.0),
            )
        for (case in color.getList(
            "rangeIdx",
        )) {
            assertEquals(case.obj().getValue("index").int(), rangeIndex(case.obj().getNum("value"), ranges), "rangeIndex")
        }
        for (case in color.getList("rangeStrengths")) {
            val c = case.obj()
            assertClose(
                c.getNum("strength"),
                rangeStrength(c.getValue("index").int(), c.getValue("count").int()),
                message = "rangeStrength",
            )
        }
        for (case in color.getList("shades")) {
            val c = case.obj()
            assertEquals(
                c.getValue("percent").int(),
                monochromeShare(c.getValue("step").int(), c.getValue("count").int()),
                "shade ${c.getValue("step")}/${c.getValue("count")}",
            )
        }
        for (case in color.getList("byValue")) {
            val c = case.obj()
            assertContentEquals(
                c
                    .getList("percents")
                    .map {
                        it.int()
                    }.toIntArray(),
                monochromeSharesByValue(c.getValue("values").doubles()),
                "by value ${c.getValue("values")}",
            )
        }
        for (case in color.getList("direction")) {
            val c = case.obj()
            assertEquals(c.getStr("result"), directionOf(c.getNum("delta"), c.getNum("epsilon")).name.lowercase())
        }
        val expectedSlots = listOf("var(--accent-word)") + (1..7).map { "var(--chart-cat-$it)" }
        for (case in color.getList("slots")) {
            val c = case.obj()
            assertEquals(c.getStr("color"), expectedSlots[paletteSlot(c.getValue("index").int()).ordinal])
        }
        for (case in color.getList("tints")) {
            val c = case.obj()
            val text = c.getStr("text")
            val expected =
                if (text == "C") {
                    100
                } else if (text == "B") {
                    0
                } else {
                    Regex("(\\d+)%").find(text)!!.groupValues[1].toInt()
                }
            assertEquals(expected, tintPercent(c.getNum("percent")), "tint ${c.getNum("percent")}")
        }
    }

    @Test fun tintMixesInOklabLikeCssColorMix() {
        val black = ChartColor.parse("#000000")
        val white = ChartColor.parse("#ffffff")
        assertEquals("#636363", tint(white, 50.0, black).toHex(), "OKLab mid grey, as color-mix(in oklab, white, black)")
        assertEquals(white, tint(white, 100.0, black))
        assertEquals(black, tint(white, 0.0, black))
        assertEquals(
            "#808080",
            tint(ChartColor.parse("#808080"), 37.0, ChartColor.parse("#808080")).toHex(),
            "mixing a colour with itself is itself",
        )
        assertEquals(0xFF336699.toInt(), ChartColor.parse("#369").argb)
        assertEquals("#33669980", ChartColor.parse("#33669980").toHex())
    }

    @Test fun hexColoursParseStrictly() {
        for (bad in listOf("", "336699", "#12", "#1234", "#12345", "#ggg", "#33669", "url(x)", "#33669900ff", "var(--x)")) {
            assertFailsWith<IllegalArgumentException>(bad) { ChartColor.parse(bad) }
        }
    }

    private fun rect(o: Any?): BrushRect = o.obj().let { BrushRect(it.getNum("x0"), it.getNum("x1"), it.getNum("y0"), it.getNum("y1")) }

    private fun assertRect(
        expected: Any?,
        actual: BrushRect,
        message: String,
    ) {
        val e = rect(expected)
        assertClose(e.x0, actual.x0, message = "$message x0")
        assertClose(e.x1, actual.x1, message = "$message x1")
        assertClose(e.y0, actual.y0, message = "$message y0")
        assertClose(e.y1, actual.y1, message = "$message y1")
    }

    private fun range(o: Any?): NumberRange? = o?.doubles()?.let { NumberRange(it[0], it[1]) }

    private fun assertRange(
        expected: Any?,
        actual: NumberRange?,
        message: String,
    ) {
        val e = range(expected)
        if (e ==
            null
        ) {
            assertNull(actual, message)
        } else {
            assertClose(e.first, actual!!.first, message = message).also { assertClose(e.second, actual.second, message = message) }
        }
    }

    @Test fun rectangleBrush() {
        val xd = NumberRange(0.0, 100.0)
        val yd = NumberRange(-50.0, 50.0)
        for (case in brush.getList("corner")) {
            val c = case.obj()
            val r = rect(c.getValue("r"))
            assertRect(c.getValue("clamp"), clampRect(r, xd, yd), "clamp")
            val ranges = rectToRanges(r)
            assertRange(c.getObj("ranges").getValue("x"), ranges.x, "ranges.x")
            assertRange(c.getObj("ranges").getValue("y"), ranges.y, "ranges.y")
            val probes = listOf(50.0 to 0.0, r.x0 to r.y0, r.x1 + 1 to r.y1)
            assertEquals(c.getList("contains").map { it.bool() }, probes.map { r.contains(it.first, it.second) }, "contains")
        }
        for (case in brush.getList("unbounded")) {
            val c = case.obj()
            val back = rangesToRect(range(c.getValue("x")), range(c.getValue("y")))
            if (c.getValue("rect") == null) assertNull(back) else assertRect(c.getValue("rect"), back!!, "rangesToRect")
        }
        for (case in brush.getList("clicks")) {
            val c = case.obj()
            assertEquals(c.getValue("result").bool(), isClick(c.getNum("ax"), c.getNum("ay"), c.getNum("bx"), c.getNum("by")))
        }
        val keys =
            mapOf(
                "ArrowLeft" to BrushKey.Left,
                "ArrowRight" to BrushKey.Right,
                "ArrowUp" to BrushKey.Up,
                "ArrowDown" to BrushKey.Down,
            )
        for (case in brush.getList("steps")) {
            val c = case.obj()
            assertRect(
                c.getValue("result"),
                stepBrush(rect(c.getValue("rect")), keys.getValue(c.getStr("key")), c.getValue("grow").bool(), xd, yd),
                "step ${c.getStr("key")} grow=${c.getValue("grow")}",
            )
        }
        assertRect(brush.getValue("dflt"), defaultBrush(NumberRange(10.0, 50.0), NumberRange(-4.0, 4.0)), "default brush")
        for (case in brush.getList("touch")) {
            val c = case.obj()
            val actual = touchIntent(c.getNum("fx"), c.getNum("fy"), c.getNum("tx"), c.getNum("ty"), c.getNum("elapsed"))
            assertEquals(c.getStr("result"), actual.name.lowercase(), "touch at ${c.getNum("elapsed")} ms")
        }
    }

    private fun indexRange(o: Any?): IndexRange = o.doubles().let { IndexRange(it[0].toInt(), it[1].toInt()) }

    private fun assertIndexRange(
        expected: Any?,
        actual: IndexRange?,
        message: String,
    ) {
        if (expected == null) {
            assertNull(actual, message)
        } else {
            val e = indexRange(expected)
            assertEquals(e.from to e.to, actual?.let { it.from to it.to }, message)
        }
    }

    @Test fun indexWindowBrush() {
        for (case in brush.getList("clampIdx")) {
            val c = case.obj()
            assertIndexRange(
                c.getValue("result"),
                clampIndexRange(c.getValue("a").int(), c.getValue("b").int(), c.getValue("count").int()),
                "clamp ${c.getValue("a")},${c.getValue("b")}",
            )
        }
        for (case in brush.getList("picks")) {
            val c = case.obj()
            val m = c.getObj("mode")
            val actual = pickIndexDrag(c.getNum("x"), 20.0, 80.0, { kotlin.math.floor(it / 10 + 0.5).toInt() }, 2)
            val label = "pick at ${c.getNum("x")}"
            when (m.getStr("kind")) {
                "start" -> assertEquals(IndexDrag.Start, actual, label)
                "end" -> assertEquals(IndexDrag.End, actual, label)
                "move" -> assertEquals(m.getValue("offset").int(), (actual as IndexDrag.Move).offset, label)
                else -> assertEquals(m.getValue("anchor").int(), (actual as IndexDrag.New).anchor, label)
            }
        }
        for (case in brush.getList("drags")) {
            val c = case.obj()
            val m = c.getObj("mode")
            val mode =
                when (m.getStr("kind")) {
                    "start" -> IndexDrag.Start
                    "end" -> IndexDrag.End
                    "move" -> IndexDrag.Move(m.getValue("offset").int())
                    else -> IndexDrag.New(m.getValue("anchor").int())
                }
            assertIndexRange(
                c.getValue("result"),
                dragIndexRange(mode, c.getValue("index").int(), indexRange(c.getValue("range")), c.getValue("count").int()),
                "drag ${m.getStr("kind")} to ${c.getValue("index")}",
            )
        }
        val keys =
            mapOf(
                "ArrowLeft" to IndexKey.Left,
                "ArrowRight" to IndexKey.Right,
                "ArrowUp" to IndexKey.Up,
                "ArrowDown" to IndexKey.Down,
                "Home" to IndexKey.Home,
                "End" to IndexKey.End,
            )
        for (case in brush.getList("idxKeys")) {
            val c = case.obj()
            val key = keys[c.getStr("key")] ?: continue
            assertIndexRange(
                c.getValue("result"),
                stepIndexRange(indexRange(c.getValue("range")), key, c.getValue("grow").bool(), c.getValue("count").int()),
                "step ${c.getStr("key")}",
            )
        }
    }

    private fun view(o: Any?): PanZoomView = o.obj().let { PanZoomView(it.getNum("k"), it.getNum("x"), it.getNum("y")) }

    private fun assertView(
        expected: Any?,
        actual: PanZoomView,
        message: String,
    ) {
        val e = view(expected)
        assertClose(e.k, actual.k, message = "$message k")
        assertClose(e.x, actual.x, message = "$message x")
        assertClose(e.y, actual.y, message = "$message y")
    }

    @Test fun panAndZoom() {
        for (case in brush.getList("zooms")) {
            val c = case.obj()
            assertView(
                c.getValue("result"),
                zoomAround(view(c.getValue("view")), c.getNum("factor"), c.getNum("px"), c.getNum("py"), 0.1, 2.5),
                "zoom x${c.getNum("factor")}",
            )
        }
        for (case in brush.getList("fits")) {
            val c = case.obj()
            val (cw, ch, w, h) = listOf(c.getNum("cw"), c.getNum("ch"), c.getNum("w"), c.getNum("h"))
            assertView(c.getValue("result"), fitView(cw, ch, w, h), "fit $cw x $ch")
            assertView(c.getValue("loose"), fitView(cw, ch, w, h, padding = 0.0, minZoom = 0.5, maxFit = 4.0), "loose fit $cw x $ch")
        }
        for (case in brush.getList("wheel")) {
            val c = case.obj()
            assertClose(c.getNum("result"), wheelFactor(c.getNum("dy"), c.getNum("mode") == 1.0), message = "wheel")
        }
        val keys =
            mapOf(
                "ArrowLeft" to PanZoomKey.Left,
                "ArrowRight" to PanZoomKey.Right,
                "ArrowUp" to PanZoomKey.Up,
                "ArrowDown" to PanZoomKey.Down,
                "+" to PanZoomKey.ZoomIn,
                "=" to PanZoomKey.ZoomIn,
                "-" to PanZoomKey.ZoomOut,
                "_" to PanZoomKey.ZoomOut,
            )
        for (case in brush.getList("panKeys")) {
            val c = case.obj()
            val key = keys[c.getStr("key")] ?: continue
            assertView(
                c.getValue("result"),
                panZoomKey(view(c.getValue("view")), key, 600.0, 400.0, shift = c.getValue("shift").bool()),
                "key ${c.getStr("key")}",
            )
        }
        val still = PanZoomView(1.0, 5.0, 5.0)
        assertTrue(zoomAround(still, Double.NaN, 1.0, 1.0, 0.1, 2.0) === still, "a non-finite factor leaves the view alone")
    }
}
