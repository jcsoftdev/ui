package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Calendar gaps, locale tags with extensions, cached platform affixes and the locales the number formatting has to survive. */
class LocaleHardeningTest {
    private val en = ChartLocales.forTag("en-US")

    @Test fun aWallTimeInsideASpringForwardGapResolvesForward() {
        // America/Santiago jumps from 2026-09-06 00:00 to 01:00, so midnight of the 6th is 04:00Z (01:00 local), not the 5th at 23:00.
        val calendar = WallCalendar(en, "America/Santiago")
        assertEquals(1_788_667_200_000.0, calendar.instant(1_788_652_800_000.0))
        assertEquals(1_788_652_800_000.0 + 3_600_000.0, calendar.wall(calendar.instant(1_788_652_800_000.0)))
    }

    @Test fun aRepeatedWallTimeTakesItsFirstOccurrence() {
        // America/New_York repeats 2026-11-01 01:30: EDT (05:30Z) first, then EST (06:30Z).
        assertEquals(1_793_511_000_000.0, WallCalendar(en, "America/New_York").instant(1_793_496_600_000.0))
    }

    @Test fun midnightTicksAcrossTheGapStayOnTheirOwnDay() {
        val ticks = timeTicks(1_788_393_600_000.0, 1_788_912_000_000.0, en, "America/Santiago", 6)
        val calendar = WallCalendar(en, "America/Santiago")
        for (tick in ticks) {
            assertEquals(
                0.0,
                calendar.wall(tick.value) % DAY_MS -
                    if (tick.value ==
                        1_788_667_200_000.0
                    ) {
                        3_600_000.0
                    } else {
                        0.0
                    },
                "tick ${tick.label}",
            )
        }
        assertTrue(ticks.any { it.value == 1_788_667_200_000.0 }, "the 6th is present: ${ticks.map { it.label }}")
    }

    @Test fun nonFiniteInstantsGiveNoNamesOrDay() {
        assertEquals("", shortMonth(Double.NaN, en))
        assertEquals("", shortWeekday(Double.POSITIVE_INFINITY, en))
        assertEquals(-1, dayOfMonth(Double.NaN, en))
    }

    @Test fun baseTagKeepsLanguageAndRegionOnly() {
        assertEquals("es-PE", baseTag("es-PE-u-fw-mon"))
        assertEquals("es-PE", baseTag("es_PE@rg=ptzzzz"))
        assertEquals("es", baseTag("es@calendar=gregorian"))
        assertEquals("sr-RS", baseTag("sr-Latn-RS"))
        assertEquals("es", baseTag("ES"))
    }

    @Test fun localeExtensionsKeepTheNoBreakGrouping() {
        val plain = fixtureLocale("es-PE")
        val extended = Retagged(plain, "es-PE-u-fw-mon")
        val appleStyle = Retagged(plain, "es_PE@rg=pezzzz")
        assertEquals(formatNumber(1_234_567.5, plain), formatNumber(1_234_567.5, extended))
        assertEquals(formatNumber(1_234_567.5, plain), formatNumber(1_234_567.5, appleStyle))
        assertTrue('\u00A0' in formatNumber(1_234_567.5, extended), formatNumber(1_234_567.5, extended))
    }

    @Test fun platformAffixesAreReadOncePerStyleCurrencyAndSign() {
        val counting = CountingLocale(fixtureLocale("en-US"))
        repeat(50) {
            formatCurrency(it * 100.0, "USD", counting)
            formatCurrency(-it * 100.0 - 1, "USD", counting)
            formatPercent(it / 100.0, counting)
            formatNumber(it.toDouble(), counting)
        }
        // Currency +/-, percent +, decimal +: four samples, however many labels.
        assertEquals(4, counting.samples)
    }

    @Test fun indianGroupingAndArabicDigitsComeFromTheLocale() {
        assertEquals("12,34,567.5", formatNumber(1_234_567.5, fixtureLocale("en-IN")))
        assertEquals("\u0661\u066C\u0662\u0663\u0664\u066B\u0665", formatNumber(1234.5, fixtureLocale("ar-EG")))
    }

    @Test fun spanishCompactReachesTensOfThousandsOfMillions() {
        val es = fixtureLocale("es")
        assertEquals("10\u00A0mil\u00A0M", formatCompact(1e10, es))
        assertEquals("250\u00A0mil\u00A0M", formatCompact(2.5e11, es, 0))
    }

    @Test fun compactFallsBackToThePlainNumberOutsideSpanishAndEnglish() {
        assertEquals(formatNumber(12_345.0, fixtureLocale("de-CH"), 0, 1), formatCompact(12_345.0, fixtureLocale("de-CH")))
    }

    private class Retagged(
        private val inner: ChartLocale,
        override val tag: String,
    ) : ChartLocale() {
        override val decimalSeparator get() = inner.decimalSeparator
        override val groupSeparator get() = inner.groupSeparator
        override val minusSign get() = inner.minusSign

        override fun styleSample(
            style: NumberStyle,
            currency: String?,
            negative: Boolean,
        ) = inner.styleSample(style, currency, negative)

        override fun monthShort(month: Int) = inner.monthShort(month)

        override fun weekdayShort(day: Int) = inner.weekdayShort(day)

        override fun zoneOffsetMillis(
            timeZone: String?,
            epochMillis: Double,
        ) = inner.zoneOffsetMillis(timeZone, epochMillis)
    }

    private class CountingLocale(
        private val inner: ChartLocale,
    ) : ChartLocale() {
        var samples = 0
        override val tag get() = inner.tag
        override val decimalSeparator get() = inner.decimalSeparator
        override val groupSeparator get() = inner.groupSeparator
        override val minusSign get() = inner.minusSign

        override fun styleSample(
            style: NumberStyle,
            currency: String?,
            negative: Boolean,
        ): String {
            samples++
            return inner.styleSample(style, currency, negative)
        }

        override fun monthShort(month: Int) = inner.monthShort(month)

        override fun weekdayShort(day: Int) = inner.weekdayShort(day)

        override fun zoneOffsetMillis(
            timeZone: String?,
            epochMillis: Double,
        ) = inner.zoneOffsetMillis(timeZone, epochMillis)
    }
}
