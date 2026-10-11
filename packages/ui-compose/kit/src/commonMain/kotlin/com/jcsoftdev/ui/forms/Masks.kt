package com.jcsoftdev.ui.forms

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation

/** Digits-only editing model: the field stores raw digits and the separators exist only on screen. */
internal fun digitsOnly(
    text: String,
    maxLength: Int,
): String {
    var allDigits = text.length <= maxLength
    for (ch in text) if (ch !in '0'..'9') allDigits = false
    if (allDigits) return text
    val out = StringBuilder(maxLength)
    for (ch in text) {
        if (ch in '0'..'9') {
            out.append(ch)
            if (out.length == maxLength) break
        }
    }
    return out.toString()
}

internal object TimeFormat {
    const val DIGITS = 4

    /** "0930" -> "09:30", "093" -> "09:3", "09" -> "09". */
    fun display(digits: String): String = if (digits.length > 2) digits.substring(0, 2) + ":" + digits.substring(2) else digits

    /** "930", "9:30", "0930" or "09:30" -> "09:30"; null when it is not a 24h time. */
    fun normalize(text: String): String? {
        val digits = digitsOnly(text, 5)
        if (digits.length < 3 || digits.length > DIGITS) return null
        val padded = digits.padStart(DIGITS, '0')
        val hour = (padded[0] - '0') * 10 + (padded[1] - '0')
        val minute = (padded[2] - '0') * 10 + (padded[3] - '0')
        return if (hour < 24 && minute < 60) display(padded) else null
    }

    /** The committed value for typed [digits]: "HH:mm" when complete and valid, otherwise "". */
    fun commit(digits: String): String = if (digits.length == DIGITS) normalize(digits).orEmpty() else ""
}

internal object DateFormat {
    const val DIGITS = 8

    /** "09032024" -> "09/03/2024". */
    fun display(digits: String): String =
        when {
            digits.length > 4 -> digits.substring(0, 2) + "/" + digits.substring(2, 4) + "/" + digits.substring(4)
            digits.length > 2 -> digits.substring(0, 2) + "/" + digits.substring(2)
            else -> digits
        }

    fun isLeapYear(year: Int): Boolean = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)

    fun daysInMonth(
        month: Int,
        year: Int,
    ): Int =
        when (month) {
            2 -> if (isLeapYear(year)) 29 else 28
            4, 6, 9, 11 -> 30
            else -> 31
        }

    /** "dd/MM/yyyy" for eight digits that form a real calendar date (year 1..9999); null otherwise. */
    fun normalize(text: String): String? {
        val digits = digitsOnly(text, DIGITS + 1)
        if (digits.length != DIGITS) return null
        val day = digits.substring(0, 2).toInt()
        val month = digits.substring(2, 4).toInt()
        val year = digits.substring(4).toInt()
        if (year < 1 || month !in 1..12 || day !in 1..daysInMonth(month, year)) return null
        return display(digits)
    }

    fun commit(digits: String): String = if (digits.length == DIGITS) normalize(digits).orEmpty() else ""
}

/** Inserts [separator] before the raw digit offsets [first] and [second] on screen only. */
internal class SeparatorTransformation(
    private val separator: Char,
    private val first: Int,
    private val second: Int,
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        val out = StringBuilder(raw.length + 2)
        for (i in raw.indices) {
            if (i == first || i == second) out.append(separator)
            out.append(raw[i])
        }
        return TransformedText(AnnotatedString(out.toString()), mapping)
    }

    private fun shift(offset: Int): Int = (if (offset > first) 1 else 0) + (if (second != NONE && offset > second) 1 else 0)

    private val mapping =
        object : OffsetMapping {
            override fun originalToTransformed(offset: Int): Int = offset + shift(offset)

            override fun transformedToOriginal(offset: Int): Int {
                val afterFirst = if (offset > first) 1 else 0
                val afterSecond = if (second != NONE && offset > second + 1) 1 else 0
                return (offset - afterFirst - afterSecond).coerceAtLeast(0)
            }
        }

    companion object {
        const val NONE = Int.MAX_VALUE
    }
}

internal val TimeTransformation = SeparatorTransformation(':', 2, SeparatorTransformation.NONE)
internal val DateTransformation = SeparatorTransformation('/', 2, 4)
