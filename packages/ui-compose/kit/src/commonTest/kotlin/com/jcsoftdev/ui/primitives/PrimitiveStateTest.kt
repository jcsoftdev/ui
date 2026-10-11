package com.jcsoftdev.ui.primitives

import androidx.compose.foundation.gestures.Orientation
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PrimitiveStateTest {
    @Test
    fun sheetDragNeverGoesAboveRestAndDismissesPastThreshold() {
        val sheet = SheetState()
        sheet.updateHeight(1000f)
        sheet.dragBy(-50f)
        assertEquals(0f, sheet.offset)
        sheet.dragBy(300f)
        assertFalse(sheet.shouldDismiss(0f))
        sheet.dragBy(51f)
        assertTrue(sheet.shouldDismiss(0f))
        sheet.reset()
        assertEquals(0f, sheet.offset)
        assertFalse(sheet.shouldDismiss(1200f))
        assertTrue(sheet.shouldDismiss(1201f))
    }

    @Test
    fun sheetScrimFadesWithTheDrag() {
        val sheet = SheetState(dismissFraction = 0.5f)
        assertEquals(0.8f, sheet.scrimAlpha(0.8f))
        sheet.updateHeight(200f)
        sheet.dragBy(100f)
        assertEquals(0.5f, sheet.dragFraction)
        assertEquals(0.4f, sheet.scrimAlpha(0.8f))
        sheet.dragBy(500f)
        assertEquals(1f, sheet.dragFraction)
        assertEquals(0f, sheet.scrimAlpha(1f))
        assertFailsWith<IllegalArgumentException> { SheetState(dismissFraction = 1.5f) }
    }

    @Test
    fun toastQueueShowsMaxVisibleAndPromotesInOrder() {
        val queue = ToastQueue(maxVisible = 2)
        val a = queue.push("a", ToastTone.Neutral, null, 1000)
        queue.push("b", ToastTone.Success, null, 1000)
        val c = queue.push("c", ToastTone.Error, null, 1000)
        queue.push("d", ToastTone.Info, null, 1000)
        assertEquals(listOf("a", "b"), queue.visible.map { it.message })
        assertEquals(2, queue.pendingCount)
        queue.dismiss(a.id)
        assertEquals(listOf("b", "c"), queue.visible.map { it.message })
        queue.dismiss(c.id)
        assertEquals(listOf("b", "d"), queue.visible.map { it.message })
        queue.dismissAll()
        assertTrue(queue.visible.isEmpty())
        assertEquals(0, queue.pendingCount)
        assertFailsWith<IllegalArgumentException> { ToastQueue(0) }
    }

    @Test
    fun dismissingAWaitingToastNeverShowsIt() {
        val queue = ToastQueue(maxVisible = 1)
        queue.push("a", ToastTone.Neutral, null, 1000)
        val b = queue.push("b", ToastTone.Neutral, null, 1000)
        queue.push("c", ToastTone.Neutral, null, 1000)
        queue.dismiss(b.id)
        queue.dismiss(queue.visible.single().id)
        assertEquals(listOf("c"), queue.visible.map { it.message })
    }

    @Test
    fun toastTimerRunsDownOnlyWhileNotPaused() {
        val timer = ToastTimer(300)
        assertFalse(timer.advance(100, paused = false))
        assertEquals(200, timer.remainingMillis)
        assertFalse(timer.advance(100, paused = true))
        assertEquals(200, timer.remainingMillis)
        assertFalse(timer.advance(100, paused = false))
        assertTrue(timer.advance(100, paused = false))
        assertEquals(0, timer.remainingMillis)
        assertTrue(ToastTimer(-5).expired)
    }

    @Test
    fun rovingTargetWrapsAndSkipsDisabledItems() {
        val enabled = { i: Int -> i != 2 }
        assertEquals(1, Roving.target(4, 0, RovingMove.Next))
        assertEquals(3, Roving.target(4, 1, RovingMove.Next, isEnabled = enabled))
        assertEquals(0, Roving.target(4, 3, RovingMove.Next))
        assertEquals(3, Roving.target(4, 3, RovingMove.Next, wrap = false))
        assertEquals(3, Roving.target(4, 0, RovingMove.Previous))
        assertEquals(0, Roving.target(4, 0, RovingMove.Previous, wrap = false))
        assertEquals(1, Roving.target(4, 3, RovingMove.Previous, isEnabled = enabled))
        assertEquals(0, Roving.target(4, 2, RovingMove.First))
        assertEquals(3, Roving.target(4, 0, RovingMove.Last))
        assertEquals(0, Roving.target(4, -1, RovingMove.Next))
        assertEquals(3, Roving.target(4, -1, RovingMove.Previous))
        assertEquals(1, Roving.target(3, 1, RovingMove.Next) { false })
        assertEquals(-1, Roving.target(0, -1, RovingMove.Next))
    }

    @Test
    fun rovingKeysFollowOrientationAndMirrorInRtl() {
        val h = Orientation.Horizontal
        val v = Orientation.Vertical
        assertEquals(RovingMove.Next, Roving.moveFor(Key.DirectionRight, h, LayoutDirection.Ltr))
        assertEquals(RovingMove.Previous, Roving.moveFor(Key.DirectionRight, h, LayoutDirection.Rtl))
        assertEquals(RovingMove.Previous, Roving.moveFor(Key.DirectionLeft, h, LayoutDirection.Ltr))
        assertNull(Roving.moveFor(Key.DirectionDown, h, LayoutDirection.Ltr))
        assertEquals(RovingMove.Next, Roving.moveFor(Key.DirectionDown, v, LayoutDirection.Rtl))
        assertEquals(RovingMove.Previous, Roving.moveFor(Key.DirectionUp, v, LayoutDirection.Ltr))
        assertNull(Roving.moveFor(Key.DirectionLeft, v, LayoutDirection.Ltr))
        assertEquals(RovingMove.First, Roving.moveFor(Key.MoveHome, h, LayoutDirection.Ltr))
        assertEquals(RovingMove.Last, Roving.moveFor(Key.MoveEnd, v, LayoutDirection.Ltr))
        assertNull(Roving.moveFor(Key.A, h, LayoutDirection.Ltr))
    }

    @Test
    fun singleSelectionHoldsTheChosenValue() {
        val state = SingleSelectionState("a")
        state.select("b")
        assertEquals("b", state.selected)
        state.clear()
        assertNull(state.selected)
    }

    @Test
    fun digitMaskFiltersAndFormats() {
        val time = DigitMask(4, ':', listOf(2))
        assertEquals("0930", time.filter("09:30"))
        assertEquals("0930", time.filter("a0b9c3d0e1"))
        assertEquals("09:30", time.format("0930"))
        assertEquals("09:3", time.format("093"))
        assertEquals("09", time.format("09"))
        val date = DigitMask(8, '/', listOf(4, 2))
        assertEquals("09/03/2024", date.format("09032024"))
        assertFailsWith<IllegalArgumentException> { DigitMask(4, ':', listOf(4)) }
        assertFailsWith<IllegalArgumentException> { DigitMask(0, ':', emptyList()) }
    }

    @Test
    fun digitMaskCursorMappingRoundTrips() {
        val date = DigitMask(8, '/', listOf(2, 4))
        val shown = date.visualTransformation.filter(AnnotatedString("09032024"))
        assertEquals("09/03/2024", shown.text.text)
        val raw = intArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8)
        val screen = intArrayOf(0, 1, 2, 4, 5, 7, 8, 9, 10)
        raw.forEachIndexed { i, offset ->
            assertEquals(screen[i], shown.offsetMapping.originalToTransformed(offset), "to screen $offset")
            assertEquals(offset, shown.offsetMapping.transformedToOriginal(screen[i]), "to raw ${screen[i]}")
        }
        assertEquals(2, shown.offsetMapping.transformedToOriginal(3))
    }

    @Test
    fun maskedInputStateKeepsDigitsAndCommitsOnlyValidValues() {
        val reported = mutableListOf<String>()
        val state = MaskedInputState(DigitMask(4, ':', listOf(2)))
        val commit = { digits: String -> if (digits.length == 4) digits.take(2) + ":" + digits.drop(2) else "" }
        state.bind("", commit) { reported += it }
        state.onInput("09:3")
        assertEquals("093", state.digits)
        assertFalse(state.isComplete)
        state.onInput("0930x")
        assertEquals("0930", state.digits)
        assertTrue(state.isComplete)
        assertEquals(listOf("", "09:30"), reported)
        state.bind("", commit) { reported += it }
        assertEquals("", state.digits)
        state.bind("12:45", commit) { reported += it }
        assertEquals("1245", state.digits)
    }

    @Test
    fun anchoredPopupPositionHandlesRtlAndFlip() {
        val window = IntSize(400, 800)
        val size = IntSize(200, 300)
        val anchor = IntRect(300, 100, 380, 140)
        val ltr = LayoutDirection.Ltr
        assertEquals(IntOffset(200, 140), anchoredPopupPosition(anchor, window, ltr, size))
        assertEquals(IntOffset(180, 140), anchoredPopupPosition(anchor, window, LayoutDirection.Rtl, size))
        assertEquals(IntOffset(0, 350), anchoredPopupPosition(IntRect(0, 650, 80, 690), window, ltr, size))
        val tall = IntSize(200, 500)
        assertEquals(300, anchoredPopupPosition(IntRect(0, 300, 80, 340), window, ltr, tall).y)
        assertEquals(0, anchoredPopupPosition(IntRect(0, 420, 80, 460), window, ltr, tall).y)
        assertEquals(IntOffset(0, 140), anchoredPopupPosition(IntRect(-20, 100, 10, 140), window, ltr, size))
    }
}
