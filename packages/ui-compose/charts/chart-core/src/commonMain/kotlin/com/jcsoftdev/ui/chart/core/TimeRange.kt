package com.jcsoftdev.ui.chart.core

import kotlin.math.max
import kotlin.math.min

public enum class TimeRangeUnit { Day, Week, Month, Year, All }

/** A range-selector preset such as "1M": [count] [unit]s back from the last date. */
public class TimeRangePreset(
    public val id: String,
    public val label: String,
    public val unit: TimeRangeUnit,
    public val count: Int = 1,
    public val description: String? = null,
)

/** [epochMillis] moved back by [count] units in [timeZone] (months clamp to the last day). A non-finite instant is returned as is. */
public fun shiftDate(
    epochMillis: Double,
    unit: TimeRangeUnit,
    count: Int,
    locale: ChartLocale,
    timeZone: String? = null,
): Double {
    if (!epochMillis.isFinite() || unit == TimeRangeUnit.All) return epochMillis
    val cal = WallCalendar(locale, timeZone)
    var next = cal.wall(epochMillis)
    when (unit) {
        TimeRangeUnit.Day -> next = cal.setDate(next, cal.date(next) - count)
        TimeRangeUnit.Week -> next = cal.setDate(next, cal.date(next) - count * 7)
        else -> {
            val months = if (unit == TimeRangeUnit.Year) count * 12 else count
            val day = cal.date(next)
            next = cal.setDate(next, 1)
            next = cal.setMonth(next, cal.month(next) - months)
            var end = cal.setMonth(next, cal.month(next) + 1)
            end = cal.setDate(end, 0)
            next = cal.setDate(next, min(day, cal.date(end)))
        }
    }
    return cal.instant(next)
}

/** Inclusive window over category indices: `from..to`. */
public class IndexWindow(
    public val from: Int,
    public val to: Int,
)

/**
 * Inclusive index window `[from, last]` for a preset over ascending [dates]: the first date on or after the last date minus the
 * preset. It spans at least two points when the data has them. A non-finite last date selects everything.
 */
public fun rangeWindow(
    dates: DoubleArray,
    unit: TimeRangeUnit,
    count: Int,
    locale: ChartLocale,
    timeZone: String? = null,
): IndexWindow {
    val last = dates.size - 1
    if (last <= 0) return IndexWindow(0, max(0, last))
    if (unit == TimeRangeUnit.All || !dates[last].isFinite()) return IndexWindow(0, last)
    val cutoff = shiftDate(dates[last], unit, count, locale, timeZone)
    var from = last
    while (from > 0 && dates[from - 1] >= cutoff) from -= 1
    return IndexWindow(min(from, last - 1), last)
}

public fun rangeWindow(
    dates: DoubleArray,
    preset: TimeRangePreset,
    locale: ChartLocale,
    timeZone: String? = null,
): IndexWindow = rangeWindow(dates, preset.unit, preset.count, locale, timeZone)
