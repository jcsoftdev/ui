@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** Hard black and white stripes: blurred they turn into one grey; unblurred they stay black or white. */
@Composable
private fun Stripes() {
    Row(Modifier.fillMaxSize()) {
        repeat(30) { Box(Modifier.size(8.dp, 120.dp).background(if (it % 2 == 0) Color.Black else Color.White)) }
    }
}

private val Frame = Modifier.size(240.dp, 120.dp)

/** Renders [content] in a fixed frame and returns the red channel of the pixels on the middle row between 1/4 and 3/4 of the width. */
private fun middleRow(
    dark: Boolean = false,
    style: UiStyle = UiStyle.Default,
    reduceTransparency: Boolean = false,
    highContrast: Boolean = false,
    content: @Composable (GlassState) -> Unit,
): List<Int> {
    var row = emptyList<Int>()
    runComposeUiTest {
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Frame.testTag("frame")) {
                    UiTheme(
                        dark = dark,
                        motion = Motion(0f),
                        style = style,
                        reduceTransparency = reduceTransparency,
                        highContrast = highContrast,
                    ) {
                        val glass = rememberGlassState()
                        Box(Modifier.fillMaxSize().glassSource(glass)) { Stripes() }
                        content(glass)
                    }
                }
            }
        }
        waitForIdle()
        val bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
        val y = bmp.height / 2
        row = ((bmp.width / 4)..(bmp.width * 3 / 4)).map { (bmp.getColor(it, y) shr 16) and 0xFF }
    }
    return row
}

private fun List<Int>.spread() = max() - min()

@Composable
private fun Surface(
    material: SurfaceMaterial,
    glass: GlassState?,
) {
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.align(Alignment.Center).fillMaxWidth().height(60.dp)) {
            Box(Modifier.fillMaxSize().material(material, RoundedCornerShape(12.dp), glass = glass))
        }
    }
}

class GlassRenderTest {
    @Test fun glassBlursTheBackdropBehindIt() {
        val blurred = middleRow { Surface(SurfaceMaterial.Glass, it) }
        val tint = middleRow { Surface(SurfaceMaterial.Glass, null) }
        assertTrue(blurred.spread() <= 8, "stripes should be blurred away, spread=${blurred.spread()}")
        assertTrue(tint.spread() > 20, "the tint fallback keeps the stripes visible, spread=${tint.spread()}")
    }

    @Test fun clearGlassBlursToo() {
        assertTrue(middleRow { Surface(SurfaceMaterial.GlassClear, it) }.spread() <= 8)
    }

    @Test fun reducedTransparencyDrawsTheOpaqueFloatColor() {
        val row = middleRow(reduceTransparency = true) { Surface(SurfaceMaterial.Glass, it) }
        assertEquals(0, row.spread())
        assertEquals((UiColors.Light.float.value shr 48).toInt() and 0xFF, row.first())
    }

    @Test fun highContrastDrawsTheOpaqueFloatColor() {
        assertEquals(0, middleRow(highContrast = true) { Surface(SurfaceMaterial.GlassClear, it) }.spread())
    }

    @Test fun solidMaterialIsOpaque() {
        assertEquals(0, middleRow { Surface(SurfaceMaterial.Solid, it) }.spread())
    }

    @Test fun glassInsideGlassFallsBackToTheNearSolidFill() {
        val row =
            middleRow {
                MaterialSurface(SurfaceMaterial.Glass, RoundedCornerShape(12.dp), Modifier.fillMaxSize(), glass = it) {
                    Box(Modifier.fillMaxSize().material(SurfaceMaterial.Glass, RoundedCornerShape(12.dp), glass = it))
                }
            }
        assertEquals(0, row.spread())
    }

    @Test fun cardIsSolidEvenWithTheGlassStyleUnlessItOptsIn() {
        val solid = middleRow(style = UiStyle.Glass) { Card(Modifier.fillMaxSize()) { Box(Modifier.fillMaxSize()) } }
        assertEquals(0, solid.spread())
        val optIn =
            middleRow(style = UiStyle.Glass) {
                CompositionLocalProviderGlass(
                    it,
                ) { Card(Modifier.fillMaxSize(), material = SurfaceMaterial.Glass) { Box(Modifier.fillMaxSize()) } }
            }
        assertNotEquals(solid.first(), optIn.first())
    }

    @Test fun dialogIsGlassOnlyWithTheGlassStyle() {
        fun dialogPixel(style: UiStyle): Int =
            middleRow(style = style) {
                Dialog(open = true, onDismissRequest = {}, title = "T", modifier = Modifier.height(100.dp))
            }.first()
        val opaque = dialogPixel(UiStyle.Default)
        val glass = dialogPixel(UiStyle.Glass)
        assertNotEquals(opaque, glass)
    }
}

@Composable
private fun CompositionLocalProviderGlass(
    glass: GlassState,
    content: @Composable () -> Unit,
) = androidx.compose.runtime.CompositionLocalProvider(LocalGlassState provides glass, content = content)
