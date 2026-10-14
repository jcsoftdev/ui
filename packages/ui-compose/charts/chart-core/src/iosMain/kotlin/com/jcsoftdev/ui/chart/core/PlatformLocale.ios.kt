package com.jcsoftdev.ui.chart.core

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
) : ChartLocale {
    private val decimal =
        NSNumberFormatter().also {
            it.locale = locale
            it.numberStyle = NSNumberFormatterDecimalStyle
        }
    private val dates = NSDateFormatter().also { it.locale = locale }
    override val tag: String = locale.localeIdentifier.replace('_', '-')
    override val decimalSeparator: String = decimal.decimalSeparator
    override val groupSeparator: String = decimal.groupingSeparator
    override val minusSign: String = decimal.minusSign

    override fun styleSample(
        style: NumberStyle,
        currency: String?,
    ): String {
        val format = NSNumberFormatter()
        format.locale = locale
        format.numberStyle = if (style == NumberStyle.Currency) NSNumberFormatterCurrencyStyle else NSNumberFormatterPercentStyle
        if (currency != null) format.currencyCode = currency
        format.minimumFractionDigits = 0u
        format.maximumFractionDigits = 0u
        return format.stringFromNumber(NSNumber(double = 1.0)) ?: ""
    }

    override fun monthShort(month: Int): String = dates.shortStandaloneMonthSymbols[month] as String

    override fun weekdayShort(day: Int): String = dates.shortWeekdaySymbols[day] as String

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
