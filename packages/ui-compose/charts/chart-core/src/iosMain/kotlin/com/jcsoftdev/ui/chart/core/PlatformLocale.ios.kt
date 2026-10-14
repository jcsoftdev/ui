package com.jcsoftdev.ui.chart.core

import platform.Foundation.NSCalendar
import platform.Foundation.NSCalendarIdentifierGregorian
import platform.Foundation.NSDate
import platform.Foundation.NSDateFormatter
import platform.Foundation.NSLocale
import platform.Foundation.NSNumber
import platform.Foundation.NSNumberFormatter
import platform.Foundation.NSNumberFormatterCurrencyStyle
import platform.Foundation.NSNumberFormatterDecimalStyle
import platform.Foundation.NSNumberFormatterPercentStyle
import platform.Foundation.NSTimeZone
import platform.Foundation.currentLocale
import platform.Foundation.dateWithTimeIntervalSince1970
import platform.Foundation.localTimeZone
import platform.Foundation.localeIdentifier
import platform.Foundation.timeZoneWithName

internal actual fun createPlatformLocale(tag: String?): ChartLocale =
    IosChartLocale(
        if (tag ==
            null
        ) {
            NSLocale.currentLocale
        } else {
            NSLocale(tag)
        },
    )

private class IosChartLocale(
    private val locale: NSLocale,
) : ChartLocale() {
    private val decimal =
        NSNumberFormatter().also {
            it.locale = locale
            it.numberStyle = NSNumberFormatterDecimalStyle
        }
    private val dates =
        NSDateFormatter().also {
            it.locale = locale
            it.calendar = NSCalendar(calendarIdentifier = NSCalendarIdentifierGregorian)
        }
    override val tag: String = locale.localeIdentifier.substringBefore('@').replace('_', '-')
    override val decimalSeparator: String = decimal.decimalSeparator
    override val groupSeparator: String = decimal.groupingSeparator
    override val minusSign: String = decimal.minusSign
    override val zeroDigit: Char = (decimal.stringFromNumber(NSNumber(double = 0.0)) ?: "0").first()
    override val groupingSize: Int = decimal.groupingSize.toInt().takeIf { it > 0 } ?: 3
    override val secondaryGroupingSize: Int = decimal.secondaryGroupingSize.toInt().takeIf { it > 0 } ?: groupingSize

    override fun styleSample(
        style: NumberStyle,
        currency: String?,
        negative: Boolean,
    ): String {
        val format = NSNumberFormatter()
        format.locale = locale
        format.numberStyle =
            when (style) {
                NumberStyle.Decimal -> NSNumberFormatterDecimalStyle
                NumberStyle.Currency -> NSNumberFormatterCurrencyStyle
                NumberStyle.Percent -> NSNumberFormatterPercentStyle
            }
        if (currency != null) format.currencyCode = currency
        format.minimumFractionDigits = 0u
        format.maximumFractionDigits = 0u
        return format.stringFromNumber(NSNumber(double = if (negative) -1.0 else 1.0)) ?: ""
    }

    override fun monthShort(month: Int): String = dates.shortStandaloneMonthSymbols[month] as String

    override fun weekdayShort(day: Int): String = dates.shortStandaloneWeekdaySymbols[day] as String

    override fun zoneOffsetMillis(
        timeZone: String?,
        epochMillis: Double,
    ): Double {
        val zone =
            if (timeZone ==
                null
            ) {
                NSTimeZone.localTimeZone
            } else {
                requireNotNull(NSTimeZone.timeZoneWithName(timeZone)) { "Unknown time zone $timeZone" }
            }
        return zone.secondsFromGMTForDate(NSDate.dateWithTimeIntervalSince1970(epochMillis / 1000.0)).toDouble() * 1000.0
    }
}

internal actual fun concurrentCache(): MutableMap<String, Affixes> = HashMap()
