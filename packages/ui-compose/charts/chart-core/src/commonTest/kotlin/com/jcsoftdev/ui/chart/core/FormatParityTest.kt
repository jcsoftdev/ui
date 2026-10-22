package com.jcsoftdev.ui.chart.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Number formatting against Intl. The shared code does the rounding, grouping and compact notation, so it is compared strictly using
 * the symbols Intl reports for the locale (the fixture), which keeps the check identical on every platform. What each platform
 * contributes (separators, currency and percent affixes, month names) is checked loosely in [PlatformLocaleTest].
 */
class FormatParityTest {
    @Test fun everyFormatMatchesIntl() {
        val locales = HashMap<String, ChartLocale>()
        var checked = 0
        for (case in fixture("format").getList("cases")) {
            val c = case.obj()
            val tag = c.getStr("locale")
            val locale = locales.getOrPut(tag) { fixtureLocale(tag) }
            val value = c.getNum("value")
            val args = c.getObj("args")
            val kind = c.getStr("kind")
            val actual =
                when {
                    kind == "number" -> formatNumber(value, locale)
                    kind == "integer" -> formatNumber(value, locale, 0, 0)
                    kind == "fixed" -> formatNumber(value, locale, args.getValue("min").int(), args.getValue("max").int())
                    kind == "percent" -> formatPercent(value, locale, args.getValue("decimals").int(), args.getValue("whole").bool())
                    kind == "compact" -> formatCompact(value, locale, args.getValue("decimals").int(), args.getStr("prefix"))
                    kind == "currency" -> formatCurrency(value, args.getStr("currency"), locale, args.getValue("decimals").int())
                    kind.startsWith("axis-") -> axisFormat(kind.removePrefix("axis-"), locale, args.getStr("currency")).format(value)
                    else -> error("unknown kind $kind")
                }
            assertEquals(c.getStr("text"), actual, "$tag $kind $value $args")
            checked++
        }
        assertTrue(checked > 500, "checked $checked cases")
    }

    private fun axisFormat(
        preset: String,
        locale: ChartLocale,
        currency: String,
    ): ValueFormatter = resolveAxisFormat(ValuePreset.valueOf(preset.replaceFirstChar { it.uppercase() }), locale, currency)

    @Test fun presetsResolveToTheMatchingFormatters() {
        val locale = fixtureLocale("en-US")
        assertEquals("1,235", resolveFormat(ValuePreset.Integer, locale).format(1234.5))
        assertEquals("1,234.5", resolveFormat(ValuePreset.Number, locale).format(1234.5))
        assertEquals("12.5%", resolveFormat(ValuePreset.Percent, locale).format(0.125))
        assertEquals("1.2K", resolveFormat(ValuePreset.Compact, locale).format(1234.0))
        assertEquals("\$1,234.50", resolveFormat(ValuePreset.Currency, locale, "USD").format(1234.5))
    }
}
