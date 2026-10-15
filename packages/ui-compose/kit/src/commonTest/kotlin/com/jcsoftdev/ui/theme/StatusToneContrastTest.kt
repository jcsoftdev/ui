package com.jcsoftdev.ui.theme

import androidx.compose.ui.graphics.Color
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertTrue

class StatusToneContrastTest {
    private fun channel(c: Float) = if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)

    private fun luminance(c: Color) = 0.2126f * channel(c.red) + 0.7152f * channel(c.green) + 0.0722f * channel(c.blue)

    private fun contrast(
        a: Color,
        b: Color,
    ): Float {
        val x = luminance(a)
        val y = luminance(b)
        return (maxOf(x, y) + 0.05f) / (minOf(x, y) + 0.05f)
    }

    private fun hue(c: Color): Float {
        val max = maxOf(c.red, c.green, c.blue)
        val d = max - minOf(c.red, c.green, c.blue)
        if (d == 0f) return 0f
        val h =
            when (max) {
                c.red -> ((c.green - c.blue) / d) % 6f
                c.green -> (c.blue - c.red) / d + 2f
                else -> (c.red - c.green) / d + 4f
            }
        return (h * 60f + 360f) % 360f
    }

    private val themes = mapOf("light" to UiColors.Light, "dark" to UiColors.Dark)

    @Test
    fun textOnEverySoftFillMeetsAa() {
        for ((name, c) in themes) {
            val pairs =
                mapOf(
                    "accentInk/accentSoft" to (c.accentInk to c.accentSoft),
                    "danger/dangerSoft" to (c.danger to c.dangerSoft),
                    "warning/warningSoft" to (c.warning to c.warningSoft),
                    "info/infoSoft" to (c.info to c.infoSoft),
                    "success/successSoft" to (c.success to c.successSoft),
                    "ink/dangerSoft" to (c.ink to c.dangerSoft),
                    "ink2/dangerSoft" to (c.ink2 to c.dangerSoft),
                    "ink3/dangerSoft" to (c.ink3 to c.dangerSoft),
                )
            for ((pair, colors) in pairs) {
                val ratio = contrast(colors.first, colors.second)
                assertTrue(ratio >= 4.5f, "$name $pair is $ratio:1, needs 4.5:1")
            }
        }
    }

    @Test
    fun accentAndDangerFillsAreDistinct() {
        for ((name, c) in themes) {
            assertTrue(c.accentSoft != c.dangerSoft, "$name accentSoft and dangerSoft are the same color")
            val separation = contrast(c.accentSoft, c.dangerSoft)
            assertTrue(separation >= 1.08f, "$name accentSoft/dangerSoft fills are only $separation:1 apart")
            val hueGap = kotlin.math.abs(hue(c.accentSoft) - hue(c.dangerSoft))
            assertTrue(hueGap >= 6f, "$name accentSoft/dangerSoft hues are $hueGap degrees apart")
        }
    }

    @Test
    fun countStyleKeepsDescendersInsideTheLine() {
        val count = ThemeTypography.Default.count
        assertTrue(count.fontSize.value >= 12f, "count is ${count.fontSize}")
        assertTrue(count.lineHeight.value / count.fontSize.value >= 1.15f, "count line height ${count.lineHeight}")
    }
}
