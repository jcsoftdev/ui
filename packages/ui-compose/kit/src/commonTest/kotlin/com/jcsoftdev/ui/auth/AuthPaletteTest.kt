package com.jcsoftdev.ui.auth

import com.jcsoftdev.ui.theme.UiColors
import kotlin.test.Test
import kotlin.test.assertTrue

class AuthPaletteTest {
    @Test
    fun headerTextKeepsAtLeast4_5ToOneInLightAndDark() {
        for (colors in listOf(UiColors.Light, UiColors.Dark)) {
            val header = authHeaderColor(colors)
            assertTrue(contrast(authOnColor(header, colors), header) >= 4.5f)
        }
    }
}
