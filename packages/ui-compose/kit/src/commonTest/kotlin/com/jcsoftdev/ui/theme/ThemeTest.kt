package com.jcsoftdev.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame

class ThemeTest {
    private val base = UiColors.Light.accent

    @Test
    fun paletteIdWins() {
        assertSame(UiPalettes.light("menta"), resolveAccent("menta", dark = false, base = base))
        assertSame(UiPalettes.dark("menta"), resolveAccent("menta", dark = true, base = base))
    }

    @Test
    fun hexPicksNearestPaletteAccent() {
        assertSame(UiPalettes.light("cielo"), resolveAccent("#1E90FF", dark = false, base = base))
        assertSame(UiPalettes.dark("lavanda"), resolveAccent("#B0A8F5", dark = true, base = base))
    }

    @Test
    fun hexNearestToBaseOrInvalidKeepsBase() {
        val baseHex =
            "#" +
                (base.value shr 40)
                    .toInt()
                    .and(0xFFFFFF)
                    .toString(16)
                    .padStart(6, '0')
        assertNull(resolveAccent(baseHex, dark = false, base = base))
        assertNull(resolveAccent(null, dark = false, base = base))
        assertNull(resolveAccent("not-a-color", dark = false, base = base))
        assertNull(resolveAccent("#12345", dark = false, base = base))
    }

    @Test
    fun withPaletteReplacesOnlyAccentTokens() {
        val palette = UiPalettes.light("cielo")!!
        val themed = UiColors.Light.withPalette(palette)
        assertEquals(palette.accent, themed.accent)
        assertEquals(palette.accentSoft, themed.accentSoft)
        assertEquals(UiColors.Light.ink3, themed.ink3)
        assertSame(UiColors.Light, UiColors.Light.withPalette(null))
    }

    @Test
    fun copyOverridesSingleToken() {
        val patched = UiColors.Light.copy(ink3 = UiColors.Light.ink)
        assertEquals(UiColors.Light.ink, patched.ink3)
        assertEquals(UiColors.Light.bg, patched.bg)
    }

    @Test
    fun minLineHeightRaisedToRatio() {
        val tight = TextStyle(fontSize = 10.sp, lineHeight = 10.sp).withMinLineHeight()
        assertEquals(12f, tight.lineHeight.value, 0.001f)
        val roomy = TextStyle(fontSize = 10.sp, lineHeight = 20.sp).withMinLineHeight()
        assertEquals(20f, roomy.lineHeight.value, 0.001f)
    }
}
