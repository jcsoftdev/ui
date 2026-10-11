@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.theme

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
import com.jcsoftdev.ui.atoms.Avatar
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Chip
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.foundation.Motion
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class CustomizationUiTest {
    @Composable
    private fun ComposeHost(
        theme: @Composable (
            @Composable () -> Unit,
        ) -> Unit = { UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f), content = it) },
        content: @Composable () -> Unit,
    ) = theme { Column { content() } }

    @Test
    fun defaultsKeepTheKitSizes() =
        runComposeUiTest {
            setContent {
                ComposeHost {
                    Button("md", {}, Modifier.testTag("md"))
                    Button("lg", {}, Modifier.testTag("lg"), size = ButtonSize.Lg)
                    Chip("chip", Modifier.testTag("chip"))
                    Switch(true, {}, Modifier.testTag("switch"))
                    Avatar("Ana Ruiz", Modifier.testTag("avatar"))
                }
            }
            onNodeWithTag("md").assertHeightIsEqualTo(48.dp)
            onNodeWithTag("lg").assertHeightIsEqualTo(52.dp)
            onNodeWithTag("chip").assertHeightIsEqualTo(24.dp)
            onNodeWithTag("switch").assertWidthIsEqualTo(48.dp).assertHeightIsEqualTo(48.dp)
            onNodeWithTag("avatar").assertWidthIsEqualTo(26.dp).assertHeightIsEqualTo(26.dp)
        }

    @Test
    fun themeSizesChangeEveryComponent() =
        runComposeUiTest {
            val sizes = ThemeSizes.Default.copy(minTouchTarget = 64.dp, controlHeightLg = 70.dp)
            setContent {
                ComposeHost({ UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f), sizes = sizes, content = it) }) {
                    Button("md", {}, Modifier.testTag("md"))
                    Button("lg", {}, Modifier.testTag("lg"), size = ButtonSize.Lg)
                    Switch(true, {}, Modifier.testTag("switch"))
                }
            }
            onNodeWithTag("md").assertHeightIsEqualTo(64.dp)
            onNodeWithTag("lg").assertHeightIsEqualTo(70.dp)
            onNodeWithTag("switch").assertWidthIsEqualTo(64.dp)
        }

    @Test
    fun perInstanceDefaultsOverrideMetrics() =
        runComposeUiTest {
            setContent {
                ComposeHost {
                    Button("a", {}, Modifier.testTag("tall"), height = 80.dp)
                    Avatar("Ana Ruiz", Modifier.testTag("avatar"), diameter = 40.dp)
                    Switch(true, {}, Modifier.testTag("switch"), trackSize = DpSize(60.dp, 30.dp))
                    Chip("same", Modifier.testTag("narrow"))
                    Chip("same", Modifier.testTag("wide"), contentPadding = PaddingValues(horizontal = 30.dp))
                }
            }
            onNodeWithTag("tall").assertHeightIsEqualTo(80.dp)
            onNodeWithTag("avatar").assertWidthIsEqualTo(40.dp)
            onNodeWithTag("switch").assertWidthIsEqualTo(60.dp).assertHeightIsEqualTo(48.dp)
            val narrow = onNodeWithTag("narrow").getUnclippedBoundsInRoot().width
            val wide = onNodeWithTag("wide").getUnclippedBoundsInRoot().width
            assertEquals(40.dp, wide - narrow)
        }

    /** Reads the fill of the 48dp-high button node at its vertical middle, 6px in, which is inside the 12dp corner radius. */
    private fun androidx.compose.ui.test.ComposeUiTest.middleLeftPixel(tag: String): Color {
        val map = onNodeWithTag(tag).captureToImage().toPixelMap()
        return map[6, map.height / 2]
    }

    @Test
    fun colorOverridesChangeRenderedFill() =
        runComposeUiTest {
            val red = Color(0xFFD32F2F)
            val green = Color(0xFF2E7D32)
            setContent {
                ComposeHost {
                    Button("kit", {}, Modifier.testTag("kit"), variant = ButtonVariant.Primary)
                    UiTheme(
                        dark = false,
                        colors = UiColors.Light.copy(accent = red),
                        fontFamily = FontFamily.Default,
                        motion = Motion(0f),
                    ) {
                        Button("theme", {}, Modifier.testTag("theme"), variant = ButtonVariant.Primary)
                    }
                    Button(
                        "instance",
                        {},
                        Modifier.testTag("instance"),
                        variant = ButtonVariant.Primary,
                        colors = ButtonDefaults.colors(ButtonVariant.Primary).copy(container = green),
                    )
                }
            }
            assertEquals(UiColors.Light.accent, middleLeftPixel("kit"))
            assertEquals(red, middleLeftPixel("theme"))
            assertEquals(green, middleLeftPixel("instance"))
        }

    @Test
    fun shapeOverrideChangesTheCorner() =
        runComposeUiTest {
            var density = 1f
            setContent {
                density = LocalDensity.current.density
                ComposeHost {
                    Button("round", {}, Modifier.testTag("round"), variant = ButtonVariant.Primary)
                    Button("square", {}, Modifier.testTag("square"), variant = ButtonVariant.Primary, shape = RectangleShape)
                    UiTheme(
                        dark = false,
                        shapes = ThemeShapes.Default.copy(control = RoundedCornerShape(0.dp)),
                        fontFamily = FontFamily.Default,
                        motion = Motion(0f),
                    ) {
                        Button("themed", {}, Modifier.testTag("themed"), variant = ButtonVariant.Primary)
                    }
                }
            }
            val inset = ((48 - 36) / 2 * density).toInt() + 1

            fun corner(tag: String) = onNodeWithTag(tag).captureToImage().toPixelMap()[1, inset]
            val accent = UiColors.Light.accent
            assertNotEquals(accent, corner("round"))
            assertEquals(accent, corner("square"))
            assertEquals(accent, corner("themed"))
        }

    @Test
    fun partialThemeOverrideLeavesOtherGroupsAlone() {
        val colors = UiColors.Light.copy(accent = Color.Red)
        assertEquals(Color.Red, colors.accent)
        assertEquals(UiColors.Light.ink, colors.ink)
        assertEquals(UiShapes.control, ThemeShapes.Default.control)
        assertEquals(UiSizes.controlHeight, ThemeSizes.Default.controlHeight)
        assertEquals(UiTypography.body, ThemeTypography.Default.body)
        assertEquals(48.dp, ThemeSizes.Default.minTouchTarget)
    }
}
