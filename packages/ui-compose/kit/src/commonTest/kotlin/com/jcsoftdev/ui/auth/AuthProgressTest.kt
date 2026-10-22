package com.jcsoftdev.ui.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthProgressTest {
    @Test
    fun idFillsHalfAtTwelveCharacters() {
        assertEquals(0.5f, AuthProgress.of(12, 0))
        assertEquals(0.5f, AuthProgress.of(40, 0))
        assertEquals(0.25f, AuthProgress.of(6, 0))
    }

    @Test
    fun passwordFillsHalfAtEightCharacters() {
        assertEquals(0.5f, AuthProgress.of(0, 8))
        assertEquals(0.5f, AuthProgress.of(0, 30))
        assertEquals(1f, AuthProgress.of(12, 8))
    }

    @Test
    fun emptyAndNegativeLengthsAreZero() {
        assertEquals(0f, AuthProgress.of(0, 0))
        assertEquals(0f, AuthProgress.of(-3, -1))
    }

    @Test
    fun stateFollowsTheForm() {
        assertEquals(AuthState.Idle, AuthProgress.stateOf(0, 0, passwordFocused = false))
        assertEquals(AuthState.Typing, AuthProgress.stateOf(3, 0, passwordFocused = false))
        assertEquals(AuthState.Password, AuthProgress.stateOf(3, 0, passwordFocused = true))
    }

    @Test
    fun errorBeatsFocusAndSuccessBeatsError() {
        assertEquals(AuthState.Error, AuthProgress.stateOf(3, 2, passwordFocused = true, error = true))
        assertEquals(AuthState.Success, AuthProgress.stateOf(3, 2, passwordFocused = true, error = true, success = true))
    }

    @Test
    fun typingBrightensWithProgressAndPasswordStaysDimmer() {
        assertTrue(AuthProgress.emphasis(AuthState.Typing, 1f) > AuthProgress.emphasis(AuthState.Typing, 0f))
        assertTrue(AuthProgress.emphasis(AuthState.Password, 0.5f) < AuthProgress.emphasis(AuthState.Typing, 0.5f))
        assertEquals(1f, AuthProgress.emphasis(AuthState.Success, 0f))
        assertEquals(AuthProgress.emphasis(AuthState.Typing, 1f), AuthProgress.emphasis(AuthState.Typing, 7f))
    }

    @Test
    fun sweepAdvancesWithProgress() {
        assertEquals(70f, AuthProgress.sweepDegrees(0f))
        assertEquals(120f, AuthProgress.sweepDegrees(1f))
        assertEquals(120f, AuthProgress.sweepDegrees(3f))
    }
}
