package com.jcsoftdev.ui.auth

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthMotionTest {
    private val samples = (0..100).map { it / 100f }

    @Test
    fun jitterSwingsBothWaysAndRestsAtBothEnds() {
        assertEquals(0f, AuthMotion.jitter(0f), 1e-4f)
        assertEquals(0f, AuthMotion.jitter(1f), 1e-4f)
        assertTrue(samples.any { AuthMotion.jitter(it) > 0.3f })
        assertTrue(samples.any { AuthMotion.jitter(it) < -0.3f })
        assertTrue(samples.all { abs(AuthMotion.jitter(it)) <= 1f })
    }

    @Test
    fun jitterDiesOut() {
        val early = samples.filter { it < 0.3f }.maxOf { abs(AuthMotion.jitter(it)) }
        val late = samples.filter { it > 0.7f }.maxOf { abs(AuthMotion.jitter(it)) }
        assertTrue(late < early / 4f)
    }

    @Test
    fun errorFlashPeaksEarlyAndSettles() {
        assertEquals(0f, AuthMotion.errorFlash(0f))
        assertEquals(1f - AuthMotion.ERROR_SETTLE, AuthMotion.errorFlash(0.12f), 1e-4f)
        assertEquals(0f, AuthMotion.errorFlash(1f), 1e-4f)
        assertTrue(AuthMotion.errorFlash(0.5f) < AuthMotion.errorFlash(0.2f))
    }

    @Test
    fun successSweepReachesInnerRingsFirst() {
        val t = 0.3f
        assertTrue(AuthMotion.sweepHead(t, 0, 5) > AuthMotion.sweepHead(t, 4, 5))
        assertTrue(AuthMotion.sweepHead(0f, 0, 5) <= 0f)
        for (ring in 0 until 5) assertTrue(AuthMotion.sweepHead(1f, ring, 5) >= 1.29f)
    }

    @Test
    fun burstGoesOutAndComesHome() {
        assertEquals(0f, AuthMotion.burst(0f))
        assertEquals(1f, AuthMotion.burst(0.4f), 1e-4f)
        assertEquals(0f, AuthMotion.burst(1f), 1e-4f)
        assertEquals(1f, AuthMotion.burstAlpha(0f))
        assertEquals(0f, AuthMotion.burstAlpha(0.5f))
        assertEquals(1f, AuthMotion.burstAlpha(1f), 1e-4f)
    }

    @Test
    fun formStatesSlowTheDriftAndSuccessQuickensIt() {
        val idle = AuthMotion.driftSpeed(AuthState.Idle)
        assertTrue(AuthMotion.driftSpeed(AuthState.Typing) < idle)
        assertTrue(AuthMotion.driftSpeed(AuthState.Password) < AuthMotion.driftSpeed(AuthState.Typing))
        assertTrue(AuthMotion.driftSpeed(AuthState.Success) > idle)
    }

    @Test
    fun segmentClampsTheSharedFraction() {
        assertEquals(0f, AuthMotion.segment(0.2f, 0.4f, 0.8f))
        assertEquals(0.5f, AuthMotion.segment(0.6f, 0.4f, 0.8f), 1e-4f)
        assertEquals(1f, AuthMotion.segment(0.95f, 0.4f, 0.8f))
    }

    @Test
    fun arcsStaticFrameFollowsTheState() {
        assertEquals(AuthMotion.ERROR_SETTLE, AuthArcsFrame.of(AuthState.Error, 0f).errorTint)
        assertEquals(1f, AuthArcsFrame.of(AuthState.Success, 0f).highlight)
        assertEquals(0f, AuthArcsFrame.of(AuthState.Typing, 0.5f).highlight)
        assertTrue(AuthArcsFrame.of(AuthState.Password, 0f).turnDegrees > 0f)
    }
}
