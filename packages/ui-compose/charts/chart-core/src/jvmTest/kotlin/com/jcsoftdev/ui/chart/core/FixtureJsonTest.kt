package com.jcsoftdev.ui.chart.core

import com.jcsoftdev.ui.chart.testing.FixtureJson
import com.jcsoftdev.ui.chart.testing.FixtureResources
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Round trip of the fixture encoding: the file the JS generator wrote decodes to exactly the values it was written from. */
class FixtureJsonTest {
    @Test fun nonFiniteNumbersAndNegativeZeroSurviveTheRoundTrip() {
        val root = FixtureResources.load("encoding") as Map<*, *>
        val numbers = (root["numbers"] as List<*>).map { it as Double }
        assertTrue(numbers[0].isNaN())
        assertEquals(Double.POSITIVE_INFINITY, numbers[1])
        assertEquals(Double.NEGATIVE_INFINITY, numbers[2])
        assertEquals((-0.0).toRawBits(), numbers[3].toRawBits(), "negative zero keeps its sign bit")
        assertEquals(0.0.toRawBits(), numbers[4].toRawBits())
        assertEquals(1.5, numbers[5])
        assertEquals(-2.0, numbers[6])
    }

    @Test fun aStringThatSpellsANumberStaysAString() {
        val root = FixtureResources.load("encoding") as Map<*, *>
        assertEquals(listOf("NaN", "Infinity", "-Infinity", "-0"), root["strings"])
    }

    @Test fun taggedNumbersDecodeAtAnyDepth() {
        val nested = (FixtureResources.load("encoding") as Map<*, *>)["nested"] as Map<*, *>
        val values = nested["values"] as List<*>
        assertTrue((values[0] as Double).isNaN())
        assertEquals(Double.NEGATIVE_INFINITY, ((values[1] as Map<*, *>)["deep"]))
    }

    @Test fun theDecoderRejectsMalformedAndUnknownTags() {
        assertFailsWith<IllegalStateException> { FixtureJson.parse("""{"${'$'}f":"huge"}""") }
        assertFailsWith<IllegalArgumentException> { FixtureJson.parse("""{"${'$'}f":"NaN","x":1}""") }
        assertFailsWith<IllegalArgumentException> { FixtureJson.parse("[1] 2") }
        assertContentEquals(listOf(1.0, "a", null, true), FixtureJson.parse("""[1, "a", null, true]""") as List<*>)
    }
}
