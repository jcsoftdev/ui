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
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.Bitmap
import kotlin.test.Test
import kotlin.test.assertEquals
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

/** Three 60dp pills 100dp apart (so none merge) in a container with the given look; [child] picks each pill's own look. */
private fun looks(
    containerStyle: LiquidGlassStyle = LiquidGlassStyle(blend = 8.dp),
    containerMaterial: SurfaceMaterial = SurfaceMaterial.Liquid,
    lens: Boolean = true,
    child: (Int) -> Pair<LiquidGlassStyle?, SurfaceMaterial?> = { null to null },
): Bitmap {
    lateinit var bmp: Bitmap
    runComposeUiTest {
        setContent {
            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                Box(Modifier.size(500.dp, 120.dp).testTag("frame")) {
                    UiTheme(dark = false, motion = Motion(0f)) {
                        CompositionLocalProvider(LocalLensSupport provides lens) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(Color.Red))
                            GlassEffectContainer(
                                Modifier.fillMaxSize(),
                                style = containerStyle,
                                material = containerMaterial,
                                glass = glass,
                            ) {
                                Row(Modifier.offset(40.dp, 30.dp), horizontalArrangement = Arrangement.spacedBy(100.dp)) {
                                    repeat(3) { i ->
                                        val (s, m) = child(i)
                                        Box(Modifier.size(60.dp).glassEffect(RoundedCornerShape(30.dp), s, m))
                                    }
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

// The pills' centres: 70, 230, 390.
private fun Bitmap.green(x: Int) = (getColor(x, 60) shr 8) and 0xFF

private fun Bitmap.pixel(x: Int) = getColor(x, 60) and 0xFFFFFF

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

    @Test fun theContainersStyleReachesChildrenThatFallBackToSeparateSurfaces() {
        val blue = LiquidGlassStyle(blend = 8.dp, tint = LiquidTint(Color.Blue))
        val plain = looks(lens = false).pixel(230)
        val tinted = looks(containerStyle = blue, lens = false).pixel(230)
        assertTrue(
            plain != tinted,
            "the fallback surface must use the container style: plain=${plain.toString(16)} tinted=${tinted.toString(16)}",
        )
    }

    @Test fun theContainersMaterialReachesChildrenThatFallBackToSeparateSurfaces() {
        val liquid = looks(lens = false).pixel(230)
        val clear = looks(containerMaterial = SurfaceMaterial.LiquidClear, lens = false).pixel(230)
        assertTrue(liquid != clear, "LiquidClear and Liquid differ in tint: liquid=${liquid.toString(16)} clear=${clear.toString(16)}")
    }

    @Test fun aChildThatAsksForADifferentStyleWinsAndIsNotMerged() {
        val bright = LiquidGlassStyle(blend = 8.dp, brightness = 0.35f)
        val bmp = looks(child = { i -> if (i == 1) bright to null else null to null })
        assertTrue(bmp.green(230) > bmp.green(70) + 15, "middle=${bmp.green(230)} first=${bmp.green(70)} last=${bmp.green(390)}")
        assertTrue(kotlin.math.abs(bmp.green(70) - bmp.green(390)) <= 2, "the others share the container look")
    }

    @Test fun aChildThatRepeatsTheContainersStyleStillMerges() {
        val same = LiquidGlassStyle(blend = 60.dp)
        val bmp =
            pillsWith(same) { _ -> same to SurfaceMaterial.Liquid }
        assertTrue(!bmp.isRedBackdrop(108, 60), "an explicit but equal style still joins the merge")
    }

    private fun pillsWith(
        containerStyle: LiquidGlassStyle,
        child: (Int) -> Pair<LiquidGlassStyle?, SurfaceMaterial?>,
    ): Bitmap {
        lateinit var bmp: Bitmap
        runComposeUiTest {
            setContent {
                Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                    Box(Modifier.size(300.dp, 120.dp).testTag("frame")) {
                        UiTheme(dark = false, motion = Motion(0f)) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(Color.Red))
                            GlassEffectContainer(Modifier.fillMaxSize(), style = containerStyle, glass = glass) {
                                Row(Modifier.offset(40.dp, 30.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    repeat(2) { i ->
                                        val (s, m) = child(i)
                                        Box(Modifier.size(60.dp).glassEffect(RoundedCornerShape(30.dp), s, m))
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

    @Test fun aChildOverTheCapClaimsASlotAnotherChildGaveUp() {
        var group: GlassEffectGroup? = null
        var showFirst by mutableStateOf(true)
        runComposeUiTest {
            setContent {
                Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                    Box(Modifier.size(1200.dp, 120.dp)) {
                        UiTheme(dark = false, motion = Motion(0f)) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(Color.Red))
                            GlassEffectContainer(Modifier.fillMaxSize(), style = LiquidGlassStyle(blend = 4.dp), glass = glass) {
                                group = LocalGlassEffectGroup.current
                                Row {
                                    repeat(MAX_MERGED_SHAPES + 1) { i ->
                                        if (i != 0 || showFirst) Box(Modifier.size(56.dp).glassEffect(RoundedCornerShape(28.dp)))
                                    }
                                }
                            }
                        }
                    }
                }
            }
            waitForIdle()
            assertEquals(MAX_MERGED_SHAPES, group!!.sorted().size, "the 17th child is over the cap")
            runOnIdle { showFirst = false }
            waitForIdle()
            assertEquals(MAX_MERGED_SHAPES, group!!.sorted().size, "the freed slot went to the 17th child")
            val lastCentre = 56f * MAX_MERGED_SHAPES - 28f
            assertTrue(group!!.sorted().any { kotlin.math.abs(it.centerX - lastCentre) < 2f }, "the last child is merged now")
        }
    }

    // N identical pills on top of each other: one piece of glass, so one shadow.
    private fun stacked(n: Int): Bitmap {
        lateinit var bmp: Bitmap
        runComposeUiTest {
            setContent {
                Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                    Box(Modifier.size(200.dp, 160.dp).testTag("frame")) {
                        UiTheme(dark = false, motion = Motion(0f)) {
                            val glass = rememberGlassState()
                            Box(Modifier.fillMaxSize().glassSource(glass).background(Color.White))
                            GlassEffectContainer(Modifier.fillMaxSize(), glass = glass) {
                                Box(Modifier.offset(70.dp, 30.dp)) {
                                    repeat(n) { Box(Modifier.size(60.dp).glassEffect(RoundedCornerShape(30.dp))) }
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

    @Test fun overlappingShapesCastOneShadowNotTwo() {
        val one = stacked(1)
        val two = stacked(2)
        // 8px below the pills (they end at y=90): inside the shadow, outside the glass.
        val single = (one.getColor(100, 98) shr 8) and 0xFF
        val double = (two.getColor(100, 98) shr 8) and 0xFF
        assertTrue(single < 250, "there is a shadow to compare: $single")
        assertTrue(kotlin.math.abs(single - double) <= 1, "shadow of two coincident shapes equals one: single=$single double=$double")
    }
}
