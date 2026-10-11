package com.jcsoftdev.ui.foundation

import androidx.compose.animation.core.SnapSpec
import androidx.compose.animation.core.TweenSpec
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class MotionTest {
    @Test
    fun zeroScaleIsReducedMotion() {
        assertFalse(Motion(0f).enabled)
        assertTrue(Motion(1f).enabled)
        assertTrue(Motion(0.5f).enabled)
    }

    @Test
    fun reducedMotionSnaps() {
        assertIs<SnapSpec<Float>>(Motion(0f).tween<Float>())
    }

    @Test
    fun scaleStretchesDurations() {
        val spec = Motion(2f).tween<Float>(Motion.STANDARD)
        assertEquals(Motion.STANDARD * 2, assertIs<TweenSpec<Float>>(spec).durationMillis)
    }
}

class BackDispatcherTest {
    @Test
    fun highestPriorityWins() {
        val dispatcher = BackDispatcher()
        val calls = mutableListOf<String>()
        dispatcher.register(BackPriority.TAB) { calls += "tab" }
        dispatcher.register(BackPriority.SHEET) { calls += "sheet" }
        dispatcher.register(BackPriority.OVERLAY) { calls += "overlay" }
        assertTrue(dispatcher.dispatch())
        assertEquals(listOf("sheet"), calls)
    }

    @Test
    fun latestWinsAmongEquals() {
        val dispatcher = BackDispatcher()
        val calls = mutableListOf<String>()
        dispatcher.register(BackPriority.OVERLAY) { calls += "first" }
        dispatcher.register(BackPriority.OVERLAY) { calls += "second" }
        dispatcher.dispatch()
        assertEquals(listOf("second"), calls)
    }

    @Test
    fun unregisteredHandlerIsSkipped() {
        val dispatcher = BackDispatcher()
        val calls = mutableListOf<String>()
        dispatcher.register(BackPriority.TAB) { calls += "tab" }
        val remove = dispatcher.register(BackPriority.SHEET) { calls += "sheet" }
        remove()
        dispatcher.dispatch()
        assertEquals(listOf("tab"), calls)
    }

    @Test
    fun emptyDispatcherDoesNotConsume() {
        val dispatcher = BackDispatcher()
        assertFalse(dispatcher.hasHandler)
        assertFalse(dispatcher.dispatch())
    }
}
