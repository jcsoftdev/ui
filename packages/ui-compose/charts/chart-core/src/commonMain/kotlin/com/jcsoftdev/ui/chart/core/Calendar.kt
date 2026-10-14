package com.jcsoftdev.ui.chart.core

import kotlin.math.floor

internal const val DAY_MS = 86_400_000.0

/** Days since 1970-01-01 of a proleptic Gregorian date, `month` in 1..12. */
private fun daysFromCivil(
    year: Long,
    month: Long,
    day: Long,
): Long {
    val y = if (month <= 2) year - 1 else year
    val era = y.floorDiv(400L)
    val yoe = y - era * 400
    val doy = (153 * (if (month > 2) month - 3 else month + 9) + 2) / 5 + day - 1
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146_097 + doe - 719_468
}

/** Year, month (1..12) and day of month of a day number, as a three-element array. */
private fun civilFromDays(days: Long): LongArray {
    val z = days + 719_468
    val era = z.floorDiv(146_097L)
    val doe = z - era * 146_097
    val yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val d = doy - (153 * mp + 2) / 5 + 1
    val m = if (mp < 10) mp + 3 else mp - 9
    return longArrayOf(yoe + era * 400 + (if (m <= 2) 1 else 0), m, d)
}

/**
 * Calendar arithmetic in one zone. A "wall" value is a number of milliseconds whose UTC fields read the zone's calendar, so the
 * date arithmetic is zone-free and only [wall] and [instant] consult the zone's offset. `setDate`, `setMonth` and `setYear`
 * overflow like JavaScript's `Date` (day 0 is the last day of the previous month), which the tick and range code relies on.
 */
internal class WallCalendar(
    private val locale: ChartLocale,
    private val timeZone: String?,
) {
    private fun offset(epochMillis: Double): Double = locale.zoneOffsetMillis(timeZone, epochMillis)

    fun wall(epochMillis: Double): Double = epochMillis + offset(epochMillis)

    /**
     * The instant whose wall clock reads [wall]. The offsets two days either side bracket any daylight saving change near it: a wall
     * time inside a spring-forward gap resolves forward with the earlier offset, and one repeated by a fall-back takes its first
     * occurrence, the same as java.time.
     */
    fun instant(wall: Double): Double {
        val before = offset(wall - 2 * DAY_MS)
        val after = offset(wall + 2 * DAY_MS)
        val first = wall - before
        if (before == after || offset(first) == before) return first
        val second = wall - after
        return if (offset(second) == after) second else first
    }

    private fun days(wall: Double): Long = floor(wall / DAY_MS).toLong()

    private fun timeOfDay(wall: Double): Double = wall - floor(wall / DAY_MS) * DAY_MS

    fun year(wall: Double): Int = civilFromDays(days(wall))[0].toInt()

    /** Month in 0..11. */
    fun month(wall: Double): Int = civilFromDays(days(wall))[1].toInt() - 1

    fun date(wall: Double): Int = civilFromDays(days(wall))[2].toInt()

    /** Weekday in 0..6 with 0 = Sunday. */
    fun day(wall: Double): Int = (days(wall) + 4).mod(7L).toInt()

    fun midnight(wall: Double): Double = floor(wall / DAY_MS) * DAY_MS

    private fun build(
        year: Long,
        month0: Long,
        date: Long,
        timeOfDay: Double,
    ): Double {
        val y = year + month0.floorDiv(12L)
        val m = month0.mod(12L)
        return (daysFromCivil(y, m + 1, 1) + date - 1) * DAY_MS + timeOfDay
    }

    fun setDate(
        wall: Double,
        value: Int,
    ): Double {
        val c = civilFromDays(days(wall))
        return build(c[0], c[1] - 1, value.toLong(), timeOfDay(wall))
    }

    fun setMonth(
        wall: Double,
        value: Int,
    ): Double {
        val c = civilFromDays(days(wall))
        return build(c[0], value.toLong(), c[2], timeOfDay(wall))
    }

    fun setYear(
        wall: Double,
        value: Int,
    ): Double {
        val c = civilFromDays(days(wall))
        return build(value.toLong(), c[1] - 1, c[2], timeOfDay(wall))
    }
}
