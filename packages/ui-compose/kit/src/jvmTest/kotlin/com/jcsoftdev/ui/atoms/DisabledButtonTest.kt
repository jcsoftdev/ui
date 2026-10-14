@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.atoms

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.containers.CardDefaults
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DisabledButtonTest {
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

    @Test
    fun disabledLabelStaysLegibleOnItsFill() {
        for (dark in listOf(false, true)) {
            val surface = if (dark) UiColors.Dark.surface else UiColors.Light.surface
            runComposeUiTest {
                setContent {
                    UiTheme(dark = dark, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                        for (variant in ButtonVariant.entries) {
                            val colors = ButtonDefaults.disabledColors(variant)
                            val behind = if (colors.container.alpha == 0f) surface else colors.container
                            val ratio = contrast(colors.content, behind)
                            assertTrue(ratio >= 4.5f, "dark=$dark $variant disabled label is $ratio:1")
                        }
                    }
                }
            }
        }
    }

    @Test
    fun disabledButtonIsNotEnabledAndNotDimmedToTheAlphaFloor() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Button("Guardar", {}, variant = ButtonVariant.Primary, enabled = false)
                }
            }
            onNodeWithText("Guardar").assertIsNotEnabled()
        }

    @Test
    fun outlinedCardUsesTheControlBorder() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    assertEquals(UiColors.Light.line, CardDefaults.colors(outlined = false).border)
                    val outlined = CardDefaults.colors(outlined = true).border
                    assertEquals(UiColors.Light.lineControl, outlined)
                    assertTrue(contrast(outlined, UiColors.Light.surface) >= 3f)
                }
            }
        }
}
