package com.jcsoftdev.ui.glass

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GlassEffectGroupTest {
    @Test fun anAbandonedClaimGivesItsSlotBack() {
        val group = GlassEffectGroup()
        val abandoned = SlotClaim(group)
        assertEquals(0, abandoned.slot)
        abandoned.onAbandoned()
        assertEquals(-1, abandoned.slot)
        assertEquals(0, group.claim(), "the abandoned slot is free again")
    }

    @Test fun aForgottenClaimFreesItsSlotAndLetsACappedChildRetry() {
        val group = GlassEffectGroup()
        val claims = List(MAX_MERGED_SHAPES) { SlotClaim(group) }
        val capped = SlotClaim(group)
        assertEquals(-1, capped.slot)
        val before = group.released
        claims[3].onForgotten()
        assertTrue(group.released > before, "the release is observable so the capped child recomposes")
        capped.retry(group.released)
        assertEquals(3, capped.slot)
    }

    @Test fun aReleasedSlotLeavesTheMergedShapes() {
        val group = GlassEffectGroup()
        val claim = SlotClaim(group)
        group.put(claim.slot, MergedShape(10f, 10f, 5f, 5f, 5f))
        assertEquals(1, group.sorted().size)
        claim.onForgotten()
        assertEquals(0, group.sorted().size)
    }

    @Test fun precedenceChildExplicitThenContainer() {
        val group = GlassEffectGroup()
        group.style = LiquidGlassStyle(refraction = 2f)
        group.material = SurfaceMaterial.LiquidClear
        assertTrue(group.accepts(null, null))
        assertTrue(group.accepts(LiquidGlassStyle(refraction = 2f), SurfaceMaterial.LiquidClear))
        assertTrue(!group.accepts(LiquidGlassStyle(refraction = 1f), null))
        assertTrue(!group.accepts(null, SurfaceMaterial.Liquid))
    }
}
