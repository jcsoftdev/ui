@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.test.Test
import kotlin.test.assertTrue

/** Two or more 60dp pills over solid red: a pixel that stops being pure red is glass. */
private fun pills(
    count: Int = 2,
    gap: Dp = 16.dp,
    blend: Dp = 60.dp,
    lens: Boolean = true,
    pill: Dp = 60.dp,
    reduceTransparency: Boolean = false,
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(1000.dp, 120.dp).testTag("frame")) {
                    UiTheme(dark = false, motion = Motion(0f), reduceTransparency = reduceTransparency) {
                        CompositionLocalProvider(LocalLensSupport provides lens) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(Color.Red))
                            GlassEffectContainer(Modifier.fillMaxSize(), style = LiquidGlassStyle(blend = blend), glass = glass) {
                                Row(Modifier.offset(40.dp, 30.dp), horizontalArrangement = Arrangement.spacedBy(gap)) {
                                    repeat(count) { Box(Modifier.size(pill).glassEffect(RoundedCornerShape(pill / 2))) }
                                }
                            }
                        }
                    }
                }
            }
        }
        waitForIdle()
        bmp = onNodeWithTag("frame").captureToImage().asSkiaBitmap()
    }
    return bmp
}

private fun Bitmap.isRedBackdrop(
    x: Int,
    y: Int,
) = getColor(x, y) and 0xFFFFFF == 0xFF0000

class GlassEffectContainerTest {
    // First pill x=40..100, second x=116..176; the gap middle is x=108.
    @Test fun neighbouringShapesMergeAcrossTheGap() {
        val merged = pills()
        assertTrue(!merged.isRedBackdrop(108, 60), "the neck must be glass: ${merged.getColor(108, 60).toString(16)}")
        assertTrue(!merged.isRedBackdrop(70, 60) && !merged.isRedBackdrop(146, 60), "both shapes are glass")
        assertTrue(merged.isRedBackdrop(10, 60) && merged.isRedBackdrop(108, 5), "outside stays the backdrop")
    }

    @Test fun shapesFarApartStaySeparate() {
        val apart = pills(gap = 60.dp, blend = 8.dp)
        assertTrue(apart.isRedBackdrop(130, 60), "the gap is empty: ${apart.getColor(130, 60).toString(16)}")
        assertTrue(!apart.isRedBackdrop(70, 60))
    }

    @Test fun withoutTheLensShapesAreDrawnSeparately() {
        val fallback = pills(lens = false)
        assertTrue(!fallback.isRedBackdrop(70, 60) && !fallback.isRedBackdrop(146, 60), "each shape is still glass")
        // 8px from each pill, outside both outlines (the shadow only darkens the red): no bridge.
        val gap = fallback.getColor(108, 60) and 0xFFFFFF
        assertTrue((gap shr 8) and 0xFF == 0 && (gap shr 16) and 0xFF > 150, "no neck without the shader: ${gap.toString(16)}")
    }

    @Test fun reducedTransparencyDrawsSolidShapesNotAMergedLens() {
        val solid = pills(reduceTransparency = true)
        assertTrue(!solid.isRedBackdrop(70, 60), "children fall back to opaque surfaces")
        assertTrue(solid.isRedBackdrop(10, 60))
    }

    @Test fun shapesBeyondTheCapAreDrawnAsTheirOwnSurfaces() {
        // Sixteen shapes merge; the seventeenth is drawn as a surface of its own.
        val many = pills(count = MAX_MERGED_SHAPES + 1, gap = 0.dp, blend = 8.dp, pill = 56.dp)
        val last = 40 + MAX_MERGED_SHAPES * 56 + 28
        assertTrue(last < 1000)
        assertTrue(!many.isRedBackdrop(last, 60), "the 17th shape still shows glass (its own surface)")
        assertTrue(!many.isRedBackdrop(40 + 28, 60))
    }
}
