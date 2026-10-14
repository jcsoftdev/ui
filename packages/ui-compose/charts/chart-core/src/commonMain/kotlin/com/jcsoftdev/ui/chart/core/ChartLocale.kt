package com.jcsoftdev.ui.chart.core

public enum class NumberStyle { Currency, Percent }

/**
 * The few things the chart math cannot know on its own and each platform answers from its own locale data: separators, the affixes
 * of a currency or percent, short month and weekday names and the UTC offset of a time zone. Digit rounding, grouping and compact
 * notation are shared code, so only these answers differ between ICU, NSLocale and the JDK. Nothing here defaults to a locale;
 * [ChartLocales.system] is the platform's current one.
 */
public interface ChartLocale {
    /** BCP 47 tag the locale was created for. */
    public val tag: String
    public val decimalSeparator: String
    public val groupSeparator: String
    public val minusSign: String

    /** `1` formatted as the given style with no fraction digits ("S/ 1", "100%"); the digits are split off to get the affixes. */
    public fun styleSample(
        style: NumberStyle,
        currency: String?,
    ): String

    /** Short month name, `month` in 0..11. */
    public fun monthShort(month: Int): String

    /** Short weekday name, `day` in 0..6 with 0 = Sunday. */
    public fun weekdayShort(day: Int): String

    /** Offset from UTC in milliseconds of [timeZone] (an IANA id; null is the platform's local zone) at the instant [epochMillis]. */
    public fun zoneOffsetMillis(
        timeZone: String?,
        epochMillis: Double,
    ): Double
}

public object ChartLocales {
    /** The platform's current locale, resolved once. */
    public val system: ChartLocale by lazy { createPlatformLocale(null) }

    public fun forTag(tag: String): ChartLocale = createPlatformLocale(tag)
}

internal expect fun createPlatformLocale(tag: String?): ChartLocale
