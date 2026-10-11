package com.jcsoftdev.ui.primitives

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority

/**
 * Where a popup of [popupSize] goes relative to [anchor] inside a window of [window] size, in window coordinates.
 *
 * - Horizontally the popup's start edge lines up with the anchor's (the end edge in right-to-left), then it is clamped
 *   inside the window.
 * - Vertically it opens below the anchor; when that does not fit it flips above; when neither fits it takes the side with
 *   more room and is clamped inside the window.
 *
 * ```
 * val at = anchoredPopupPosition(anchorBounds, windowSize, LayoutDirection.Ltr, IntSize(200, 300))
 * ```
 */
public fun anchoredPopupPosition(
    anchor: IntRect,
    window: IntSize,
    layoutDirection: LayoutDirection,
    popupSize: IntSize,
): IntOffset {
    val start = if (layoutDirection == LayoutDirection.Rtl) anchor.right - popupSize.width else anchor.left
    val x = start.coerceIn(0, (window.width - popupSize.width).coerceAtLeast(0))
    val below = window.height - anchor.bottom
    val above = anchor.top
    val y =
        when {
            popupSize.height <= below -> anchor.bottom
            popupSize.height <= above -> anchor.top - popupSize.height
            below >= above -> anchor.bottom.coerceAtMost((window.height - popupSize.height).coerceAtLeast(0))
            else -> (anchor.top - popupSize.height).coerceAtLeast(0)
        }
    return IntOffset(x, y)
}

/**
 * [PopupPositionProvider] that applies [anchoredPopupPosition] (below, flip above, RTL aware, inside the window).
 *
 * ```
 * Popup(popupPositionProvider = AnchoredPopupPositionProvider, onDismissRequest = ::close) { MyMenu() }
 * ```
 */
public object AnchoredPopupPositionProvider : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset = anchoredPopupPosition(anchorBounds, windowSize, layoutDirection, popupContentSize)
}

/**
 * Popup anchored to the layout it is declared in (declare it in the same `Box` as the trigger), shown while [expanded].
 * A tap outside and system back (kit back dispatcher, [backPriority]) call [onDismissRequest]; focus moves into the popup
 * when [focusable]. The popup draws nothing itself.
 *
 * ```
 * Box {
 *     MyTrigger(onClick = { open = true })
 *     AnchoredPopup(open, onDismissRequest = { open = false }) {
 *         Column(Modifier.menuGroup().background(Color.White)) {
 *             Text("Edit", Modifier.menuItem { open = false; edit() })
 *         }
 *     }
 * }
 * ```
 */
@Composable
public fun AnchoredPopup(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    positionProvider: PopupPositionProvider = AnchoredPopupPositionProvider,
    focusable: Boolean = true,
    backPriority: Int = BackPriority.SHEET + 100,
    content: @Composable () -> Unit,
) {
    BackHandler(enabled = expanded, priority = backPriority) { onDismissRequest() }
    if (!expanded) return
    Popup(
        popupPositionProvider = positionProvider,
        onDismissRequest = onDismissRequest,
        properties = PopupProperties(focusable = focusable, dismissOnBackPress = true),
    ) {
        Box(modifier) { content() }
    }
}

/**
 * A plain menu action: a click target with `Role.Button`.
 *
 * ```
 * Text("Edit", Modifier.menuItem { open = false; edit() })
 * ```
 */
public fun Modifier.menuItem(
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier = clickable(enabled = enabled, role = Role.Button, onClick = onClick)

/**
 * A checkable menu entry: `Role.Checkbox` with its [checked] state (web `menuitemcheckbox`).
 *
 * ```
 * Text("Compact", Modifier.menuCheckboxItem(compact) { compact = it })
 * ```
 */
public fun Modifier.menuCheckboxItem(
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
): Modifier = toggleable(value = checked, enabled = enabled, role = Role.Checkbox, onValueChange = onCheckedChange)

/**
 * One entry of a single-choice menu group: `Role.RadioButton` with its [selected] state (web `menuitemradio`).
 *
 * ```
 * Column(Modifier.menuGroup()) { Text("Name", Modifier.menuRadioItem(sort == "name") { sort = "name" }) }
 * ```
 */
public fun Modifier.menuRadioItem(
    selected: Boolean,
    enabled: Boolean = true,
    onSelect: () -> Unit,
): Modifier = selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onSelect)

/** Marks the container of menu entries as one selectable group to assistive technology; see [menuRadioItem]. */
public fun Modifier.menuGroup(): Modifier = selectableGroup()
