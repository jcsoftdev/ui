@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * The contrast guarantee measured on what the shader really draws (lens, veil, thickness shading, glint, fresnel, grain and the
 * press brightening), not on the tokens: ink over the text area of a surface, over the worst backdrops (pure black and white).
 */
class LiquidContrastRenderTest {
    private fun channel(c: Float) = if (c <= 0.03928f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)

    private fun luminance(
        r: Float,
        g: Float,
        b: Float,
    ) = 0.2126f * channel(r) + 0.7152f * channel(g) + 0.0722f * channel(b)

    private fun contrast(
        a: Float,
        b: Float,
    ) = (maxOf(a, b) + 0.05f) / (minOf(a, b) + 0.05f)

    private fun render(
        backdrop: Color,
        width: Dp,
        height: Dp,
        material: SurfaceMaterial,
        style: LiquidGlassStyle,
        dark: Boolean,
        pressed: Boolean,
    ): Bitmap {
        lateinit var bmp: Bitmap
        runComposeUiTest {
            val source = MutableInteractionSource()
            setContent {
                Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                    Box(Modifier.size(width + 40.dp, height + 40.dp).testTag("frame")) {
                        UiTheme(dark = dark, motion = Motion(0f), liquidGlassStyle = style) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(backdrop))
                            Box(Modifier.offset(20.dp, 20.dp).wrapContentSize(Alignment.TopStart).size(width, height)) {
                                Box(
                                    Modifier.fillMaxSize().material(
                                        material,
                                        RoundedCornerShape(height / 2),
                                        glass = glass,
                                        interactionSource = source,
                                    ),
                                )
                            }
                        }
                    }
                }
            }
            if (pressed) runOnIdle { source.tryEmit(PressInteraction.Press(Offset(10f, 10f))) }
            waitForIdle()
            bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
        }
        return bmp
    }

    // Worst contrast of [ink] against the text area: a centered box as tall as 40% of the surface and as wide as the straight part
    // of the pill (at least 40% of the height, at most 80% of the width).
    private fun worst(
        bmp: Bitmap,
        width: Int,
        height: Int,
        ink: Float,
    ): Float {
        var worst = Float.MAX_VALUE
        val boxW = maxOf(width - height, (height * 0.4f).toInt()).coerceAtMost((width * 0.8f).toInt())
        val boxH = (height * 0.4f).toInt()
        val x0 = 20 + (width - boxW) / 2
        val y0 = 20 + (height - boxH) / 2
        for (x in x0..x0 + boxW step 2) {
            for (y in y0..y0 + boxH step 2) {
                val c = bmp.getColor(x, y)
                val l = luminance(((c shr 16) and 0xFF) / 255f, ((c shr 8) and 0xFF) / 255f, (c and 0xFF) / 255f)
                worst = minOf(worst, contrast(ink, l))
            }
        }
        return worst
    }

    private class Ratios(
        val ink: Float,
        val ink2: Float,
    )

    // The worst ratio over a black and a white backdrop.
    private fun ratios(
        w: Int,
        h: Int,
        style: LiquidGlassStyle,
        dark: Boolean,
        pressed: Boolean,
    ): Ratios {
        val colors = if (dark) UiColors.Dark else UiColors.Light
        val ink = luminance(colors.ink.red, colors.ink.green, colors.ink.blue)
        val ink2 = luminance(colors.ink2.red, colors.ink2.green, colors.ink2.blue)
        var a = Float.MAX_VALUE
        var b = Float.MAX_VALUE
        for (backdrop in listOf(Color.Black, Color.White)) {
            val bmp = render(backdrop, w.dp, h.dp, SurfaceMaterial.Liquid, style, dark, pressed)
            a = minOf(a, worst(bmp, w, h, ink))
            b = minOf(b, worst(bmp, w, h, ink2))
        }
        return Ratios(a, b)
    }

    private val presets =
        listOf("Regular" to LiquidGlassStyle.Regular, "Clear" to LiquidGlassStyle.Clear, "Thick" to LiquidGlassStyle.Thick)

    // Circles and pills of the sizes controls come in, and a card.
    private val sizes = listOf(56 to 56, 120 to 44, 160 to 56, 160 to 64, 200 to 120)

    @Test fun thePresetsClaimTheGuaranteeAndKeepPrimaryInkLegibleOnEverySize() {
        for ((name, style) in presets) {
            assertTrue(style.preservesContrast, "$name claims the contrast guarantee")
            for (dark in listOf(false, true)) {
                for ((w, h) in sizes) {
                    val r = ratios(w, h, style, dark, pressed = false)
                    assertTrue(r.ink >= 4.5f, "$name dark=$dark ${w}x$h: ink ${r.ink} < 4.5 over the text area")
                }
            }
        }
    }

    @Test fun secondaryInkHoldsOnSurfacesLargeEnoughForTheFlatMiddle() {
        for ((name, style) in presets) {
            for (dark in listOf(false, true)) {
                val r = ratios(200, 120, style, dark, pressed = false)
                // Grain moves single pixels by a few levels; 5% covers it.
                assertTrue(r.ink2 >= 4.5f * 0.95f, "$name dark=$dark: ink2 ${r.ink2} on a 200x120 surface")
            }
        }
    }

    @Test fun aPressedSurfaceKeepsPrimaryInkAboveThreeToOne() {
        for ((name, style) in presets) {
            for (dark in listOf(false, true)) {
                for ((w, h) in sizes) {
                    val r = ratios(w, h, style, dark, pressed = true)
                    assertTrue(r.ink >= 3f, "$name dark=$dark ${w}x$h pressed: ink ${r.ink} < 3")
                }
            }
        }
    }

    @Test fun aDeepBevelCannotThinTheVeilUnderTheTextOfASmallPill() {
        val deep = LiquidGlassStyle(bevelWidth = 60.dp)
        val shallow = LiquidGlassStyle(bevelWidth = 14.dp)
        for (dark in listOf(false, true)) {
            val d = ratios(120, 44, deep, dark, pressed = false)
            val s = ratios(120, 44, shallow, dark, pressed = false)
            assertTrue(d.ink >= 4.5f, "dark=$dark: a 60dp bevel on a 44dp pill leaves ink at ${d.ink}")
            assertTrue(s.ink >= 4.5f, "dark=$dark: shallow bevel ink ${s.ink}")
        }
    }
}
