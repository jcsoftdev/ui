package com.jcsoftdev.ui.auth

import kotlin.test.Test
import kotlin.test.assertEquals

class FailedAttemptsTest {
    @Test
    fun anErrorShownFromTheStartIsNotAnAttempt() {
        val attempts = FailedAttempts("Wrong password", false)
        assertEquals(0, attempts.observe("Wrong password", loading = false))
    }

    @Test
    fun theSameErrorAfterEachRequestCountsAgain() {
        val attempts = FailedAttempts("Wrong password", false)
        attempts.observe("Wrong password", loading = true)
        assertEquals(1, attempts.observe("Wrong password", loading = false))
        attempts.observe("Wrong password", loading = true)
        assertEquals(2, attempts.observe("Wrong password", loading = false))
    }

    @Test
    fun aChangedErrorCounts() {
        val attempts = FailedAttempts(null, false)
        assertEquals(1, attempts.observe("Offline", loading = false))
        assertEquals(2, attempts.observe("Wrong password", loading = false))
    }

    @Test
    fun aSuccessfulRequestAddsNothing() {
        val attempts = FailedAttempts(null, false)
        attempts.observe(null, loading = true)
        assertEquals(0, attempts.observe(null, loading = false))
    }

    @Test
    fun recomposingWithTheSameStateAddsNothing() {
        val attempts = FailedAttempts("Wrong password", false)
        attempts.observe("Wrong password", loading = true)
        attempts.observe("Wrong password", loading = false)
        assertEquals(1, attempts.observe("Wrong password", loading = false))
    }
}
