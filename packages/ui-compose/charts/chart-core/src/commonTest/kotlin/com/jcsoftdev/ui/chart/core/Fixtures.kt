package com.jcsoftdev.ui.chart.core

import com.jcsoftdev.ui.chart.testing.FixtureJson
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Text of `fixtures/<name>.json`, generated from the React math by `pnpm chart:fixtures`; decoded by chart-testing FixtureJson. */
internal expect fun readFixture(name: String): String

internal typealias JsonObject = Map<String, Any?>

@Suppress("UNCHECKED_CAST")
internal fun fixture(name: String): JsonObject = FixtureJson.parse(readFixture(name)) as JsonObject

@Suppress("UNCHECKED_CAST")
internal fun Any?.obj(): JsonObject = this as JsonObject

@Suppress("UNCHECKED_CAST")
internal fun Any?.list(): List<Any?> = this as List<Any?>

internal fun Any?.str(): String = this as String

internal fun Any?.int(): Int = num().toInt()

internal fun Any?.bool(): Boolean = this as Boolean

/** A fixture number; the shared decoder already turned the tagged non-finite values and -0 into doubles. Null is NaN. */
internal fun Any?.num(): Double =
    when (this) {
        null -> Double.NaN
        is Double -> this
        else -> error("not a number: $this")
    }

internal fun Any?.doubles(): DoubleArray = list().let { items -> DoubleArray(items.size) { items[it].num() } }

internal fun JsonObject.getObj(key: String): JsonObject = getValue(key).obj()

internal fun JsonObject.getList(key: String): List<Any?> = getValue(key).list()

internal fun JsonObject.getNum(key: String): Double = getValue(key).num()

internal fun JsonObject.getStr(key: String): String = getValue(key).str()

/** Tight parity tolerance: relative 1e-9 with a tiny absolute floor for values that should be zero. */
internal const val TIGHT = 1e-9

internal fun assertClose(
    expected: Double,
    actual: Double,
    tolerance: Double = TIGHT,
    message: String = "",
) {
    if (expected.isNaN() || actual.isNaN()) {
        assertTrue(expected.isNaN() && actual.isNaN(), "$message expected $expected but was $actual")
        return
    }
    if (expected.isInfinite() || actual.isInfinite()) {
        assertEquals(expected, actual, message)
        return
    }
    val scale = max(1.0, max(abs(expected), abs(actual)))
    assertTrue(abs(expected - actual) <= tolerance * scale, "$message expected $expected but was $actual")
}

internal fun assertCloseArray(
    expected: DoubleArray,
    actual: DoubleArray,
    tolerance: Double = TIGHT,
    message: String = "",
) {
    assertEquals(expected.size, actual.size, "$message length: expected ${expected.toList()} but was ${actual.toList()}")
    for (i in expected.indices) assertClose(expected[i], actual[i], tolerance, "$message[$i]")
}

/** A locale whose symbols, names and affixes come from a fixture, so shared-code output is compared without platform ICU noise. */
internal class FixtureLocale(
    override val tag: String,
    override val decimalSeparator: String,
    override val groupSeparator: String,
    override val minusSign: String,
    private val percent: String,
    private val currencies: Map<String, String>,
    private val months: List<String>,
    private val weekdays: List<String>,
) : ChartLocale {
    private val offsets = ChartLocales.forTag("en-US")

    override fun styleSample(
        style: NumberStyle,
        currency: String?,
    ): String = if (style == NumberStyle.Percent) percent else currencies.getValue(currency!!)

    override fun monthShort(month: Int): String = months[month]

    override fun weekdayShort(day: Int): String = weekdays[day]

    override fun zoneOffsetMillis(
        timeZone: String?,
        epochMillis: Double,
    ): Double = offsets.zoneOffsetMillis(timeZone, epochMillis)
}

internal fun fixtureLocale(tag: String): FixtureLocale {
    val symbols = fixture("format").getObj("symbols").getObj(tag)
    val names = fixture("time").getObj("names").getObj(tag)
    return FixtureLocale(
        tag,
        symbols.getStr("decimal"),
        symbols.getStr("group"),
        symbols.getStr("minus"),
        symbols.getStr("percent"),
        symbols.getObj("currency").mapValues { it.value.str() },
        names.getList("months").map { it.str() },
        names.getList("weekdays").map { it.str() },
    )
}
