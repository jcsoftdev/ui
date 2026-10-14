package com.jcsoftdev.ui.chart.core

/** Which affixes a platform sample describes: plain numbers ("-1"), currency ("-$1") or percent ("-100%"). */
public enum class NumberStyle { Decimal, Currency, Percent }

/**
 * The things the chart math cannot know on its own and each platform answers from its own locale data: separators, digits and
 * grouping sizes, the affixes of a plain number, currency or percent (sign and currency placement included), short month and weekday
 * names and the UTC offset of a time zone. Digit rounding, grouping and compact notation are shared code, so only these answers
 * differ between ICU, NSLocale and the JDK. Nothing here defaults to a locale; [ChartLocales.system] is the platform's current one.
 *
 * An abstract class, so a member added later does not break implementors: new members arrive with a default.
 */
public abstract class ChartLocale {
    /** BCP 47 tag the locale was created for. */
    public abstract val tag: String
    public abstract val decimalSeparator: String
    public abstract val groupSeparator: String
    public abstract val minusSign: String

    /** The digit that stands for zero ("0", or "\u0660" for ar-EG); the other nine follow it. */
    public open val zeroDigit: Char get() = '0'

    /** Size of the rightmost group of integer digits. */
    public open val groupingSize: Int get() = 3

    /** Size of every further group; 2 in the Indian numbering system ("12,34,567"). */
    public open val secondaryGroupingSize: Int get() = groupingSize

    /**
     * `1` or `-1` formatted in [style] with no fraction digits ("S/ 1", "-100%", "€ -1"). The digits are split off to get the
     * affixes, so sign and currency placement are the platform's. [currency] is an ISO code and only read for [NumberStyle.Currency].
     */
    public abstract fun styleSample(
        style: NumberStyle,
        currency: String?,
        negative: Boolean = false,
    ): String

    /** Short month name in its standalone form, `month` in 0..11. */
    public abstract fun monthShort(month: Int): String

    /** Short weekday name in its standalone form, `day` in 0..6 with 0 = Sunday. */
    public abstract fun weekdayShort(day: Int): String

    /** Offset from UTC in milliseconds of [timeZone] (an IANA id; null is the platform's local zone) at the instant [epochMillis]. */
    public abstract fun zoneOffsetMillis(
        timeZone: String?,
        epochMillis: Double,
    ): Double

    private val affixCache: MutableMap<String, Affixes> = concurrentCache()

    /** The text around the digits of a formatted number, read from the platform once per style, currency and sign. */
    internal fun affixes(
        style: NumberStyle,
        currency: String?,
        negative: Boolean,
    ): Affixes =
        affixCache.getOrPut("$style|${currency.orEmpty()}|$negative") {
            val sample = styleSample(style, currency, negative)
            val first = sample.indexOfFirst { it.isDigit() }
            val last = sample.indexOfLast { it.isDigit() }
            if (first < 0) Affixes("", sample) else Affixes(sample.substring(0, first), sample.substring(last + 1))
        }
}

internal class Affixes(
    val prefix: String,
    val suffix: String,
)

/** A map safe for concurrent readers and writers where the platform has threads (the JVM); a plain map on iOS, a UI-thread cache. */
internal expect fun concurrentCache(): MutableMap<String, Affixes>

public object ChartLocales {
    /**
     * The platform's locale as it was the first time this was read. A chart that must follow a locale change at run time passes
     * [current] or a [forTag] locale explicitly.
     */
    public val system: ChartLocale by lazy { createPlatformLocale(null) }

    /** The platform's locale right now, re-read on every call. */
    public fun current(): ChartLocale = createPlatformLocale(null)

    public fun forTag(tag: String): ChartLocale = createPlatformLocale(tag)
}

internal expect fun createPlatformLocale(tag: String?): ChartLocale
