package com.jcsoftdev.ui.atoms

import kotlin.test.Test
import kotlin.test.assertEquals

class AtomsLogicTest {
    @Test
    fun initialsFollowTheWebRules() {
        assertEquals("", initialsOf("   "))
        assertEquals("MA", initialsOf("maria"))
        assertEquals("JP", initialsOf("Juan Carlos Perez"))
        assertEquals("AB", initialsOf("  ana   b  "))
        assertEquals("😀X", initialsOf("😀 x"))
    }

    @Test
    fun progressIsClamped() {
        assertEquals(0.5f, progressFraction(50f, 100f))
        assertEquals(1f, progressFraction(150f, 100f))
        assertEquals(0f, progressFraction(-3f, 100f))
        assertEquals(0f, progressFraction(5f, 0f))
        assertEquals(0f, progressFraction(Float.NaN, 100f))
    }
}
