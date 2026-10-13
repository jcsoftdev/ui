package com.jcsoftdev.ui.glass

import androidx.compose.ui.graphics.Color
import com.jcsoftdev.ui.theme.UiColors
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Token math, no rendering: the glass surface is the backdrop under the tint and then the dim layer (the draw order of the
 * surface), and the worst backdrops are pure black and pure white (blur and saturation leave those two unchanged).
 */
class GlassContrastTest {
    private fun over(
        top: Color,
        bottom: Color,
    ) = Color(
        top.red * top.alpha + bottom.red * (1 - top.alpha),
        top.green * top.alpha + bottom.green * (1 - top.alpha),
        top.blue * top.alpha + bottom.blue * (1 - top.alpha),
    )

    private fun channel(c: Float) = if (c <= 0.03928f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)

    private fun luminance(c: Color) = 0.2126f * channel(c.red) + 0.7152f * channel(c.green) + 0.0722f * channel(c.blue)

    private fun contrast(
        a: Color,
        b: Color,
    ): Float {
        val (hi, lo) = luminance(a).let { la -> luminance(b).let { lb -> if (la > lb) la to lb else lb to la } }
        return (hi + 0.05f) / (lo + 0.05f)
    }

    private fun worst(
        material: SurfaceMaterial,
        dark: Boolean,
        ink: Color,
    ): Float {
        val tokens = glassTokens(material, dark)
        return listOf(Color.Black, Color.White).minOf { backdrop -> contrast(ink, over(tokens.dim, over(tokens.tint, backdrop))) }
    }

    private fun check(
        material: SurfaceMaterial,
        dark: Boolean,
        ink: (com.jcsoftdev.ui.theme.ThemeColors) -> Color,
        minimum: Float,
    ) {
        val colors = if (dark) UiColors.Dark else UiColors.Light
        val ratio = worst(material, dark, ink(colors))
        assertTrue(ratio >= minimum, "$material dark=$dark: worst-case contrast $ratio < $minimum")
    }

    @Test fun regularGlassKeepsInkAndInk2Legible() {
        for (m in listOf(SurfaceMaterial.Glass, LiquidGlass())) {
            for (dark in listOf(false, true)) {
                check(m, dark, { it.ink }, 4.5f)
                check(m, dark, { it.ink2 }, 4.5f)
            }
        }
    }

    @Test fun clearGlassKeepsPrimaryInkLegible() {
        for (m in listOf(SurfaceMaterial.GlassClear, LiquidGlass(clear = true))) {
            for (dark in listOf(false, true)) check(m, dark, { it.ink }, 4.5f)
        }
    }

    // ink3 is the quiet tertiary color: about 3.3:1 on frosted regular over black, and no better on Liquid. This pins that
    // known limit so a regression shows up; it is not a promise that ink3 text on glass is accessible.
    @Test fun tertiaryInkIsDocumentedAsBelowAaOnGlass() {
        check(SurfaceMaterial.Glass, false, { it.ink3 }, 3.2f)
        check(LiquidGlass(), false, { it.ink3 }, 3.0f)
    }
}
