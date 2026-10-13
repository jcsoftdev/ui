@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

private val Drag = LiquidInteraction.Drag()
private val Press = LiquidInteraction.Press()

private class Probe {
    var dynamics: LiquidDynamics? = null
    val d: LiquidDynamics get() = dynamics!!
}

/** A bare 120x60 box that wears only the dynamics (no glass), so the state itself can be read. */
private fun ComposeUiTest.surface(
    probe: Probe,
    interaction: LiquidInteraction,
    motion: Float,
    source: MutableInteractionSource? = null,
    clickable: Boolean = false,
    scroll: Boolean = false,
) {
    setContent {
        UiTheme(dark = false, motion = Motion(motion)) {
            val d = rememberLiquidDynamics(interaction, source)
            probe.dynamics = d
            val box =
                Modifier
                    .size(120.dp, 60.dp)
                    .testTag("t")
                    .then(d.observer)
                    .then(if (clickable) Modifier.clickable(interactionSource = source, indication = null) {} else Modifier)
            if (scroll) {
                Column(Modifier.size(200.dp, 150.dp).verticalScroll(rememberScrollState())) {
                    Box(box)
                    Spacer(Modifier.height(1000.dp))
                }
            } else {
                Box(box)
            }
        }
    }
}

private fun ComposeUiTest.touch(
    node: SemanticsNodeInteraction,
    millis: Long = 16,
    block: androidx.compose.ui.test.TouchInjectionScope.() -> Unit,
) {
    node.performTouchInput(block)
    mainClock.advanceTimeBy(millis)
}

class LiquidDynamicsTest {
    // ---- reduced motion (the system animator scale is 0): only the press brightening stays ----

    @Test fun reducedMotionSkipsTheMaterializeRamp() {
        val probe = Probe()
        runComposeUiTest {
            mainClock.autoAdvance = false
            surface(probe, Press, motion = 0f)
            assertEquals(1f, probe.d.materialize(), "no ramp: fully materialized on the first frame")
        }
    }

    @Test fun withMotionTheLensMaterializesOnceAndNotAgainWhenTheSurfaceReturns() {
        val probe = Probe()
        var show by mutableStateOf(true)
        runComposeUiTest {
            mainClock.autoAdvance = false
            setContent {
                UiTheme(dark = false, motion = Motion(1f)) {
                    // What a LazyColumn does with an item that scrolls out and back in.
                    val holder = rememberSaveableStateHolder()
                    if (show) {
                        holder.SaveableStateProvider("item") {
                            probe.dynamics = rememberLiquidDynamics(Press, null)
                            Box(Modifier.size(10.dp))
                        }
                    }
                }
            }
            assertTrue(probe.d.materialize() < 1f, "the first appearance ramps up from nothing")
            mainClock.advanceTimeBy(3000)
            assertEquals(1f, probe.d.materialize(), 0.001f)
            show = false
            mainClock.advanceTimeByFrame()
            show = true
            mainClock.advanceTimeByFrame()
            assertEquals(1f, probe.d.materialize(), "coming back into composition does not replay the ramp")
        }
    }

    @Test fun reducedMotionKeepsGlowAndHighlightFollowOffAndMotionTurnsThemOn() {
        for (motion in listOf(0f, 1f)) {
            val probe = Probe()
            val source = MutableInteractionSource()
            runComposeUiTest {
                surface(probe, Press, motion = motion, source = source)
                runOnIdle { source.tryEmit(PressInteraction.Press(Offset(30f, 20f))) }
                waitForIdle()
                if (motion == 0f) {
                    assertEquals(0f, probe.d.follow(), "reduced motion: the highlight does not follow the finger")
                    assertNull(probe.d.pointer(), "reduced motion: no glow position")
                    assertEquals(1f, probe.d.lift(), 0.01f, "the press brightening stays")
                } else {
                    assertEquals(1f, probe.d.follow(), 0.02f)
                    assertNotNull(probe.d.pointer())
                    assertEquals(30f, probe.d.pointer()!!.x, 1f)
                }
            }
        }
    }

    @Test fun reducedMotionNeverSquashesADraggedSurface() {
        val probe = Probe()
        runComposeUiTest {
            surface(probe, Drag, motion = 0f)
            val node = onNodeWithTag("t")
            touch(node) { down(center) }
            touch(node) { moveBy(Offset(40f, 0f)) }
            touch(node) { moveBy(Offset(40f, 0f)) }
            assertTrue(probe.d.touching(), "still touching (the press brightening)")
            assertEquals(1f, probe.d.scaleX())
            assertEquals(1f, probe.d.scaleY())
            touch(node) { up() }
        }
    }

    // ---- Drag: one source of truth for touching, scroll hand-off, several fingers, the squash relaxing ----

    @Test fun aDragSquashesAtSpeedAndRelaxesWhenTheFingerStaysDown() {
        val probe = Probe()
        runComposeUiTest {
            mainClock.autoAdvance = false
            surface(probe, Drag, motion = 1f)
            val node = onNodeWithTag("t")
            touch(node) { down(center) }
            repeat(4) { touch(node) { moveBy(Offset(50f, 0f)) } }
            mainClock.advanceTimeBy(48)
            assertTrue(probe.d.scaleX() > 1.03f, "stretched along the drag: ${probe.d.scaleX()}")
            // The finger rests: no more events, so the velocity is zero and the squash settles back while it stays down.
            mainClock.advanceTimeBy(1500)
            assertTrue(probe.d.touching())
            assertTrue(abs(probe.d.scaleX() - 1f) < 0.01f, "relaxed with the finger still down: ${probe.d.scaleX()}")
            touch(node) { up() }
        }
    }

    @Test fun aScrollTakingOverEndsTheTouchOnceWithoutFlickerOrSquash() {
        val probe = Probe()
        val source = MutableInteractionSource()
        runComposeUiTest {
            mainClock.autoAdvance = false
            surface(probe, Drag, motion = 1f, source = source, clickable = true, scroll = true)
            val node = onNodeWithTag("t")
            val seen = ArrayList<Boolean>()
            var worst = 0f

            fun sample() {
                seen += probe.d.touching()
                worst = maxOf(worst, abs(probe.d.scaleX() - 1f), abs(probe.d.scaleY() - 1f))
            }
            touch(node) { down(center) }
            sample()
            repeat(8) {
                touch(node) { moveBy(Offset(0f, -45f)) }
                sample()
            }
            touch(node) { up() }
            mainClock.advanceTimeBy(100)
            sample()
            val firstOff = seen.indexOf(false)
            assertTrue(firstOff > 0, "the touch ends when the scroll takes over: $seen")
            assertTrue(seen.drop(firstOff).none { it }, "and never comes back (no flicker): $seen")
            assertTrue(worst < 0.01f, "a scroll must not squash the surface: $worst")
        }
    }

    @Test fun theTouchLastsUntilTheLastFingerLifts() {
        val probe = Probe()
        runComposeUiTest {
            mainClock.autoAdvance = false
            surface(probe, Drag, motion = 1f)
            val node = onNodeWithTag("t")
            touch(node) { down(0, Offset(20f, 30f)) }
            touch(node) { down(1, Offset(80f, 30f)) }
            touch(node) { up(0) }
            assertTrue(probe.d.touching(), "one finger is still down")
            touch(node) { moveTo(1, Offset(90f, 30f)) }
            assertTrue(probe.d.touching())
            touch(node) { up(1) }
            assertTrue(!probe.d.touching(), "the last finger lifted")
        }
    }
}
