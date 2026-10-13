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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertTrue

/** The same red/blue scene as [LiquidRenderTest], with the surface drawn in [style]. */
private fun styled(
    style: LiquidGlass,
    motion: Float = 0f,
    press: PressInteraction.Press? = null,
    drag: Boolean = false,
    gradient: Boolean = false,
    shape: Shape = RoundedCornerShape(16.dp),
    withGlass: Boolean = true,
    holdDrag: Boolean = false,
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        val source = MutableInteractionSource()
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(240.dp, 120.dp).testTag("frame")) {
                    UiTheme(dark = false, motion = Motion(motion)) {
                        val glass = rememberGlassState()
                        Box(Modifier.fillMaxSize().glassSource(glass)) {
                            if (gradient) {
                                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color.Black, Color.Red))))
                            } else {
                                Row(Modifier.fillMaxSize()) {
                                    Box(Modifier.width(122.dp).fillMaxHeight().background(Color.Red))
                                    Box(Modifier.fillMaxSize().background(Color.Blue))
                                }
                            }
                        }
                        Box(
                            Modifier
                                .offset(110.dp, 30.dp)
                                .wrapContentSize(Alignment.TopStart)
                                .size(120.dp, 60.dp)
                                .testTag("surface"),
                        ) {
                            Box(
                                Modifier.fillMaxSize().material(
                                    style,
                                    shape,
                                    glass = if (withGlass) glass else null,
                                    interactionSource = source,
                                ),
                            )
                        }
                    }
                }
            }
        }
        if (press != null) runOnIdle { source.tryEmit(press) }
        if (holdDrag) {
            // Capture while the finger is still down, a few frames into the drag.
            mainClock.autoAdvance = false
            onNodeWithTag("surface").performTouchInput { down(center) }
            repeat(4) {
                onNodeWithTag("surface").performTouchInput { moveBy(Offset(50f, 0f), delayMillis = 16) }
                mainClock.advanceTimeBy(16)
            }
            mainClock.advanceTimeBy(48)
        } else {
            if (drag) {
                onNodeWithTag("surface").performTouchInput {
                    down(center)
                    moveBy(Offset(40f, 0f), delayMillis = 16)
                    moveBy(Offset(40f, 0f), delayMillis = 16)
                    up()
                }
            }
            waitForIdle()
        }
        bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
    }
    return bmp
}

private fun Bitmap.rgb(
    x: Int,
    y: Int,
) = Triple((getColor(x, y) shr 16) and 0xFF, (getColor(x, y) shr 8) and 0xFF, getColor(x, y) and 0xFF)

private fun Bitmap.sameAs(other: Bitmap): Boolean {
    for (x in 0 until width) for (y in 0 until height) if (getColor(x, y) != other.getColor(x, y)) return false
    return true
}

class LiquidStyleRenderTest {
    @Test fun theBaseMaterialWithTheDefaultFeaturesRendersExactlyLikeTheRegularPreset() {
        val spelledOut = LiquidGlass(lens = RefractionLens(), dispersion = Dispersion(), interaction = LiquidInteraction.Press())
        assertTrue(styled(spelledOut).sameAs(styled(LiquidGlass.Regular)))
    }

    @Test fun refractionZeroTurnsTheLensOff() {
        val lensed = styled(LiquidGlass.Regular.copy(lens = RefractionLens(1.5f))).rgb(114, 60)
        val flat = styled(LiquidGlass.Regular.copy(lens = RefractionLens(0f, LiquidProfile.Rim))).rgb(114, 60)
        assertTrue(lensed.third - flat.third > 10, "edge blue lensed=$lensed flat=$flat")
    }

    @Test fun profilesRenderDifferentSurfaces() {
        val full = styled(LiquidGlass.Regular.copy(lens = RefractionLens(profile = LiquidProfile.Full)))
        val rim = styled(LiquidGlass.Regular.copy(lens = RefractionLens(profile = LiquidProfile.Rim)))
        val dome = styled(LiquidGlass.Regular.copy(lens = RefractionLens(profile = LiquidProfile.Dome)))
        assertTrue(!full.sameAs(rim) && !full.sameAs(dome) && !rim.sameAs(dome))
    }

    @Test fun brightnessLiftsTheSurfaceAndFresnelLightsTheRim() {
        val base = styled(LiquidGlass.Regular)
        assertTrue(styled(LiquidGlass.Regular.copy(brightness = 0.2f)).rgb(170, 60).second > base.rgb(170, 60).second)
        assertTrue(styled(LiquidGlass.Regular.copy(fresnel = 1f)).rgb(112, 60).second >= base.rgb(112, 60).second)
    }

    @Test fun aLowOpacityStyleShowsMoreOfTheBackdropInTheMiddle() {
        val normal = styled(LiquidGlass.Regular).rgb(200, 60)
        val faint = styled(LiquidGlass.Regular.copy(opacity = 0.2f)).rgb(200, 60)
        // The veil is white over blue: a fainter veil leaves more blue and less red/green.
        assertTrue(faint.first < normal.first - 20, "normal=$normal faint=$faint")
    }

    @Test fun shadowOpacityZeroRemovesTheShadowAndOffsetPushesItDown() {
        val none = styled(LiquidGlass.Regular.copy(shadow = LiquidShadow(opacity = 0f))).rgb(107, 60).first
        assertTrue(none == 255, "no shadow: $none")
        val down = styled(LiquidGlass.Regular.copy(shadow = LiquidShadow(spread = 16.dp, offsetY = 10.dp)))
        // x=170 sits over the blue half; below the surface (y=90) the offset shadow is darker than above it (y=30).
        val below = down.rgb(170, 94).third
        val above = down.rgb(170, 26).third
        assertTrue(below < above, "below=$below above=$above")
    }

    @Test fun frostBlursTheSeamHarder() {
        val sharp = styled(LiquidGlass.Regular.copy(frost = 0.dp, lens = RefractionLens(0f, LiquidProfile.Rim)))
        val soft = styled(LiquidGlass.Regular.copy(frost = 12.dp, lens = RefractionLens(0f, LiquidProfile.Rim)))
        // The red/blue seam is at x=122: a hard blur makes the neighbours at 118 and 126 closer to each other.
        val sharpGap = abs(sharp.rgb(118, 60).first - sharp.rgb(126, 60).first)
        val softGap = abs(soft.rgb(118, 60).first - soft.rgb(126, 60).first)
        assertTrue(softGap < sharpGap, "sharp=$sharpGap soft=$softGap")
    }

    @Test fun reducedMotionKeepsThePressBrightnessButNeverSwellsTheSurface() {
        val idle = styled(LiquidGlass.Regular, motion = 0f)
        val pressed = styled(LiquidGlass.Regular, motion = 0f, press = PressInteraction.Press(Offset(10f, 10f)))
        assertTrue(pressed.rgb(200, 60).first > idle.rgb(200, 60).first, "brightens")
        // No swell: the pixel just outside the surface (3px past the left edge at x=110) is untouched by the surface itself.
        assertTrue(abs(pressed.rgb(106, 60).first - idle.rgb(106, 60).first) <= 2, "no swell outside the edge")
    }

    @Test fun aPressedSurfaceSwellsWhenMotionIsOn() {
        val idle = styled(LiquidGlass.Regular, motion = 1f)
        val pressed = styled(LiquidGlass.Regular, motion = 1f, press = PressInteraction.Press(Offset(10f, 10f)))
        // The default swell is 16dp over a 120dp width (13%): the edge moves out by 8px on each side. 6px past the edge was
        // plain backdrop (and a faint shadow) before; the swollen surface covers it with bright glass.
        val before = idle.rgb(104, 60)
        val after = pressed.rgb(104, 60)
        assertTrue(after.second - before.second > 40, "swell reaches 6px past the resting edge: idle=$before pressed=$after")
        // And it stops there: 12px out is still outside the swollen surface.
        assertTrue(abs(pressed.rgb(98, 60).second - idle.rgb(98, 60).second) < 20, "swell stays within its amount")
    }

    @Test fun swellKeepsTheBackdropUnderTheGlassWhereItWas() {
        val flat =
            LiquidGlass.Regular.copy(
                lens = RefractionLens(0f, LiquidProfile.Rim),
                opacity = 0f,
                dispersion = null,
                frost = 0.dp,
                saturation = 1f,
                rim = 0f,
                interaction = LiquidInteraction.Press(LiquidMotion(glow = 0f)),
            )
        val flatShape = LiquidGlass.Regular.copy(specular = LiquidSpecular(intensity = 0f), shadow = LiquidShadow(opacity = 0f))
        val style = flat.copy(specular = flatShape.specular, shadow = flatShape.shadow)
        val press = PressInteraction.Press(Offset(10f, 10f))
        val still = styled(style, motion = 0f, press = press, gradient = true)
        val swollen = styled(style, motion = 1f, press = press, gradient = true)
        // Both are pressed (same brightening); only the swell differs. The surface spans x=110..230; the same screen pixel must
        // show the same backdrop whether or not the layer is scaled: at the centre and a quarter of the width to either side.
        for (x in listOf(140, 170, 200)) {
            val a = still.rgb(x, 60).first
            val b = swollen.rgb(x, 60).first
            assertTrue(abs(a - b) <= 3, "x=$x: backdrop shifted under the swollen glass (still=$a swollen=$b)")
        }
    }

    @Test fun aDragSquashesWhileTheFingerMovesAndSettlesBackAfterwards() {
        val style = LiquidGlass.Regular.copy(interaction = LiquidInteraction.Drag())
        val rest = styled(style, motion = 1f)
        val moving = styled(style, motion = 1f, holdDrag = true)
        // The resting surface starts at x=110; stretched along the drag it is wider, so a pixel 8px outside it turns to glass.
        val before = rest.rgb(102, 60)
        val during = moving.rgb(102, 60)
        assertTrue(during.second - before.second > 30, "the surface stretched mid-drag: rest=$before moving=$during")
    }

    // ---- shadows ----

    private class Blob : Shape {
        override fun createOutline(
            size: androidx.compose.ui.geometry.Size,
            layoutDirection: androidx.compose.ui.unit.LayoutDirection,
            density: androidx.compose.ui.unit.Density,
        ): androidx.compose.ui.graphics.Outline =
            androidx.compose.ui.graphics.Outline.Generic(
                androidx.compose.ui.graphics.Path().apply {
                    moveTo(size.width * 0.1f, 0f)
                    lineTo(size.width, 0f)
                    lineTo(size.width * 0.9f, size.height)
                    lineTo(0f, size.height)
                    close()
                },
            )
    }

    @Test fun aFreeFormShapeCastsAShadowToo() {
        val withShadow = styled(LiquidGlass.Regular, shape = Blob())
        val without = styled(LiquidGlass.Regular.copy(shadow = LiquidShadow(opacity = 0f)), shape = Blob())
        // 6px below the bottom edge (y=90), under the surface, over the blue half.
        assertTrue(withShadow.rgb(170, 96).third < without.rgb(170, 96).third - 6, "shadow under a Generic outline")
    }

    @Test fun theShadowNeverDarkensTheInsideOfATranslucentTint() {
        // Without a backdrop the glass is a tint over whatever is below; a shadow stack drawn under it would darken the middle.
        val shadowed = styled(LiquidGlass.Regular, withGlass = false).rgb(170, 60)
        val unshadowed = styled(LiquidGlass.Regular.copy(shadow = LiquidShadow(opacity = 0f)), withGlass = false).rgb(170, 60)
        assertTrue(abs(shadowed.first - unshadowed.first) <= 1 && abs(shadowed.third - unshadowed.third) <= 1, "$shadowed vs $unshadowed")
    }
}
