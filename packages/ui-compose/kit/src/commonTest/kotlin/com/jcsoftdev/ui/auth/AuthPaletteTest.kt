package com.jcsoftdev.ui.auth

import androidx.compose.ui.graphics.luminance
import com.jcsoftdev.ui.theme.ThemeColors
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiPalettes
import com.jcsoftdev.ui.theme.withPalette
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthPaletteTest {
    /** The two base themes and every accent the kit ships, each in the light and the dark theme. */
    private val themes: List<Pair<String, ThemeColors>> =
        listOf("base light" to UiColors.Light, "base dark" to UiColors.Dark) +
            UiPalettes.ids.flatMap { id ->
                listOf(
                    "$id light" to UiColors.Light.withPalette(UiPalettes.light(id)),
                    "$id dark" to UiColors.Dark.withPalette(UiPalettes.dark(id)),
                )
            }

    private fun assertAtLeast(
        minimum: Float,
        ratio: Float,
        what: String,
    ) = assertTrue(ratio >= minimum - 0.01f, "$what: $ratio < $minimum")

    @Test
    fun headerTextKeepsAtLeast4_5ToOneWithEveryAccent() {
        for ((name, c) in themes) {
            val header = authHeaderColor(c)
            assertAtLeast(4.5f, contrast(authOnColor(header, c), header), "$name header text")
        }
    }

    @Test
    fun everyHeaderIsNearBlackAndTheDarkSheetDrawsAnEdgeAgainstIt() {
        for ((name, c) in themes) {
            val header = authHeaderColor(c)
            assertTrue(header.luminance() < 0.03f, "$name header is near black, was ${header.luminance()}")
            val edge = authNeedsSheetEdge(header, c.surface)
            assertEquals(name.endsWith("dark"), edge, "$name: an edge only where band and sheet are close in tone")
        }
    }

    @Test
    fun floatingPiecesKeepThreeToOneOnTheHeaderAndTheirGlyphsOnThem() {
        for ((name, c) in themes) {
            val header = authHeaderColor(c)
            val paper = authOnColor(header, c)
            for (fill in listOf(authPieceFill(c.accent, header, paper), authPieceFill(c.accent2, header, paper), paper)) {
                assertAtLeast(3f, contrast(fill, header), "$name piece $fill on the header")
            }
        }
    }

    @Test
    fun theWelcomeHighlightKeepsTheTitleReadable() {
        for ((name, c) in themes) assertAtLeast(4.5f, contrast(c.ink, authHighlightColor(c)), "$name title over its highlight")
    }

    @Test
    fun fieldEdgesKeepThreeToOneOnTheSheet() {
        for ((name, c) in themes) assertAtLeast(3f, contrast(authFieldEdgeColor(c), c.surface), "$name field edge")
    }
}
