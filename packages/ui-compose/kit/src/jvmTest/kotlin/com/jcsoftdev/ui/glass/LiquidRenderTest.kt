@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertTrue

private fun px(
    b: Bitmap,
    x: Int,
    y: Int,
) = Triple((b.getColor(x, y) shr 16) and 0xFF, (b.getColor(x, y) shr 8) and 0xFF, b.getColor(x, y) and 0xFF)

/** Red left of x=130, blue to the right; a 120x60 surface sits at x=110..230, so the red/blue seam is 20px inside its left edge. */
private fun scene(
    material: SurfaceMaterial,
    lens: Boolean = true,
    press: PressInteraction.Press? = null,
    motion: Float = 0f,
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        val source = MutableInteractionSource()
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(240.dp, 120.dp).testTag("frame")) {
                    UiTheme(dark = false, motion = Motion(motion)) {
                        CompositionLocalProvider(LocalLensSupport provides lens) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass)) {
                                Row(Modifier.fillMaxSize()) {
                                    Box(Modifier.width(130.dp).fillMaxHeight().background(Color.Red))
                                    Box(Modifier.fillMaxSize().background(Color.Blue))
                                }
                            }
                            Box(Modifier.offset(110.dp, 30.dp).size(120.dp, 60.dp)) {
                                Box(
                                    Modifier.fillMaxSize().material(
                                        material,
                                        RoundedCornerShape(16.dp),
                                        glass = glass,
                                        interactionSource = source,
                                    ),
                                )
                            }
                        }
                    }
                }
            }
        }
        if (press != null) runOnIdle { source.tryEmit(press) }
        waitForIdle()
        bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
    }
    return bmp
}

private fun Bitmap.rgb(
    x: Int,
    y: Int,
) = px(this, x, y)

private fun Bitmap.sameAs(other: Bitmap): Boolean =
    org.jetbrains.skia.Image
        .makeFromBitmap(this)
        .encodeToData()!!
        .bytes
        .contentEquals(
            org.jetbrains.skia.Image
                .makeFromBitmap(other)
                .encodeToData()!!
                .bytes,
        )

class LiquidRenderTest {
    @Test fun lensDisplacesThePixelsNearTheEdge() {
        val lens = scene(SurfaceMaterial.Liquid, lens = true).rgb(114, 60)
        val flat = scene(SurfaceMaterial.Liquid, lens = false).rgb(114, 60)
        // The edge pulls in the blue from across the seam, so blue rises a lot compared with the plain blur.
        assertTrue(lens.third - flat.third > 20, "edge blue: lens=$lens flat=$flat")
    }

    @Test fun lensLeavesTheCenterAlone() {
        val lens = scene(SurfaceMaterial.Liquid, lens = true).rgb(200, 60)
        val flat = scene(SurfaceMaterial.Liquid, lens = false).rgb(200, 60)
        assertTrue(abs(lens.first - flat.first) <= 2 && abs(lens.third - flat.third) <= 2, "center: lens=$lens flat=$flat")
    }

    @Test fun frostedRenderingIgnoresTheLensSwitch() {
        assertTrue(scene(SurfaceMaterial.Glass, lens = true).sameAs(scene(SurfaceMaterial.Glass, lens = false)))
        assertTrue(scene(SurfaceMaterial.GlassClear, lens = true).sameAs(scene(SurfaceMaterial.GlassClear, lens = false)))
    }

    @Test fun liquidDiffersFromFrosted() {
        assertTrue(!scene(SurfaceMaterial.Liquid).sameAs(scene(SurfaceMaterial.Glass)))
    }

    @Test fun pressBrightensTheLiquidSurface() {
        val idle = scene(SurfaceMaterial.Liquid, motion = 1f).rgb(200, 60)
        val pressed = scene(SurfaceMaterial.Liquid, motion = 1f, press = PressInteraction.Press(Offset.Zero)).rgb(200, 60)
        assertTrue(pressed.first > idle.first, "press: idle=$idle pressed=$pressed")
    }

    @Test fun liquidCastsAnOuterShadowAndFrostedDoesNot() {
        // The surface starts at x=110 over a pure red backdrop; 3px outside it only the Liquid shadow darkens the red.
        val liquid = scene(SurfaceMaterial.Liquid).rgb(107, 60).first
        val frosted = scene(SurfaceMaterial.Glass).rgb(107, 60).first
        assertTrue(frosted == 255, "frosted must leave the backdrop alone: $frosted")
        assertTrue(liquid <= 251, "liquid shadow missing: $liquid")
    }

    @Test fun theThemeDefaultsToTheFrostedVariant() {
        var seen: GlassVariant? = null
        runComposeUiTest {
            setContent { UiTheme { seen = LocalGlassVariant.current } }
            waitForIdle()
        }
        assertTrue(seen == GlassVariant.Frosted, "default variant: $seen")
    }
}
