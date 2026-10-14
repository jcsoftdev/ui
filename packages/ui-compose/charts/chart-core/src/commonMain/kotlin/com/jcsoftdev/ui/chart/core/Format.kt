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
private class Decimal(
    val digits: String,
    val pointExp: Int,
)

/** Shortest decimal expansion of a finite, non-negative double, so rounding acts on what the number prints as, like ICU. */
private fun decimalOf(value: Double): Decimal {
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
private fun Decimal.rounded(fraction: Int): Decimal {
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

private fun Decimal.isZero(): Boolean = digits.isEmpty()

private fun Decimal.integerDigits(): Int = max(pointExp, 0)

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
    val tag = locale.tag.replace('_', '-')
    val group = if (tag in NBSP_LOCALES && locale.groupSeparator != locale.decimalSeparator) NBSP else locale.groupSeparator
    val out = StringBuilder()
    val grouped = integer.length >= 3 + if (compact) 2 else minimumGrouping(tag)
    for (i in integer.indices) {
        if (grouped && i > 0 && (integer.length - i) % 3 == 0) out.append(group)
        out.append(integer[i])
    }
    if (fraction.isNotEmpty()) out.append(locale.decimalSeparator).append(fraction)
    return out.toString()
}

private fun signed(
    negative: Boolean,
    decimal: Decimal,
    locale: ChartLocale,
    body: String,
): String = if (negative && !decimal.isZero()) locale.minusSign + body else body

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
    return signed(value < 0, decimal, locale, decimal.render(locale, minimumFractionDigits))
}

private class Affixes(
    val prefix: String,
    val suffix: String,
)

private fun affixes(sample: String): Affixes {
    val first = sample.indexOfFirst { it.isDigit() }
    val last = sample.indexOfLast { it.isDigit() }
    return if (first < 0) Affixes("", sample) else Affixes(sample.substring(0, first), sample.substring(last + 1))
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
    val around = affixes(locale.styleSample(NumberStyle.Currency, currency))
    val body = around.prefix + decimal.render(locale, decimals) + around.suffix
    return signed(value < 0, decimal, locale, body)
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
    val around = affixes(locale.styleSample(NumberStyle.Percent, null))
    return signed(value < 0, decimal, locale, around.prefix + decimal.render(locale, 0) + around.suffix)
}

private class CompactUnit(
    val exponent: Int,
    val suffix: String,
)

private val COMPACT_ES = listOf(CompactUnit(3, "\u00A0mil"), CompactUnit(6, "\u00A0M"), CompactUnit(12, "\u00A0B"))
private val COMPACT_EN = listOf(CompactUnit(3, "K"), CompactUnit(6, "M"), CompactUnit(9, "B"), CompactUnit(12, "T"))

private fun compactUnits(tag: String): List<CompactUnit> = if (tag.substringBefore('-').lowercase() == "es") COMPACT_ES else COMPACT_EN

/** 1234 -> "1,2 mil" (es) or "1.2K" (en); 2500000 -> "2,5 M". Values under 1000 keep their digits. */
public fun formatCompact(
    value: Double,
    locale: ChartLocale = ChartLocales.system,
    decimals: Int = 1,
    prefix: String = "",
): String {
    if (!value.isFinite()) return NON_FINITE_LABEL
    val units = compactUnits(locale.tag.replace('_', '-'))
    val parsed = decimalOf(abs(value))
    var unit = units.lastOrNull { it.exponent <= parsed.pointExp - 1 }
    var scaled = Decimal(parsed.digits, parsed.pointExp - (unit?.exponent ?: 0)).rounded(decimals)
    if (scaled.integerDigits() >= 4) {
        val next = units.firstOrNull { it.exponent == (unit?.exponent ?: 0) + 3 }
        if (next != null) {
            unit = next
            scaled = Decimal(parsed.digits, parsed.pointExp - next.exponent).rounded(decimals)
        }
    }
    val body = scaled.render(locale, 0, compact = true) + (unit?.suffix ?: "")
    return prefix + signed(value < 0, scaled, locale, body)
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
    val around = affixes(locale.styleSample(NumberStyle.Currency, currency))
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
