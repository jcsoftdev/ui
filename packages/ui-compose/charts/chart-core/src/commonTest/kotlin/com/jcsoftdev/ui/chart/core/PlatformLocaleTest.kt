package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * What the platform contributes to formatting: separators, currency and percent affixes, month and weekday names. ICU (Android, the
 * web), NSLocale and the JDK disagree in places, so the assertions are looser than the shared-code parity tests:
 *  - separators and the minus sign must match Intl exactly for the locales the web charts use;
 *  - names match after dropping periods and case (es-PE "Set." vs "set"), by their first three letters;
 *  - affixes are compared with every kind of space removed (the JDK writes es-PE percent as "12.5 %", Intl as "12.5%"), since ICU, CLDR in the JDK and Foundation pick different spaces.
 */
class PlatformLocaleTest {
    private val fixtures = fixture("format").getObj("symbols")
    private val names = fixture("time").getObj("names")

    private fun fold(text: String): String = text.filterNot { it.isWhitespace() || it == '\u00A0' || it == '\u202F' }

    private fun letters(name: String): String = name.replace(".", "").lowercase().take(3)

    @Test fun separatorsMatchIntlForTheWebLocales() {
        for (tag in listOf("es-PE", "es", "en-US")) {
            val expected = fixtures.getObj(tag)
            val locale = ChartLocales.forTag(tag)
            assertEquals(expected.getStr("decimal"), locale.decimalSeparator, "$tag decimal")
            assertEquals(expected.getStr("minus"), locale.minusSign, "$tag minus")
            // Spanish groups with a period or comma depending on the data; the shared formatter only needs it to differ from the decimal.
            assertTrue(locale.groupSeparator != locale.decimalSeparator, "$tag group differs from decimal")
        }
        assertEquals(fixtures.getObj("en-US").getStr("group"), ChartLocales.forTag("en-US").groupSeparator)
    }

    @Test fun affixesMatchIntlUpToSpacing() {
        for (tag in listOf("es-PE", "en-US")) {
            val expected = fixtures.getObj(tag)
            val locale = ChartLocales.forTag(tag)
            assertEquals(fold(expected.getStr("percent")), fold(locale.styleSample(NumberStyle.Percent, null)), "$tag percent")
            for ((code, sample) in expected.getObj("currency")) {
                val actual = locale.styleSample(NumberStyle.Currency, code)
                // A platform may name PEN "S/" or "PEN" in en-US; the digit and the position of the symbol are what charts rely on.
                assertEquals(sample.str().first().isDigit(), actual.first().isDigit(), "$tag $code symbol side: ${sample.str()} vs $actual")
            }
        }
        assertEquals(
            "S/1",
            fold(ChartLocales.forTag("es-PE").styleSample(NumberStyle.Currency, "PEN")),
            "the Peruvian sol keeps its symbol",
        )
    }

    @Test fun monthAndWeekdayNamesMatchIntlByTheirFirstLetters() {
        for (tag in listOf("es-PE", "en-US")) {
            val expected = names.getObj(tag)
            val locale = ChartLocales.forTag(tag)
            expected.getList("months").forEachIndexed {
                month,
                name,
                ->
                assertEquals(letters(name.str()), letters(locale.monthShort(month)), "$tag month $month")
            }
            expected.getList("weekdays").forEachIndexed {
                day,
                name,
                ->
                assertEquals(letters(name.str()), letters(locale.weekdayShort(day)), "$tag weekday $day")
            }
        }
    }

    @Test fun zoneOffsetsFollowTheTimeZoneDatabase() {
        val locale = ChartLocales.forTag("en-US")
        val summer = 1_783_000_000_000.0
        val winter = 1_768_000_000_000.0
        assertEquals(0.0, locale.zoneOffsetMillis("UTC", summer))
        assertEquals(-5 * 3_600_000.0, locale.zoneOffsetMillis("America/Lima", summer))
        assertEquals(-4 * 3_600_000.0, locale.zoneOffsetMillis("America/New_York", summer))
        assertEquals(-5 * 3_600_000.0, locale.zoneOffsetMillis("America/New_York", winter))
        assertEquals(5.5 * 3_600_000.0, locale.zoneOffsetMillis("Asia/Kolkata", summer))
    }
}
