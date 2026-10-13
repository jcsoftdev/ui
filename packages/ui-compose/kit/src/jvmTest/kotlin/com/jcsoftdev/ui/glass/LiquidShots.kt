@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.junit.Assume.assumeTrue
import java.io.File
import kotlin.test.Test

/**
 * Renders the Liquid looks to PNG files for visual review. Only runs with `LIQUID_SHOTS_DIR=<dir>` (not part of the verified set):
 * `LIQUID_SHOTS_DIR=/tmp/shots ./gradlew :kit:jvmTest --tests '*LiquidShots*'`.
 */
class LiquidShots {
    private val dir: File? = System.getenv("LIQUID_SHOTS_DIR")?.let { File(it).apply { mkdirs() } }

    @Composable
    private fun Backdrop() {
        Box(
            Modifier.fillMaxSize().background(Color(0xFFFFF4E0)).drawBehind {
                val stripe = 14.dp.toPx()
                var x = 0f
                var i = 0
                while (x < size.width) {
                    drawRect(
                        listOf(Color(0xFFEF476F), Color(0xFF118AB2), Color(0xFFFFD166), Color(0xFF06D6A0))[i % 4],
                        Offset(x, 0f),
                        androidx.compose.ui.geometry
                            .Size(stripe, size.height),
                    )
                    x += stripe
                    i++
                }
                var gx = 0f
                while (gx < size.width) {
                    drawLine(Color.Black.copy(alpha = 0.55f), Offset(gx, 0f), Offset(gx, size.height), 1f)
                    gx += 24.dp.toPx()
                }
                var gy = 0f
                while (gy < size.height) {
                    drawLine(Color.Black.copy(alpha = 0.55f), Offset(0f, gy), Offset(size.width, gy), 1f)
                    gy += 24.dp.toPx()
                }
            },
        )
    }

    private fun shot(
        name: String,
        style: LiquidGlassStyle = LiquidGlassStyle(),
        press: Boolean = false,
        content: @Composable (GlassState, MutableInteractionSource) -> Unit,
    ) {
        val out = dir ?: return
        runComposeUiTest {
            val source = MutableInteractionSource()
            setContent {
                CompositionLocalProvider(LocalDensity provides Density(2f)) {
                    Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                        Box(Modifier.size(360.dp, 200.dp).testTag("frame")) {
                            UiTheme(dark = false, motion = Motion(if (press) 1f else 0f), liquidGlassStyle = style) {
                                val glass = rememberGlassState()
                                Box(Modifier.fillMaxSize().glassSource(glass)) { Backdrop() }
                                content(glass, source)
                            }
                        }
                    }
                }
            }
            if (press) runOnIdle { source.tryEmit(PressInteraction.Press(Offset(60f, 40f))) }
            waitForIdle()
            val image = Image.makeFromBitmap(onNodeWithTag("frame").captureToImage().asSkiaBitmap())
            File(out, "$name.png").writeBytes(image.encodeToData(EncodedImageFormat.PNG)!!.bytes)
        }
    }

    @Composable
    private fun Samples(
        glass: GlassState,
        source: MutableInteractionSource,
    ) {
        Box(Modifier.offset(24.dp, 40.dp).wrapContentSize(Alignment.TopStart).size(150.dp, 110.dp)) {
            Box(
                Modifier.fillMaxSize().material(
                    SurfaceMaterial.Liquid,
                    RoundedCornerShape(28.dp),
                    glass = glass,
                    interactionSource = source,
                ),
            )
        }
        Box(Modifier.offset(196.dp, 70.dp).wrapContentSize(Alignment.TopStart).size(140.dp, 52.dp)) {
            Box(Modifier.fillMaxSize().material(SurfaceMaterial.Liquid, CircleShape, glass = glass, interactionSource = source))
        }
    }

    @Test fun default() {
        assumeTrue(dir != null)
        shot("default") { glass, source -> Samples(glass, source) }
    }

    @Test fun profileRim() {
        assumeTrue(dir != null)
        shot("profile-rim", LiquidGlassStyle(profile = LiquidProfile.Rim)) { glass, source -> Samples(glass, source) }
    }

    @Test fun profileFull() {
        assumeTrue(dir != null)
        shot("profile-full", LiquidGlassStyle(profile = LiquidProfile.Full)) { glass, source -> Samples(glass, source) }
    }

    @Test fun profileDome() {
        assumeTrue(dir != null)
        shot("profile-dome", LiquidGlassStyle(profile = LiquidProfile.Dome)) { glass, source -> Samples(glass, source) }
    }

    @Test fun thick() {
        assumeTrue(dir != null)
        shot("preset-thick", LiquidGlassStyle.Thick) { glass, source -> Samples(glass, source) }
    }

    @Test fun clear() {
        assumeTrue(dir != null)
        shot("preset-clear", LiquidGlassStyle.Clear) { glass, source -> Samples(glass, source) }
    }

    @Test fun pressed() {
        assumeTrue(dir != null)
        shot("pressed", press = true) { glass, source -> Samples(glass, source) }
    }

    @Test fun mergedPills() {
        assumeTrue(dir != null)
        shot("merged-pills", LiquidGlassStyle(blend = 60.dp)) { glass, _ ->
            GlassEffectContainer(Modifier.fillMaxSize(), style = LiquidGlassStyle(blend = 60.dp), glass = glass) {
                Row(Modifier.offset(30.dp, 70.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    repeat(4) { Box(Modifier.size(64.dp, 56.dp).glassEffect(CircleShape)) }
                }
            }
        }
    }

    @Test fun separatePills() {
        assumeTrue(dir != null)
        shot("separate-pills") { glass, _ ->
            GlassEffectContainer(Modifier.fillMaxSize(), style = LiquidGlassStyle(blend = 4.dp), glass = glass) {
                Row(Modifier.offset(30.dp, 70.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    repeat(4) { Box(Modifier.size(64.dp, 56.dp).glassEffect(CircleShape)) }
                }
            }
        }
    }
}
