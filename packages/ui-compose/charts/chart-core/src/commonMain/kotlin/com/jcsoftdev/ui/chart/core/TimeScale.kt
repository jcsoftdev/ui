package com.jcsoftdev.ui.chart.core

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

public enum class TimeUnit { Day, Week, Month, Year }

public class TimeTick(
    public val value: Double,
    public val unit: TimeUnit,
    public val label: String,
)

private class Interval(
    val unit: TimeUnit,
    val every: Int,
    val approx: Double,
)

private val INTERVALS =
    listOf(
        Interval(TimeUnit.Day, 1, DAY_MS),
        Interval(TimeUnit.Day, 2, 2 * DAY_MS),
        Interval(TimeUnit.Week, 1, 7 * DAY_MS),
        Interval(TimeUnit.Week, 2, 14 * DAY_MS),
        Interval(TimeUnit.Month, 1, 30.44 * DAY_MS),
        Interval(TimeUnit.Month, 3, 91.3 * DAY_MS),
        Interval(TimeUnit.Month, 6, 182.6 * DAY_MS),
        Interval(TimeUnit.Year, 1, 365.25 * DAY_MS),
    )

private const val MAX_TIME_TICKS = 500

private fun shortName(name: String): String = name.replace(".", "").lowercase()

/** Short month without the period some locales append ("oct", not "oct."). */
public fun shortMonth(
    epochMillis: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): String {
    val cal = WallCalendar(locale, timeZone)
    return shortName(locale.monthShort(cal.month(cal.wall(epochMillis))))
}

/** Short weekday without the trailing period ("lun"). */
public fun shortWeekday(
    epochMillis: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): String {
    val cal = WallCalendar(locale, timeZone)
    return shortName(locale.weekdayShort(cal.day(cal.wall(epochMillis))))
}

/** Day of the month of [epochMillis] in [timeZone]. */
public fun dayOfMonth(
    epochMillis: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): Int {
    val cal = WallCalendar(locale, timeZone)
    return cal.date(cal.wall(epochMillis))
}

/** "lun 6 oct 2026": the full label used by tooltips and tables. A non-finite instant gives an empty string. */
public fun formatDate(
    epochMillis: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): String {
    if (!epochMillis.isFinite()) return ""
    val cal = WallCalendar(locale, timeZone)
    val wall = cal.wall(epochMillis)
    val weekday = shortName(locale.weekdayShort(cal.day(wall)))
    val month = shortName(locale.monthShort(cal.month(wall)))
    return "$weekday ${cal.date(wall)} $month ${cal.year(wall)}"
}

private fun firstTick(
    t0: Double,
    interval: Interval,
    cal: WallCalendar,
): Double {
    var d = cal.midnight(cal.wall(t0))
    if (cal.instant(d) < t0) d = cal.setDate(d, cal.date(d) + 1)
    if (interval.unit == TimeUnit.Week) {
        d = cal.setDate(d, cal.date(d) + (8 - cal.day(d)) % 7)
    } else if (interval.unit != TimeUnit.Day) {
        if (cal.date(d) != 1) {
            d = cal.setDate(d, 1)
            d = cal.setMonth(d, cal.month(d) + 1)
        }
        val every = if (interval.unit == TimeUnit.Year) 12 else interval.every
        while (cal.month(d) % every != 0) d = cal.setMonth(d, cal.month(d) + 1)
    }
    return d
}

private fun advance(
    d: Double,
    interval: Interval,
    cal: WallCalendar,
): Double =
    when (interval.unit) {
        TimeUnit.Day -> cal.setDate(d, cal.date(d) + interval.every)
        TimeUnit.Week -> cal.setDate(d, cal.date(d) + 7 * interval.every)
        TimeUnit.Month -> cal.setMonth(d, cal.month(d) + interval.every)
        TimeUnit.Year -> cal.setYear(d, cal.year(d) + interval.every)
    }

private fun tickLabel(
    wall: Double,
    instant: Double,
    unit: TimeUnit,
    first: Boolean,
    spanDays: Double,
    cal: WallCalendar,
    locale: ChartLocale,
    timeZone: String?,
): String =
    when {
        unit == TimeUnit.Year -> cal.year(wall).toString()
        unit == TimeUnit.Month ->
            if (first || cal.month(wall) == 0) {
                "${shortMonth(instant, locale, timeZone)} ${cal.year(wall)}"
            } else {
                shortMonth(instant, locale, timeZone)
            }
        unit == TimeUnit.Day && spanDays <= 14 -> "${shortWeekday(instant, locale, timeZone)} ${cal.date(wall)}"
        else -> "${cal.date(wall)} ${shortMonth(instant, locale, timeZone)}"
    }

/**
 * Calendar-aligned ticks (midnight, Mondays, first of the month, January) in [timeZone] (null is the platform's local zone),
 * labelled in [locale]. Picks the finest interval that keeps at most [count] ticks. A non-finite end gives no ticks.
 */
public fun timeTicks(
    start: Double,
    end: Double,
    locale: ChartLocale,
    timeZone: String? = null,
    count: Int = 6,
): List<TimeTick> {
    if (!start.isFinite() || !end.isFinite()) return emptyList()
    val t0 = min(start, end)
    val t1 = max(start, end)
    val span = t1 - t0
    val limit = max(1, count)
    val interval =
        INTERVALS.firstOrNull { span / it.approx <= limit }
            ?: Interval(TimeUnit.Year, ceil(span / (365.25 * DAY_MS) / limit).toInt(), 0.0)
    val spanDays = span / DAY_MS
    val cal = WallCalendar(locale, timeZone)
    val out = ArrayList<TimeTick>()
    var cursor = firstTick(t0, interval, cal)
    while (cal.instant(cursor) <= t1 && out.size < MAX_TIME_TICKS) {
        val value = cal.instant(cursor)
        out.add(TimeTick(value, interval.unit, tickLabel(cursor, value, interval.unit, out.isEmpty(), spanDays, cal, locale, timeZone)))
        cursor = advance(cursor, interval, cal)
    }
    return out
}

public interface TimeScale : ContinuousScale {
    public fun timeTicks(count: Int = 6): List<TimeTick>
}

private class CalendarTimeScale(
    private val d0: Double,
    private val d1: Double,
    override val range: NumberRange,
    private val locale: ChartLocale,
    private val timeZone: String?,
) : TimeScale {
    private val r0 = range.first
    private val rSpan = range.second - range.first
    override val type: ScaleType get() = ScaleType.Time
    override val domain: NumberRange = NumberRange(d0, d1)
    override val tickCount: Int get() = 6

    override fun map(value: Double): Double = if (value.isFinite()) r0 + (value - d0) / (d1 - d0) * rSpan else Double.NaN

    override fun invert(pixel: Double): Double =
        if (pixel.isFinite()) d0 + (pixel - r0) / (if (rSpan == 0.0) 1.0 else rSpan) * (d1 - d0) else Double.NaN

    override fun ticks(count: Int): DoubleArray {
        val ticks = timeTicks(count)
        return DoubleArray(ticks.size) { ticks[it].value }
    }

    override fun timeTicks(count: Int): List<TimeTick> = timeTicks(d0, d1, locale, timeZone, count)
}

/** Time scale over epoch milliseconds. An empty domain gets a day of room; a non-finite end falls back to the epoch day. */
public fun timeScale(
    domainStart: Double,
    domainEnd: Double,
    rangeStart: Double,
    rangeEnd: Double,
    locale: ChartLocale,
    timeZone: String? = null,
): TimeScale {
    val d0 = if (domainStart.isFinite()) domainStart else 0.0
    val end = if (domainEnd.isFinite()) domainEnd else d0
    val d1 = if (end == d0) d0 + DAY_MS else end
    val r0 = if (rangeStart.isFinite()) rangeStart else 0.0
    val r1 = if (rangeEnd.isFinite()) rangeEnd else 1.0
    return CalendarTimeScale(d0, d1, NumberRange(r0, r1), locale, timeZone)
}
