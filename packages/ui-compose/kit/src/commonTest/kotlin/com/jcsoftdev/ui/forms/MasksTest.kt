package com.jcsoftdev.ui.forms

import androidx.compose.ui.text.AnnotatedString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MasksTest {
    @Test
    fun timeGoldenTable() {
        val table =
            mapOf(
                "0930" to "09:30",
                "930" to "09:30",
                "9:30" to "09:30",
                "09:30" to "09:30",
                "2359" to "23:59",
                "0000" to "00:00",
                "2400" to null,
                "2560" to null,
                "0960" to null,
                "09" to null,
                "" to null,
                "09305" to null,
            )
        table.forEach { (input, expected) -> assertEquals(expected, TimeFormat.normalize(input), "time $input") }
    }

    @Test
    fun timeCommitOnlyWhenComplete() {
        assertEquals("", TimeFormat.commit("093"))
        assertEquals("09:30", TimeFormat.commit("0930"))
        assertEquals("", TimeFormat.commit("2560"))
    }

    @Test
    fun timeDisplayInsertsColonProgressively() {
        assertEquals("0", TimeFormat.display("0"))
        assertEquals("09", TimeFormat.display("09"))
        assertEquals("09:3", TimeFormat.display("093"))
        assertEquals("09:30", TimeFormat.display("0930"))
    }

    @Test
    fun dateGoldenTable() {
        val table =
            mapOf(
                "09032024" to "09/03/2024",
                "09/03/2024" to "09/03/2024",
                "29022024" to "29/02/2024",
                "29022023" to null,
                "29022000" to "29/02/2000",
                "29021900" to null,
                "31042024" to null,
                "31122024" to "31/12/2024",
                "00012024" to null,
                "01132024" to null,
                "01010000" to null,
                "0903202" to null,
            )
        table.forEach { (input, expected) -> assertEquals(expected, DateFormat.normalize(input), "date $input") }
    }

    @Test
    fun digitsOnlyDropsEverythingElseAndCaps() {
        assertEquals("0930", digitsOnly("09:30", 4))
        assertEquals("0930", digitsOnly("09a30 99", 4))
        assertEquals("", digitsOnly("ab", 4))
    }

    @Test
    fun transformationMapsCursorBothWays() {
        val t = DateTransformation.filter(AnnotatedString("09032024"))
        assertEquals("09/03/2024", t.text.text)
        assertEquals(0, t.offsetMapping.originalToTransformed(0))
        assertEquals(2, t.offsetMapping.originalToTransformed(2))
        assertEquals(5, t.offsetMapping.originalToTransformed(4))
        assertEquals(10, t.offsetMapping.originalToTransformed(8))
        assertEquals(8, t.offsetMapping.transformedToOriginal(10))
        assertEquals(4, t.offsetMapping.transformedToOriginal(5))
        val time = TimeTransformation.filter(AnnotatedString("0930"))
        assertEquals("09:30", time.text.text)
        assertEquals(5, time.offsetMapping.originalToTransformed(4))
        assertEquals(4, time.offsetMapping.transformedToOriginal(5))
        assertNull(null)
    }
}
