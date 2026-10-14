package com.jcsoftdev.ui.chart.core

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.Instant
import java.time.Month
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Currency
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

// Shared by the jvm and android source sets: both read the JDK's CLDR locale data (java.text and java.time are in Android API 26+).
internal actual fun createPlatformLocale(tag: String?): ChartLocale =
    JdkChartLocale(
        if (tag ==
            null
        ) {
            Locale.getDefault()
        } else {
            Locale.forLanguageTag(tag)
        },
    )

private class JdkChartLocale(
    private val locale: Locale,
) : ChartLocale() {
    private val symbols = DecimalFormatSymbols.getInstance(locale)
    private val zones = ConcurrentHashMap<String, ZoneId>()
    override val tag: String = locale.toLanguageTag()
    override val decimalSeparator: String = symbols.decimalSeparator.toString()
    override val groupSeparator: String = symbols.groupingSeparator.toString()
    override val minusSign: String = symbols.minusSign.toString()
    override val zeroDigit: Char = symbols.zeroDigit
    override val groupingSize: Int = (NumberFormat.getInstance(locale) as? DecimalFormat)?.groupingSize?.takeIf { it > 0 } ?: 3

    // DecimalFormat keeps one group size; CLDR's Indian numbering ("12,34,567") is the only secondary size in use, so it is named here.
    override val secondaryGroupingSize: Int = if (locale.country == "IN" && groupingSize == 3) 2 else groupingSize

    override fun styleSample(
        style: NumberStyle,
        currency: String?,
        negative: Boolean,
    ): String {
        val format =
            when (style) {
                NumberStyle.Decimal -> NumberFormat.getNumberInstance(locale)
                NumberStyle.Currency -> NumberFormat.getCurrencyInstance(locale).also { it.currency = Currency.getInstance(currency) }
                NumberStyle.Percent -> NumberFormat.getPercentInstance(locale)
            }
        format.minimumFractionDigits = 0
        format.maximumFractionDigits = 0
        return format.format(if (negative) -1 else 1)
    }

    override fun monthShort(month: Int): String = Month.of(month + 1).getDisplayName(TextStyle.SHORT_STANDALONE, locale)

    override fun weekdayShort(day: Int): String = DayOfWeek.of(if (day == 0) 7 else day).getDisplayName(TextStyle.SHORT_STANDALONE, locale)

    override fun zoneOffsetMillis(
        timeZone: String?,
        epochMillis: Double,
    ): Double {
        val zone = if (timeZone == null) ZoneId.systemDefault() else zones.getOrPut(timeZone) { ZoneId.of(timeZone) }
        return zone.rules.getOffset(Instant.ofEpochMilli(epochMillis.toLong())).totalSeconds * 1000.0
    }
}

internal actual fun concurrentCache(): MutableMap<String, Affixes> = ConcurrentHashMap()
