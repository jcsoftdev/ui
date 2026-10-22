package com.jcsoftdev.ui.auth

import kotlin.test.Test
import kotlin.test.assertEquals

class DragAccumulatorTest {
    @Test
    fun manyEventsInOneFrameAllCount() {
        val drag = DragAccumulator(reach = 28f)
        drag.begin(0f, 0f)
        repeat(5) { drag.add(10f, -5f) }
        assertEquals(20f, drag.x, 1e-4f)
        assertEquals(-10f, drag.y, 1e-4f)
    }

    @Test
    fun theOffsetStopsAtTheReach() {
        val drag = DragAccumulator(reach = 28f)
        drag.begin(0f, 0f)
        repeat(20) { drag.add(50f, -50f) }
        assertEquals(28f, drag.x)
        assertEquals(-28f, drag.y)
    }

    @Test
    fun aNewDragContinuesFromWhatTheArtShows() {
        val drag = DragAccumulator(reach = 28f)
        drag.begin(10f, -4f)
        drag.add(5f, 5f)
        assertEquals(12f, drag.x, 1e-4f)
        assertEquals(-2f, drag.y, 1e-4f)
    }
}
