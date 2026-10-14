package com.jcsoftdev.ui.chart.core

import kotlin.math.abs
import kotlin.math.max

public fun interface ValueFormatter {
    public fun format(value: Double): String
}

public enum class ValuePreset { Number, Integer, Currency, Percent, Compact }

/** What a non-finite number renders as. Chart labels never show "NaN" or "Infinity". */
public const val NON_FINITE_LABEL: String = "–"

private const val NBSP = "\u00A0"

/** Locales that keep the no-break thousands space, as the web charts do ("S/ 1 234.50"); any other uses its own separator. */
private val NBSP_LOCALES = setOf("es-PE", "es")

/** Value as `0.digits x 10^pointExp`, digits without leading or trailing zeros; empty digits is zero. */
internal class Decimal(
    val digits: String,
    val pointExp: Int,
)

/** Shortest decimal expansion of a finite, non-negative double, so rounding acts on what the number prints as, like ICU. */
internal fun decimalOf(value: Double): Decimal {
    val text = value.toString()
    val e = text.indexOf('E')
    val mantissa = if (e >= 0) text.substring(0, e) else text
    val exponent = if (e >= 0) text.substring(e + 1).toInt() else 0
    val dot = mantissa.indexOf('.')
    val raw = mantissa.replace(".", "")
    val point = (if (dot >= 0) dot else mantissa.length) + exponent
    val leading = raw.length - raw.trimStart('0').length
    val digits = raw.trim('0')
    return if (digits.isEmpty()) Decimal("", 0) else Decimal(digits, point - leading)
}

/** Rounds half away from zero to [fraction] fraction digits. */
internal fun Decimal.rounded(fraction: Int): Decimal {
    val keep = pointExp + fraction
    if (digits.isEmpty() || keep >= digits.length) return this
    if (keep < 0 || (keep == 0 && digits[0] < '5')) return Decimal("", 0)
    if (keep == 0) return Decimal("1", pointExp + 1)
    if (digits[keep] < '5') return Decimal(digits.substring(0, keep).trimEnd('0'), pointExp)
    val chars = digits.substring(0, keep).toCharArray()
    var i = keep - 1
    while (i >= 0 && chars[i] == '9') {
        chars[i] = '0'
        i--
    }
    return if (i < 0) {
        Decimal("1", pointExp + 1)
    } else {
        chars[i] = chars[i] + 1
        Decimal(chars.concatToString().trimEnd('0'), pointExp)
    }
}

internal fun Decimal.isZero(): Boolean = digits.isEmpty()

internal fun Decimal.toDouble(): Double = if (digits.isEmpty()) 0.0 else "0.${digits}E$pointExp".toDouble()

private fun Decimal.integerDigits(): Int = max(pointExp, 0)

/**
 * Language and region of a tag, without script, variants or extensions: "es-PE-u-fw-mon", "es_PE@rg=ptzzzz" and "es-PE" all read
 * "es-PE", so a platform that appends extensions does not lose the locale's grouping rules.
 */
internal fun baseTag(tag: String): String {
    val parts = tag.substringBefore('@').replace('_', '-').split('-')
    var region: String? = null
    for (i in 1 until parts.size) {
        val part = parts[i]
        if (part.length == 1) break
        if ((part.length == 2 && part.all { it.isLetter() }) || (part.length == 3 && part.all { it.isDigit() })) {
            region = part.uppercase()
            break
        }
    }
    val language = parts[0].lowercase()
    return if (region == null) language else "$language-$region"
}

private fun minimumGrouping(tag: String): Int = if (tag == "es" || tag == "es-ES" || tag == "pl" || tag == "pt-PT") 2 else 1

private fun Decimal.render(
    locale: ChartLocale,
    minFraction: Int,
    compact: Boolean = false,
): String {
    val integer =
        when {
            pointExp <= 0 -> "0"
            digits.length >= pointExp -> digits.substring(0, pointExp)
            else -> digits.padEnd(pointExp, '0')
        }
    val fraction =
        when {
            pointExp >= digits.length -> ""
            pointExp >= 0 -> digits.substring(pointExp)
            else -> "0".repeat(-pointExp) + digits
        }.padEnd(minFraction, '0')
    val tag = baseTag(locale.tag)
    val group = if (tag in NBSP_LOCALES && locale.groupSeparator != locale.decimalSeparator) NBSP else locale.groupSeparator
    val first = locale.groupingSize
    val next = locale.secondaryGroupingSize
    val out = StringBuilder()
    val grouped = integer.length >= first + if (compact) 2 else minimumGrouping(tag)
    for (i in integer.indices) {
        val remaining = integer.length - i
        if (grouped && i > 0 && (remaining == first || (remaining > first && (remaining - first) % next == 0))) out.append(group)
        out.append(locale.digit(integer[i]))
    }
    if (fraction.isNotEmpty()) {
        out.append(locale.decimalSeparator)
        for (c in fraction) out.append(locale.digit(c))
    }
    return out.toString()
}

private fun ChartLocale.digit(ascii: Char): Char = if (zeroDigit == '0') ascii else zeroDigit + (ascii - '0')

/** The platform's affixes around [body]: the sign of a negative that still shows a non-zero digit sits where the platform puts it. */
private fun wrap(
    negative: Boolean,
    decimal: Decimal,
    locale: ChartLocale,
    style: NumberStyle,
    currency: String?,
    body: String,
): String {
    val around = locale.affixes(style, currency, negative && !decimal.isZero())
    return around.prefix + body + around.suffix
}

/** "12 345.68" in es-PE: shared rounding, the locale's separators. A negative that rounds to zero prints without a sign. */
public fun formatNumber(
    value: Double,
    locale: ChartLocale = ChartLocales.system,
    minimumFractionDigits: Int = 0,
    maximumFractionDigits: Int = 2,
): String {
    if (!value.isFinite()) return NON_FINITE_LABEL
    val maxFraction = max(minimumFractionDigits, maximumFractionDigits)
    val decimal = decimalOf(abs(value)).rounded(maxFraction)
    return wrap(value < 0, decimal, locale, NumberStyle.Decimal, null, decimal.render(locale, minimumFractionDigits))
}

/** "S/ 1 234.50". The currency is never guessed: without a code the value is a plain number with [decimals] fraction digits. */
public fun formatCurrency(
    value: Double,
    currency: String?,
    locale: ChartLocale = ChartLocales.system,
    decimals: Int = 2,
): String {
    if (currency.isNullOrEmpty()) return formatNumber(value, locale, decimals, decimals)
    if (!value.isFinite()) return NON_FINITE_LABEL
    val decimal = decimalOf(abs(value)).rounded(decimals)
    return wrap(value < 0, decimal, locale, NumberStyle.Currency, currency, decimal.render(locale, decimals))
}

/** 0.125 -> "12.5%". [whole] reads the value as 0-100 instead of 0-1. The shift happens on the decimal digits, so no float noise. */
public fun formatPercent(
    value: Double,
    locale: ChartLocale = ChartLocales.system,
    decimals: Int = 1,
    whole: Boolean = false,
): String {
    if (!value.isFinite()) return NON_FINITE_LABEL
    val parsed = decimalOf(abs(value))
    val shifted = if (parsed.isZero() || whole) parsed else Decimal(parsed.digits, parsed.pointExp + 2)
    val decimal = shifted.rounded(decimals)
    return wrap(value < 0, decimal, locale, NumberStyle.Percent, null, decimal.render(locale, 0))
}

/**
 * A compact suffix: values from 10^[from] up show as value / 10^[exponent] followed by [suffix]. Spanish has no word for 10^9, so
 * 10^10 reads "10 mil M" (ten thousand millions); [from] is then above [exponent] and a rounded carry never promotes into it.
 */
private class CompactUnit(
    val from: Int,
    val exponent: Int,
    val suffix: String,
)

private val COMPACT_ES =
    listOf(
        CompactUnit(3, 3, "\u00A0mil"),
        CompactUnit(6, 6, "\u00A0M"),
        CompactUnit(10, 9, "\u00A0mil\u00A0M"),
        CompactUnit(12, 12, "\u00A0B"),
    )
private val COMPACT_EN = listOf(CompactUnit(3, 3, "K"), CompactUnit(6, 6, "M"), CompactUnit(9, 9, "B"), CompactUnit(12, 12, "T"))

private fun compactUnits(tag: String): List<CompactUnit>? =
    when {
        tag.startsWith("es") -> COMPACT_ES
        tag == "en-IN" -> null // lakh and crore: "1L", "1Cr"
        tag.startsWith("en") -> COMPACT_EN
        else -> null
    }

/**
 * 1234 -> "1,2 mil" (es) or "1.2K" (en); 2500000 -> "2,5 M". Values under 1000 keep their digits. Spanish and English (except en-IN, which counts in
 * lakh and crore) have compact suffixes here; any other locale formats the full number with [decimals] fraction digits instead of a wrong "12,3K".
 */
public fun formatCompact(
    value: Double,
    locale: ChartLocale = ChartLocales.system,
    decimals: Int = 1,
    prefix: String = "",
): String {
    if (!value.isFinite()) return NON_FINITE_LABEL
    val units = compactUnits(baseTag(locale.tag)) ?: return prefix + formatNumber(value, locale, 0, decimals)
    val parsed = decimalOf(abs(value))
    var unit = units.lastOrNull { it.from <= parsed.pointExp - 1 }
    var scaled = Decimal(parsed.digits, parsed.pointExp - (unit?.exponent ?: 0)).rounded(decimals)
    if (scaled.integerDigits() >= 4) {
        val next = units.firstOrNull { it.exponent == (unit?.exponent ?: 0) + 3 && it.from == it.exponent }
        if (next != null) {
            unit = next
            scaled = Decimal(parsed.digits, parsed.pointExp - next.exponent).rounded(decimals)
        }
    }
    val body = scaled.render(locale, 0, compact = true) + (unit?.suffix ?: "")
    return prefix + wrap(value < 0, scaled, locale, NumberStyle.Decimal, null, body)
}

/** Turns a preset into a function. [currency] is required for [ValuePreset.Currency]; there is no default currency. */
public fun resolveFormat(
    preset: ValuePreset,
    locale: ChartLocale = ChartLocales.system,
    currency: String? = null,
): ValueFormatter =
    when (preset) {
        ValuePreset.Integer -> ValueFormatter { formatNumber(it, locale, 0, 0) }
        ValuePreset.Currency -> ValueFormatter { formatCurrency(it, currency, locale) }
        ValuePreset.Percent -> ValueFormatter { formatPercent(it, locale) }
        ValuePreset.Compact -> ValueFormatter { formatCompact(it, locale) }
        ValuePreset.Number -> ValueFormatter { formatNumber(it, locale) }
    }

private fun currencySymbol(
    currency: String,
    locale: ChartLocale,
): String {
    val around = locale.affixes(NumberStyle.Currency, currency, false)
    val symbol = (around.prefix + around.suffix).trim { it.isWhitespace() || it == ' ' }
    return symbol.ifEmpty { currency }
}

/** Shorter variant for axis ticks: currency drops the cents and turns compact from ten thousand; plain numbers turn compact from 10 000. */
public fun resolveAxisFormat(
    preset: ValuePreset,
    locale: ChartLocale = ChartLocales.system,
    currency: String? = null,
): ValueFormatter =
    when (preset) {
        ValuePreset.Currency -> {
            val prefix = if (currency.isNullOrEmpty()) "" else currencySymbol(currency, locale) + NBSP
            ValueFormatter {
                if (abs(it) >= 10_000) formatCompact(it, locale, prefix = prefix) else formatCurrency(it, currency, locale, 0)
            }
        }
        ValuePreset.Percent -> ValueFormatter { formatPercent(it, locale, 0) }
        else -> ValueFormatter { if (abs(it) >= 10_000) formatCompact(it, locale) else formatNumber(it, locale) }
    }
