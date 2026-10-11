package com.jcsoftdev.ui.primitives

import androidx.compose.foundation.gestures.Orientation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

/**
 * Uncontrolled single selection (tabs, segments, radio rows): holds the selected value for callers that do not own it.
 *
 * ```
 * val tab = rememberSingleSelectionState("agenda")
 * Tabs(items, tab.selected ?: "", tab::select)
 * ```
 */
@Stable
public class SingleSelectionState<T : Any>(
    initial: T? = null,
) {
    /** The selected value, or null. */
    public var selected: T? by mutableStateOf(initial)
        private set

    public fun select(value: T) {
        selected = value
    }

    public fun clear() {
        selected = null
    }
}

/**
 * Remembers a [SingleSelectionState] starting at [initial]. The selection survives configuration changes and process
 * death like `rememberSaveable`, so [T] has to be something the platform can save (a String, a number, an enum name).
 */
@Composable
public fun <T : Any> rememberSingleSelectionState(initial: T? = null): SingleSelectionState<T> =
    rememberSaveable(
        saver =
            Saver<SingleSelectionState<T>, Any>(
                save = { arrayListOf<Any?>(it.selected) },
                restore = {
                    @Suppress("UNCHECKED_CAST")
                    SingleSelectionState((it as List<Any?>)[0] as T?)
                },
            ),
    ) { SingleSelectionState(initial) }

/**
 * Focus requesters of the items of one roving group, so a key press can move focus to the selected item itself instead of
 * to the next focusable in the screen. Create it with [rememberRovingFocus], pass it to [rovingSelection] and mark every item
 * with [rovingItem].
 */
@Stable
public class RovingFocus<T : Any> internal constructor() {
    private val requesters = HashMap<T, FocusRequester>()

    internal fun requesterFor(value: T): FocusRequester = requesters.getOrPut(value) { FocusRequester() }

    /** Moves focus to the item of [value]; false when no such item is composed. */
    public fun requestFocus(value: T): Boolean = requesters[value]?.let { runCatching { it.requestFocus() }.isSuccess } ?: false
}

/** Remembers a [RovingFocus] for the items of a group. */
@Composable
public fun <T : Any> rememberRovingFocus(): RovingFocus<T> = remember { RovingFocus() }

/**
 * Item-level modifier of a roving group: lets [focus] move focus to the item of [value]. Put it before the modifier that
 * makes the item focusable (`selectable`, `clickable`, `focusable`).
 *
 * ```
 * Row(Modifier.selectableGroup().rovingSelection(values, selected, onSelect, focus = focus)) {
 *     values.forEach { v -> Box(Modifier.rovingItem(focus, v).selectable(v == selected) { onSelect(v) }) { Label(v) } }
 * }
 * ```
 */
public fun <T : Any> Modifier.rovingItem(
    focus: RovingFocus<T>,
    value: T,
): Modifier = this.focusRequester(focus.requesterFor(value))

/** A keyboard or D-pad move inside a selection group; see [Roving.moveFor] and [Roving.target]. */
public enum class RovingMove { Previous, Next, First, Last }

/**
 * Pure navigation maths of a roving selection.
 *
 * ```
 * Roving.target(count = 4, current = 3, move = RovingMove.Next) // 0, it wraps
 * ```
 */
public object Roving {
    /**
     * Index reached by [move] from [current] among [count] items, skipping the ones [isEnabled] rejects; wraps around when
     * [wrap]. Returns [current] when nothing else can be reached, and the first enabled item when [current] is -1.
     */
    public fun target(
        count: Int,
        current: Int,
        move: RovingMove,
        wrap: Boolean = true,
        isEnabled: (Int) -> Boolean = { true },
    ): Int {
        if (count <= 0) return current
        val step =
            when (move) {
                RovingMove.Previous -> -1
                RovingMove.Next -> 1
                RovingMove.First -> 1
                RovingMove.Last -> -1
            }
        var index =
            when (move) {
                RovingMove.First -> -1
                RovingMove.Last -> count
                RovingMove.Previous -> if (current < 0) count else current
                RovingMove.Next -> current
            }
        repeat(count) {
            index += step
            if (index !in 0 until count) {
                if (!wrap && move != RovingMove.First && move != RovingMove.Last) return current
                index = (index + count) % count
            }
            if (isEnabled(index)) return index
        }
        return current
    }

    /** The move a key press asks for in a group laid out along [orientation], or null. Left and right swap in RTL. */
    public fun moveFor(
        key: Key,
        orientation: Orientation,
        layoutDirection: LayoutDirection,
    ): RovingMove? {
        val horizontal = orientation == Orientation.Horizontal
        val rtl = layoutDirection == LayoutDirection.Rtl
        return when (key) {
            Key.DirectionRight -> if (horizontal) (if (rtl) RovingMove.Previous else RovingMove.Next) else null
            Key.DirectionLeft -> if (horizontal) (if (rtl) RovingMove.Next else RovingMove.Previous) else null
            Key.DirectionDown -> if (horizontal) null else RovingMove.Next
            Key.DirectionUp -> if (horizontal) null else RovingMove.Previous
            Key.MoveHome -> RovingMove.First
            Key.MoveEnd -> RovingMove.Last
            else -> null
        }
    }
}

/**
 * Arrow-key and D-pad navigation for a single-selection group: Left/Right (Up/Down for [Orientation.Vertical], mirrored in
 * RTL) select the previous or next of [values], Home and End the first and last, and focus follows the selection. Apply it
 * to the container of the selectable items; disabled values can be skipped with [isEnabled].
 *
 * Pass a [focus] and mark each item with [rovingItem] so focus lands exactly on the newly selected item, including when
 * the move wraps around or jumps to the first or last item. Without it, focus only steps to the neighbouring focusable
 * for previous and next, and stays put for Home and End.
 *
 * ```
 * val focus = rememberRovingFocus<String>()
 * Row(Modifier.selectableGroup().rovingSelection(values, selected, onSelect, focus = focus)) { /* items use rovingItem */ }
 * ```
 */
@Composable
public fun <T : Any> Modifier.rovingSelection(
    values: List<T>,
    selected: T?,
    onSelect: (T) -> Unit,
    orientation: Orientation = Orientation.Horizontal,
    enabled: Boolean = true,
    wrap: Boolean = true,
    focus: RovingFocus<T>? = null,
    isEnabled: (T) -> Boolean = { true },
): Modifier {
    if (!enabled) return this
    val focusManager = LocalFocusManager.current
    val direction = LocalLayoutDirection.current
    val current by rememberUpdatedState(selected)
    val currentValues by rememberUpdatedState(values)
    val select by rememberUpdatedState(onSelect)
    val skip by rememberUpdatedState(isEnabled)
    return this.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
        val move = Roving.moveFor(event.key, orientation, direction) ?: return@onPreviewKeyEvent false
        val list = currentValues
        val from = list.indexOf(current)
        val to = Roving.target(list.size, from, move, wrap) { skip(list[it]) }
        if (to == from || to !in list.indices) return@onPreviewKeyEvent false
        select(list[to])
        val focused = focus?.requestFocus(list[to]) ?: false
        if (!focused) {
            when (move) {
                RovingMove.Next -> focusManager.moveFocus(FocusDirection.Next)
                RovingMove.Previous -> focusManager.moveFocus(FocusDirection.Previous)
                else -> Unit
            }
        }
        true
    }
}
