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
import androidx.compose.ui.graphics.Color
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

/** The same red/blue scene as [LiquidRenderTest], with a [LiquidGlassStyle] given to the theme. */
private fun styled(
    style: LiquidGlassStyle,
    material: SurfaceMaterial = SurfaceMaterial.Liquid,
    motion: Float = 0f,
    press: PressInteraction.Press? = null,
    drag: Boolean = false,
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        val source = MutableInteractionSource()
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(240.dp, 120.dp).testTag("frame")) {
                    UiTheme(dark = false, motion = Motion(motion), liquidGlassStyle = style) {
                        val glass = rememberGlassState()
                        Box(Modifier.fillMaxSize().glassSource(glass)) {
                            Row(Modifier.fillMaxSize()) {
                                Box(Modifier.width(122.dp).fillMaxHeight().background(Color.Red))
                                Box(Modifier.fillMaxSize().background(Color.Blue))
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
        if (press != null) runOnIdle { source.tryEmit(press) }
        if (drag) {
            onNodeWithTag("surface").performTouchInput {
                down(center)
                moveBy(Offset(40f, 0f), delayMillis = 16)
                moveBy(Offset(40f, 0f), delayMillis = 16)
                up()
            }
        }
        waitForIdle()
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
    @Test fun theDefaultStyleRendersExactlyLikeTheRegularPreset() {
        assertTrue(styled(LiquidGlassStyle()).sameAs(styled(LiquidGlassStyle.Regular)))
    }

    @Test fun refractionZeroTurnsTheLensOff() {
        val lensed = styled(LiquidGlassStyle(refraction = 1.5f)).rgb(114, 60)
        val flat = styled(LiquidGlassStyle(refraction = 0f, profile = LiquidProfile.Rim)).rgb(114, 60)
        assertTrue(lensed.third - flat.third > 10, "edge blue lensed=$lensed flat=$flat")
    }

    @Test fun profilesRenderDifferentSurfaces() {
        val full = styled(LiquidGlassStyle(profile = LiquidProfile.Full))
        val rim = styled(LiquidGlassStyle(profile = LiquidProfile.Rim))
        val dome = styled(LiquidGlassStyle(profile = LiquidProfile.Dome))
        assertTrue(!full.sameAs(rim) && !full.sameAs(dome) && !rim.sameAs(dome))
    }

    @Test fun brightnessLiftsTheSurfaceAndFresnelLightsTheRim() {
        val base = styled(LiquidGlassStyle())
        assertTrue(styled(LiquidGlassStyle(brightness = 0.2f)).rgb(170, 60).second > base.rgb(170, 60).second)
        assertTrue(styled(LiquidGlassStyle(fresnel = 1f)).rgb(112, 60).second >= base.rgb(112, 60).second)
    }

    @Test fun aLowOpacityStyleShowsMoreOfTheBackdropInTheMiddle() {
        val normal = styled(LiquidGlassStyle()).rgb(200, 60)
        val faint = styled(LiquidGlassStyle(opacity = 0.2f)).rgb(200, 60)
        // The veil is white over blue: a fainter veil leaves more blue and less red/green.
        assertTrue(faint.first < normal.first - 20, "normal=$normal faint=$faint")
    }

    @Test fun shadowOpacityZeroRemovesTheShadowAndOffsetPushesItDown() {
        val none = styled(LiquidGlassStyle(shadow = LiquidShadow(opacity = 0f))).rgb(107, 60).first
        assertTrue(none == 255, "no shadow: $none")
        val down = styled(LiquidGlassStyle(shadow = LiquidShadow(spread = 16.dp, offsetY = 10.dp)))
        // x=170 sits over the blue half; below the surface (y=90) the offset shadow is darker than above it (y=30).
        val below = down.rgb(170, 94).third
        val above = down.rgb(170, 26).third
        assertTrue(below < above, "below=$below above=$above")
    }

    @Test fun frostBlursTheSeamHarder() {
        val sharp = styled(LiquidGlassStyle(frost = 0.dp, refraction = 0f, profile = LiquidProfile.Rim))
        val soft = styled(LiquidGlassStyle(frost = 12.dp, refraction = 0f, profile = LiquidProfile.Rim))
        // The red/blue seam is at x=122: a hard blur makes the neighbours at 118 and 126 closer to each other.
        val sharpGap = abs(sharp.rgb(118, 60).first - sharp.rgb(126, 60).first)
        val softGap = abs(soft.rgb(118, 60).first - soft.rgb(126, 60).first)
        assertTrue(softGap < sharpGap, "sharp=$sharpGap soft=$softGap")
    }

    @Test fun reducedMotionKeepsThePressBrightnessButNeverSwellsTheSurface() {
        val idle = styled(LiquidGlassStyle(), motion = 0f)
        val pressed = styled(LiquidGlassStyle(), motion = 0f, press = PressInteraction.Press(Offset(10f, 10f)))
        assertTrue(pressed.rgb(200, 60).first > idle.rgb(200, 60).first, "brightens")
        // No swell: the pixel just outside the surface (3px past the left edge at x=110) is untouched by the surface itself.
        assertTrue(abs(pressed.rgb(106, 60).first - idle.rgb(106, 60).first) <= 2, "no swell outside the edge")
    }

    @Test fun aPressedSurfaceSwellsWhenMotionIsOn() {
        val idle = styled(LiquidGlassStyle(), motion = 1f).rgb(108, 60)
        val pressed = styled(LiquidGlassStyle(), motion = 1f, press = PressInteraction.Press(Offset(10f, 10f))).rgb(108, 60)
        assertTrue(pressed != idle, "swell reaches past the edge: idle=$idle pressed=$pressed")
    }

    @Test fun aDragSettlesBackToTheRestingSurface() {
        val rest = styled(LiquidGlassStyle(interaction = LiquidInteraction.Drag), motion = 1f)
        val dragged = styled(LiquidGlassStyle(interaction = LiquidInteraction.Drag), motion = 1f, drag = true)
        var worst = 0
        for (x in listOf(100, 112, 140, 200, 235)) {
            for (y in listOf(28, 60, 92)) {
                val a = rest.rgb(x, y)
                val b = dragged.rgb(x, y)
                worst = maxOf(worst, abs(a.first - b.first), abs(a.third - b.third))
            }
        }
        assertTrue(worst <= 3, "after the jelly settles the surface is back: $worst")
    }
}
