@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toAwtImage
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The header art drawn at a few moments of a manual clock: it moves with motion on, holds still with motion off, and each
 * state leaves a visible mark. Set `AUTH_FRAMES_DIR` to also write the frames as PNGs for a look by eye.
 */
class AuthMotionRenderTest {
    private var state by mutableStateOf(AuthState.Idle)

    private fun ComposeUiTest.art(
        motion: Float,
        content: @Composable () -> Unit,
    ) {
        mainClock.autoAdvance = false
        setContent {
            UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(motion)) {
                val header = authHeaderColor(UiTheme.colors)
                CompositionLocalProvider(LocalContentColor provides authOnColor(header, UiTheme.colors)) {
                    Box(Modifier.size(360.dp, 220.dp).background(header).testTag("art")) { content() }
                }
            }
        }
        mainClock.advanceTimeByFrame()
    }

    private fun ComposeUiTest.frame(name: String): IntArray {
        val image = onNodeWithTag("art").captureToImage()
        save(image, name)
        val map = image.toPixelMap()
        return IntArray(map.width * map.height) { map[it % map.width, it / map.width].hashCode() }
    }

    private fun save(
        image: ImageBitmap,
        name: String,
    ) {
        val dir = System.getenv("AUTH_FRAMES_DIR") ?: return
        File(dir).mkdirs()
        ImageIO.write(image.toAwtImage(), "png", File(dir, "$name.png"))
    }

    private fun changed(
        a: IntArray,
        b: IntArray,
    ): Float = a.indices.count { a[it] != b[it] }.toFloat() / a.size

    private val arcs: @Composable () -> Unit = { AuthArcs(state, 0.5f, Modifier.fillMaxSize()) }

    @Test
    fun arcsHoldStillWithMotionOff() =
        runComposeUiTest {
            art(0f, arcs)
            val first = frame("arcs-still-0")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(first, frame("arcs-still-1")))
        }

    @Test
    fun arcsDriftWithMotionOn() =
        runComposeUiTest {
            art(1f, arcs)
            val first = frame("arcs-drift-0")
            mainClock.advanceTimeBy(2500)
            assertTrue(changed(first, frame("arcs-drift-1")) > 0.002f)
        }

    @Test
    fun arcsShakeOnErrorAndSweepOnSuccess() =
        runComposeUiTest {
            art(1f, arcs)
            frame("arcs-idle")
            state = AuthState.Error
            val shots =
                (1..5).map {
                    mainClock.advanceTimeBy(90)
                    frame("arcs-error-$it")
                }
            assertTrue(shots.zipWithNext().all { (a, b) -> changed(a, b) > 0f }, "the error shake moves every sampled frame")
            mainClock.advanceTimeBy(1500)
            state = AuthState.Success
            mainClock.advanceTimeBy(400)
            val mid = frame("arcs-success-mid")
            mainClock.advanceTimeBy(2000)
            val end = frame("arcs-success-end")
            assertTrue(changed(mid, end) > 0.002f, "the comet has passed and gone")
        }

    private val floating: @Composable () -> Unit = { AuthFloatingArt(state, 0.5f, Modifier.fillMaxSize()) }

    @Test
    fun floatingPiecesHoldStillWithMotionOff() =
        runComposeUiTest {
            art(0f, floating)
            val first = frame("floating-still-0")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(first, frame("floating-still-1")))
        }

    @Test
    fun floatingPiecesDriftThenBurstAndComeHome() =
        runComposeUiTest {
            art(1f, floating)
            val first = frame("floating-drift-0")
            mainClock.advanceTimeBy(2000)
            assertTrue(changed(first, frame("floating-drift-1")) > 0.002f)
            state = AuthState.Success
            mainClock.advanceTimeBy(300)
            val flying = frame("floating-burst-1")
            mainClock.advanceTimeBy(400)
            frame("floating-burst-2")
            mainClock.advanceTimeBy(1500)
            val home = frame("floating-burst-3")
            assertTrue(changed(flying, home) > 0.002f)
        }
}
