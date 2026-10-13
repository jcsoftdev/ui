@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.containers.Card
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.navigation.TopBar
import com.jcsoftdev.ui.overlays.Dialog
import com.jcsoftdev.ui.overlays.LocalOverlayHost
import com.jcsoftdev.ui.overlays.Sheet
import com.jcsoftdev.ui.overlays.Toaster
import com.jcsoftdev.ui.primitives.ToastHostState
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** Hard black and white stripes: blurred they turn into one grey; unblurred they stay black or white. */
@Composable
private fun Stripes() {
    Row(Modifier.fillMaxSize()) {
        repeat(30) { Box(Modifier.size(8.dp, 120.dp).background(if (it % 2 == 0) Color.Black else Color.White)) }
    }
}

private fun Bitmap.r(
    x: Int,
    y: Int,
) = (getColor(x, y) shr 16) and 0xFF

private fun Bitmap.g(
    x: Int,
    y: Int,
) = (getColor(x, y) shr 8) and 0xFF

private fun Bitmap.b(
    x: Int,
    y: Int,
) = getColor(x, y) and 0xFF

private fun Bitmap.row(
    from: Int,
    to: Int,
    y: Int = height / 2,
) = (from..to).map { r(it, y) }

private fun List<Int>.spread() = max() - min()

private val FloatRed = (UiColors.Light.float.value shr 48).toInt() and 0xFF

/** Renders [content] in a fixed frame inside a theme (the host's content layer is the first child) and returns the pixels. */
private fun render(
    width: Dp = 240.dp,
    height: Dp = 120.dp,
    dark: Boolean = false,
    style: UiStyle = UiStyle.Default,
    reduceTransparency: Boolean = false,
    highContrast: Boolean = false,
    content: @Composable () -> Unit,
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(width, height).testTag("frame")) {
                    UiTheme(
                        dark = dark,
                        motion = Motion(0f),
                        style = style,
                        reduceTransparency = reduceTransparency,
                        highContrast = highContrast,
                        content = content,
                    )
                }
            }
        }
        waitForIdle()
        bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
    }
    return bmp
}

/** Backdrop [source] under an explicit glass state, then [surface] on top. */
@Composable
private fun WithSource(
    source: @Composable () -> Unit = { Stripes() },
    surface: @Composable (GlassState) -> Unit,
) {
    val glass = rememberGlassState()
    Box(Modifier.fillMaxSize().glassSource(glass)) { source() }
    surface(glass)
}

@Composable
private fun Band(
    material: SurfaceMaterial,
    glass: GlassState?,
    modifier: Modifier = Modifier.fillMaxWidth(),
) {
    Box(Modifier.fillMaxSize()) {
        Box(modifier.align(Alignment.Center).height(60.dp)) {
            Box(Modifier.fillMaxSize().material(material, RoundedCornerShape(12.dp), glass = glass))
        }
    }
}

class GlassRenderTest {
    @Test fun glassBlursTheBackdropBehindIt() {
        val blurred = render { WithSource { Band(SurfaceMaterial.Glass, it) } }.row(60, 180)
        val tint = render { WithSource { Band(SurfaceMaterial.Glass, null) } }.row(60, 180)
        assertTrue(blurred.spread() <= 8, "stripes should be blurred away, spread=${blurred.spread()}")
        assertTrue(tint.spread() in 10..40, "the tint fallback is a mostly opaque veil, spread=${tint.spread()}")
    }

    @Test fun clearGlassBlursToo() {
        assertTrue(render { WithSource { Band(SurfaceMaterial.GlassClear, it) } }.row(60, 180).spread() <= 8)
    }

    @Test fun contentUnderANonOpaqueSourceDoesNotShowThroughTheGlass() {
        // The stripes are drawn outside the source, which itself is empty: only an opaque base hides them.
        val row =
            render {
                Stripes()
                WithSource(source = {}) { Band(SurfaceMaterial.Glass, it) }
            }.row(60, 180)
        assertTrue(row.spread() <= 2, "ghosting, spread=${row.spread()}")
    }

    @Test fun theBlurNeverSamplesPastTheSourceBounds() {
        // The source covers the left half only; the right half of the band must not pick up the stripes behind it.
        val bmp =
            render {
                Stripes()
                val glass = rememberGlassState()
                Box(Modifier.width(120.dp).fillMaxHeight().glassSource(glass)) { Stripes() }
                Band(SurfaceMaterial.Glass, glass)
            }
        val row = bmp.row(150, 230)
        val steepest = row.zipWithNext { a, b -> kotlin.math.abs(a - b) }.max()
        assertTrue(steepest <= 3, "stripes leaked past the source, steepest step=$steepest")
    }

    @Test fun theBackdropIsAlignedWithTheSurface() {
        // Left half red, right half blue; a surface over the blue half must show blue, not the red at the origin.
        val bmp =
            render {
                WithSource(source = {
                    Row(Modifier.fillMaxSize()) {
                        Box(Modifier.width(120.dp).fillMaxHeight().background(Color.Red))
                        Box(Modifier.fillMaxSize().background(Color.Blue))
                    }
                }) { glass ->
                    Box(Modifier.fillMaxSize()) {
                        Box(Modifier.align(Alignment.CenterEnd).width(70.dp).height(60.dp)) {
                            Box(Modifier.fillMaxSize().material(SurfaceMaterial.Glass, RoundedCornerShape(12.dp), glass = glass))
                        }
                    }
                }
            }
        assertTrue(bmp.b(205, 60) > bmp.r(205, 60) + 30, "backdrop offset ignored: r=${bmp.r(205, 60)} b=${bmp.b(205, 60)}")
    }

    @Test fun reducedTransparencyDrawsTheOpaqueFloatColor() {
        val row = render(reduceTransparency = true) { WithSource { Band(SurfaceMaterial.Glass, it) } }.row(60, 180)
        assertEquals(0, row.spread())
        assertEquals(FloatRed, row.first())
    }

    @Test fun highContrastDrawsAStrongerBorderThanReducedTransparency() {
        fun edge(
            reduce: Boolean,
            high: Boolean,
        ) = render(reduceTransparency = reduce, highContrast = high) {
            WithSource { Band(SurfaceMaterial.GlassClear, it, Modifier.width(240.dp)) }
        }.let { it to it.r(0, it.height / 2) }
        val (_, high) = edge(false, true)
        val (_, reduced) = edge(true, false)
        assertNotEquals(high, reduced, "high contrast must use the strong border")
        assertTrue(high < reduced, "strong border is darker: $high vs $reduced")
    }

    @Test fun solidMaterialIsOpaque() {
        assertEquals(0, render { WithSource { Band(SurfaceMaterial.Solid, it) } }.row(60, 180).spread())
    }

    @Test fun glassInsideGlassFallsBackToTheNearSolidFill() {
        val row =
            render {
                WithSource {
                    MaterialSurface(SurfaceMaterial.Glass, RoundedCornerShape(12.dp), Modifier.fillMaxSize(), glass = it) {
                        Box(Modifier.fillMaxSize().material(SurfaceMaterial.Glass, RoundedCornerShape(12.dp), glass = it))
                    }
                }
            }.row(60, 180)
        assertEquals(0, row.spread())
        assertEquals(FloatRed, row.first())
    }

    @Test fun cardIsSolidEvenWithTheGlassStyleUnlessItOptsIn() {
        val solid = render(style = UiStyle.Glass) { WithSource { Card(Modifier.fillMaxSize()) { Box(Modifier.fillMaxSize()) } } }
        assertEquals(0, solid.row(60, 180, 100).spread())
        val optIn =
            render(style = UiStyle.Glass) {
                WithSource {
                    CompositionLocalProvider(LocalGlassState provides it) {
                        Card(Modifier.fillMaxSize(), material = SurfaceMaterial.Glass) { Box(Modifier.fillMaxSize()) }
                    }
                }
            }
        assertNotEquals(solid.r(60, 100), optIn.r(60, 100))
    }

    @Test fun dialogIsGlassOnlyWithTheGlassStyle() {
        fun pixel(
            style: UiStyle,
            material: SurfaceMaterial? = null,
        ) = render(height = 160.dp, style = style) {
            Stripes()
            Dialog(open = true, onDismissRequest = {}, title = "T", modifier = Modifier.height(100.dp), material = material)
        }.r(30, 80)
        assertEquals(FloatRed, pixel(UiStyle.Default))
        assertNotEquals(FloatRed, pixel(UiStyle.Glass))
        assertEquals(FloatRed, pixel(UiStyle.Glass, SurfaceMaterial.Solid))
        assertNotEquals(FloatRed, pixel(UiStyle.Default, SurfaceMaterial.Glass))
    }

    @Test fun sheetHonorsTheStyleAndTheMaterialParameter() {
        fun pixel(
            style: UiStyle,
            material: SurfaceMaterial? = null,
        ) = render(width = 300.dp, height = 400.dp, style = style) {
            Stripes()
            Sheet(open = true, onDismiss = {}, title = "S", material = material) { Box(Modifier.height(240.dp)) }
        }.r(10, 380)
        assertEquals(FloatRed, pixel(UiStyle.Default))
        assertNotEquals(FloatRed, pixel(UiStyle.Glass))
        assertEquals(FloatRed, pixel(UiStyle.Glass, SurfaceMaterial.Solid))
        assertNotEquals(FloatRed, pixel(UiStyle.Default, SurfaceMaterial.Glass))
    }

    @Test fun topBarHonorsTheStyleAndTheMaterialParameter() {
        fun pixel(
            style: UiStyle,
            material: SurfaceMaterial? = null,
        ) = render(style = style) {
            WithSource { TopBar("T", glass = it, material = material) }
        }.r(200, 28)
        assertEquals(FloatRed, pixel(UiStyle.Default))
        assertNotEquals(FloatRed, pixel(UiStyle.Glass))
        assertEquals(FloatRed, pixel(UiStyle.Glass, SurfaceMaterial.Solid))
        assertNotEquals(FloatRed, pixel(UiStyle.Default, SurfaceMaterial.Glass))
    }

    @Test fun toasterHonorsTheStyleAndTheMaterialParameter() {
        fun luminance(
            style: UiStyle,
            material: SurfaceMaterial? = null,
        ): Int {
            var value = 0
            runComposeUiTest {
                setContent {
                    Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                        Box(Modifier.size(300.dp, 200.dp).testTag("frame")) {
                            UiTheme(dark = false, motion = Motion(0f), style = style) {
                                Stripes()
                                val toasts =
                                    androidx.compose.runtime.remember {
                                        ToastHostState().apply { success("Saved", durationMillis = ToastHostState.INDEFINITE) }
                                    }
                                Toaster(toasts, material = material)
                            }
                        }
                    }
                }
                waitForIdle()
                val bounds = onNodeWithText("Saved").fetchSemanticsNode().boundsInRoot
                val bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
                value = bmp.r((bounds.left - 4).toInt(), bounds.center.y.toInt())
            }
            return value
        }
        assertTrue(luminance(UiStyle.Default) < 90, "default toast is the dark inverse surface")
        assertTrue(luminance(UiStyle.Glass) > 140, "glass toast is light: ${luminance(UiStyle.Glass)}")
        assertTrue(luminance(UiStyle.Glass, SurfaceMaterial.Solid) < 90)
        assertTrue(luminance(UiStyle.Default, SurfaceMaterial.Glass) > 140)
    }

    @Test fun glassInsideAnOpaqueSheetDoesNotSampleThePageBehindIt() {
        val bmp =
            render(width = 300.dp, height = 400.dp) {
                Box(Modifier.fillMaxSize().background(Color.Red))
                Sheet(open = true, onDismiss = {}, title = "S") {
                    Card(Modifier.fillMaxWidth().height(200.dp), material = SurfaceMaterial.Glass) { Box(Modifier.fillMaxSize()) }
                }
            }
        val x = 150
        val y = 330
        assertTrue(bmp.r(x, y) - bmp.b(x, y) < 12, "the card shows the red page behind the sheet: r=${bmp.r(x, y)} b=${bmp.b(x, y)}")
    }

    @Test fun sourceIsRecordedOnlyWhileASurfaceNeedsIt() {
        lateinit var glass: GlassState
        runComposeUiTest {
            var show by mutableStateOf(true)
            setContent {
                Box(Modifier.size(100.dp)) {
                    UiTheme(dark = false, motion = Motion(0f)) {
                        glass = rememberGlassState()
                        Box(Modifier.fillMaxSize().glassSource(glass)) { Stripes() }
                        if (show) Band(SurfaceMaterial.Glass, glass)
                    }
                }
            }
            waitForIdle()
            assertTrue(glass.isRecording, "a blurring surface is composed")
            assertTrue(glass.recordings > 0)
            show = false
            waitForIdle()
            assertFalse(glass.isRecording, "the consumer left")
            val before = glass.recordings
            show = true
            waitForIdle()
            assertTrue(glass.isRecording)
            assertTrue(glass.recordings > before)
        }
    }

    @Test fun nothingIsRecordedWithoutABlurringSurface() {
        lateinit var glass: GlassState
        runComposeUiTest {
            setContent {
                Box(Modifier.size(100.dp)) {
                    UiTheme(dark = false, motion = Motion(0f)) {
                        glass = rememberGlassState()
                        Box(Modifier.fillMaxSize().glassSource(glass)) { Stripes() }
                        Band(SurfaceMaterial.Solid, glass)
                        Band(SurfaceMaterial.Glass, null)
                    }
                }
            }
            waitForIdle()
            assertFalse(glass.isRecording)
            assertEquals(0, glass.recordings)
        }
    }

    @Test fun dialogBackdropFollowsItsEnterAnimation() {
        lateinit var glass: GlassState
        runComposeUiTest {
            mainClock.autoAdvance = false
            var open by mutableStateOf(false)
            setContent {
                Box(Modifier.size(300.dp, 300.dp)) {
                    UiTheme(dark = false, motion = Motion(1f), style = UiStyle.Glass) {
                        glass = requireNotNull(LocalOverlayHost.current).glass
                        Stripes()
                        Dialog(open = open, onDismissRequest = {}, title = "T")
                    }
                }
            }
            mainClock.advanceTimeByFrame()
            open = true
            mainClock.advanceTimeByFrame()
            mainClock.advanceTimeBy(40)
            val a = glass.surfaceDraws
            mainClock.advanceTimeBy(48)
            mainClock.advanceTimeBy(48)
            assertTrue(glass.surfaceDraws >= a + 2, "the surface should redraw while the dialog animates: $a -> ${glass.surfaceDraws}")
        }
    }
}
