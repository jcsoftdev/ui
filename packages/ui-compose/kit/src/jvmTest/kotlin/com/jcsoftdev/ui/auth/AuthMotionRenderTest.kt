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
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
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
    private var errorKey by mutableStateOf(0)

    private fun ComposeUiTest.art(
        motion: Float,
        frozen: Boolean = false,
        content: @Composable () -> Unit,
    ) {
        mainClock.autoAdvance = false
        setContent {
            UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(motion)) {
                val header = authHeaderColor(UiTheme.colors)
                CompositionLocalProvider(
                    LocalContentColor provides authOnColor(header, UiTheme.colors),
                    LocalAuthDriftFrozen provides frozen,
                ) {
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

    /** Pixels that differ from the header fill (the top left corner), as a share of the frame: how much is drawn. */
    private fun covered(frame: IntArray): Float = frame.count { it != frame[0] }.toFloat() / frame.size

    private val arcs: @Composable () -> Unit = { AuthArcs(state, 0.5f, Modifier.fillMaxSize(), errorKey = errorKey) }

    @Test
    fun arcsHoldStillWithMotionOff() =
        runComposeUiTest {
            art(0f, content = arcs)
            val first = frame("arcs-still-0")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(first, frame("arcs-still-1")))
        }

    @Test
    fun arcsDriftWithMotionOn() =
        runComposeUiTest {
            art(1f, content = arcs)
            val first = frame("arcs-drift-0")
            mainClock.advanceTimeBy(2500)
            assertTrue(changed(first, frame("arcs-drift-1")) > 0.002f)
        }

    @Test
    fun arcsShakeAgainOnEveryFailedAttempt() =
        runComposeUiTest {
            art(1f, frozen = true, content = arcs)
            state = AuthState.Error
            mainClock.advanceTimeBy(3000)
            val settled = frame("arcs-error-settled")
            mainClock.advanceTimeBy(1000)
            assertEquals(0f, changed(settled, frame("arcs-error-still")), "nothing else moves once the error has settled")
            errorKey++
            val shots =
                (1..4).map {
                    mainClock.advanceTimeBy(90)
                    frame("arcs-retry-$it")
                }
            assertTrue(shots.any { changed(settled, it) > 0.002f }, "the second failed attempt shakes the arcs again")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(settled, frame("arcs-retry-end")), "and they come back to rest")
        }

    @Test
    fun arcsCarryACometOnSuccess() =
        runComposeUiTest {
            art(1f, frozen = true, content = arcs)
            state = AuthState.Success
            mainClock.advanceTimeBy(500)
            val running = frame("arcs-comet-running")
            mainClock.advanceTimeBy(3000)
            val gone = frame("arcs-comet-gone")
            assertTrue(covered(running) > covered(gone) * 1.1f, "the bold comet covers more of the header while it runs than at rest")
        }

    private val floating: @Composable () -> Unit = { AuthFloatingArt(state, 0.5f, Modifier.fillMaxSize(), errorKey = errorKey) }

    @Test
    fun floatingPiecesHoldStillWithMotionOff() =
        runComposeUiTest {
            art(0f, content = floating)
            val first = frame("floating-still-0")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(first, frame("floating-still-1")))
        }

    @Test
    fun floatingPiecesDriftWithMotionOn() =
        runComposeUiTest {
            art(1f, content = floating)
            val first = frame("floating-drift-0")
            mainClock.advanceTimeBy(2000)
            assertTrue(changed(first, frame("floating-drift-1")) > 0.002f)
        }

    @Test
    fun floatingPiecesBurstOnSuccessAndComeHome() =
        runComposeUiTest {
            art(1f, frozen = true, content = floating)
            state = AuthState.Success
            mainClock.advanceTimeBy(3500)
            val home = frame("floating-burst-home")
            state = AuthState.Idle
            mainClock.advanceTimeBy(3500)
            state = AuthState.Success
            mainClock.advanceTimeBy(700)
            val flying = frame("floating-burst-flying")
            assertTrue(covered(flying) < covered(home) * 0.6f, "the pieces have flown out and faded at the burst's peak")
            mainClock.advanceTimeBy(3000)
            assertEquals(covered(home), covered(frame("floating-burst-back")), 0.002f, "and they are back home afterwards")
        }

    @Test
    fun floatingPiecesShakeAgainOnEveryFailedAttempt() =
        runComposeUiTest {
            art(1f, frozen = true, content = floating)
            state = AuthState.Error
            mainClock.advanceTimeBy(3000)
            val settled = frame("floating-error-settled")
            errorKey++
            val shots =
                (1..4).map {
                    mainClock.advanceTimeBy(90)
                    frame("floating-retry-$it")
                }
            assertTrue(shots.any { changed(settled, it) > 0.002f }, "the second failed attempt shakes the pieces again")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(settled, frame("floating-retry-end")))
        }

    @Test
    fun welcomeHandsOverToTheFormInSteps() =
        runComposeUiTest {
            var expanded by mutableStateOf(true)
            mainClock.autoAdvance = false
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(1f)) {
                    Box(Modifier.size(360.dp, 640.dp).testTag("art")) {
                        AuthScaffold(
                            "Welcome back",
                            "Sign in with your school account",
                            art = { s, p -> AuthFloatingArt(s, p, Modifier.fillMaxSize()) },
                            expanded = expanded,
                            welcomeTitle = "Learn without limits",
                            welcomeAction = { AuthPrimaryButton("Get started", { expanded = false }) },
                        ) { AuthTextField("", {}, "Email") }
                    }
                }
            }
            mainClock.advanceTimeByFrame()
            val frames = mutableListOf(frame("welcome-0"))
            expanded = false
            for (step in 1..5) {
                mainClock.advanceTimeBy(130)
                frames += frame("welcome-$step")
            }
            assertTrue(frames.zipWithNext().all { (a, b) -> changed(a, b) > 0.01f }, "every sampled step of the hand-over differs")
        }

    @Test
    fun floatingPiecesPopInOneAfterAnother() =
        runComposeUiTest {
            art(1f, frozen = true, content = floating)
            mainClock.advanceTimeBy(80)
            val early = frame("floating-intro-early")
            mainClock.advanceTimeBy(3000)
            val full = frame("floating-intro-full")
            assertTrue(
                covered(early) < covered(full) * 0.7f,
                "the pieces start small and grow into place: ${covered(early)} vs ${covered(full)}",
            )
        }

    @Test
    fun floatingPiecesAreSolidEnoughToRead() =
        runComposeUiTest {
            art(0f, content = floating)
            assertTrue(covered(frame("floating-solid")) > 0.08f, "the pieces fill a visible share of the header, not faint outlines")
        }

    private var success by mutableStateOf(false)

    private fun ComposeUiTest.login(motion: Float) {
        mainClock.autoAdvance = false
        setContent {
            UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(motion)) {
                CompositionLocalProvider(LocalAuthDriftFrozen provides true) {
                    Box(Modifier.size(360.dp, 640.dp).testTag("art")) {
                        LoginScreen(
                            "Welcome back",
                            "Use your school account",
                            "ana@school.edu",
                            {},
                            "Email",
                            "secret12",
                            {},
                            "Password",
                            "Sign in",
                            {},
                            success = success,
                            forgotText = "Forgot password?",
                            art = { _, _ -> },
                            successDescription = "Signed in",
                        )
                    }
                }
            }
        }
        mainClock.advanceTimeByFrame()
    }

    @Test
    fun successWithMotionOffShowsTheFinalStateAtOnce() =
        runComposeUiTest {
            login(0f)
            val filled = frame("success-still-before")
            success = true
            mainClock.advanceTimeBy(50)
            val done = frame("success-still-after")
            assertTrue(changed(filled, done) > 0.02f, "the morphed action and the settled fields show without any animation")
            val badge = onNodeWithText("Sign in").getUnclippedBoundsInRoot()
            val wide = badge.right - badge.left
            val tall = badge.bottom - badge.top
            assertTrue(wide <= tall * 1.05f, "the action is a round badge, was $wide x $tall")
            mainClock.advanceTimeBy(2000)
            assertEquals(0f, changed(done, frame("success-still-later")))
        }

    @Test
    fun successSendsAWaveAcrossTheSheetThatThenRests() =
        runComposeUiTest {
            login(1f)
            success = true
            mainClock.advanceTimeBy(4000)
            val rest = frame("success-rest")
            success = false
            mainClock.advanceTimeBy(4000)
            success = true
            mainClock.advanceTimeBy(450)
            val wave = frame("success-wave")
            mainClock.advanceTimeBy(4000)
            assertTrue(changed(rest, wave) > 0.05f, "mid way the wave covers a large part of the sheet: ${changed(rest, wave)}")
            assertEquals(0f, changed(rest, frame("success-rest-again")), "and leaves the same final state behind")
        }
}
