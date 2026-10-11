package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.atoms.drawCheckGlyph
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.theme.UiTheme

/** A menu opens above sheets and dialogs (a Select inside a sheet, say), so back closes it first. */
private const val MENU_BACK_PRIORITY = BackPriority.SHEET + 100

/** Builder for the entries of a [Menu]. */
public interface MenuScope {
    /** A plain action. [destructive] colors it as dangerous. */
    public fun item(
        label: String,
        onClick: () -> Unit,
        enabled: Boolean = true,
        destructive: Boolean = false,
    )

    /** A checkbox entry: `menuitemcheckbox` in the web contract. */
    public fun checkboxItem(
        label: String,
        checked: Boolean,
        onCheckedChange: (Boolean) -> Unit,
        enabled: Boolean = true,
    )

    /** One entry of a single-choice group: `menuitemradio` in the web contract. */
    public fun radioItem(
        label: String,
        selected: Boolean,
        onSelect: () -> Unit,
        enabled: Boolean = true,
    )

    public fun separator()
}

@Immutable
private class MenuEntry(
    val kind: Kind,
    val label: String = "",
    val checked: Boolean = false,
    val enabled: Boolean = true,
    val destructive: Boolean = false,
    val onClick: () -> Unit = {},
) {
    enum class Kind { Item, Checkbox, Radio, Separator }
}

private class MenuBuilder : MenuScope {
    val entries = mutableListOf<MenuEntry>()

    override fun item(
        label: String,
        onClick: () -> Unit,
        enabled: Boolean,
        destructive: Boolean,
    ) {
        entries += MenuEntry(MenuEntry.Kind.Item, label, enabled = enabled, destructive = destructive, onClick = onClick)
    }

    override fun checkboxItem(
        label: String,
        checked: Boolean,
        onCheckedChange: (Boolean) -> Unit,
        enabled: Boolean,
    ) {
        entries += MenuEntry(MenuEntry.Kind.Checkbox, label, checked, enabled, onClick = { onCheckedChange(!checked) })
    }

    override fun radioItem(
        label: String,
        selected: Boolean,
        onSelect: () -> Unit,
        enabled: Boolean,
    ) {
        entries += MenuEntry(MenuEntry.Kind.Radio, label, selected, enabled, onClick = onSelect)
    }

    override fun separator() {
        entries += MenuEntry(MenuEntry.Kind.Separator)
    }
}

/** Colors of a [Menu]: surface, outline, separators, entries, destructive entries and the chosen radio entry. */
@Immutable
public class MenuColors(
    public val container: Color,
    public val border: Color,
    public val separator: Color,
    public val content: Color,
    public val destructive: Color,
    public val selected: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        separator: Color = this.separator,
        content: Color = this.content,
        destructive: Color = this.destructive,
        selected: Color = this.selected,
    ): MenuColors = MenuColors(container, border, separator, content, destructive, selected)
}

/** Default colors, shapes and metrics of [Menu]. */
public object MenuDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): MenuColors {
        val c = UiTheme.colors
        return MenuColors(c.float, c.hair, c.hair, c.ink, c.danger, c.accentInk)
    }

    /** Shape of the menu surface; the theme `card` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.card

    /** Shape of one entry; the theme `event` shape. */
    public val itemShape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.event

    /** Fixed menu width. */
    public val width: Dp = 220.dp

    /** Tallest the menu grows before it scrolls. */
    public val maxHeight: Dp = 360.dp

    /** Padding between the surface and the entries. */
    public val contentPadding: PaddingValues = PaddingValues(6.dp)

    /** Padding inside one entry. */
    public val itemPadding: PaddingValues = PaddingValues(horizontal = 10.dp)

    /** Entry text style (the chosen radio entry is bold); the theme `body`. */
    @Composable
    @ReadOnlyComposable
    public fun textStyle(bold: Boolean = false): TextStyle =
        UiTheme.typography.body.copy(fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
}

/**
 * Dropdown anchored to the layout it is declared in (put it in the same `Box` as the trigger). It opens below the
 * anchor, flips above when there is no room and stays inside the window. Choosing an entry runs its callback and then
 * calls [onDismissRequest]; a tap outside and system back (kit back dispatcher) call it too. Entries expose
 * `Role.Button`, `Role.Checkbox` and `Role.RadioButton` with their state; the radio entries form a selectable group.
 */
@Composable
public fun Menu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    colors: MenuColors = MenuDefaults.colors(),
    shape: Shape = MenuDefaults.shape,
    itemShape: Shape = MenuDefaults.itemShape,
    width: Dp = MenuDefaults.width,
    maxHeight: Dp = MenuDefaults.maxHeight,
    contentPadding: PaddingValues = MenuDefaults.contentPadding,
    content: MenuScope.() -> Unit,
) {
    BackHandler(enabled = expanded, priority = MENU_BACK_PRIORITY) { onDismissRequest() }
    if (!expanded) return
    val entries = MenuBuilder().apply(content).entries
    val borderWidth = UiTheme.sizes.borderWidth
    Popup(
        popupPositionProvider = remember { BelowAnchorPositionProvider },
        onDismissRequest = onDismissRequest,
        properties = PopupProperties(focusable = true, dismissOnBackPress = true),
    ) {
        Column(
            modifier
                .width(width)
                .heightIn(max = maxHeight)
                .clip(shape)
                .background(colors.container)
                .border(borderWidth, colors.border, shape)
                .verticalScroll(rememberScrollState())
                .selectableGroup()
                .padding(contentPadding),
        ) {
            entries.forEach { MenuRow(it, colors, itemShape, onDismissRequest) }
        }
    }
}

@Composable
private fun MenuRow(
    entry: MenuEntry,
    colors: MenuColors,
    itemShape: Shape,
    dismiss: () -> Unit,
) {
    val sizes = UiTheme.sizes
    if (entry.kind == MenuEntry.Kind.Separator) {
        Box(
            Modifier
                .fillMaxWidth()
                .padding(vertical = sizes.space6)
                .height(sizes.borderWidth)
                .background(colors.separator),
        )
        return
    }
    val run = {
        entry.onClick()
        dismiss()
    }
    val click =
        when (entry.kind) {
            MenuEntry.Kind.Item -> Modifier.clickable(enabled = entry.enabled, role = Role.Button, onClick = run)
            MenuEntry.Kind.Checkbox -> Modifier.toggleable(entry.checked, entry.enabled, Role.Checkbox) { run() }
            else -> Modifier.selectable(entry.checked, entry.enabled, Role.RadioButton) { run() }
        }
    val tint =
        when {
            entry.destructive -> colors.destructive
            entry.kind == MenuEntry.Kind.Radio && entry.checked -> colors.selected
            else -> colors.content
        }
    Row(
        Modifier
            .fillMaxWidth()
            .dimWhenDisabled(entry.enabled)
            .clip(itemShape)
            .then(click)
            .defaultMinSize(minHeight = sizes.minTouchTarget)
            .padding(MenuDefaults.itemPadding),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            entry.label,
            Modifier.weight(1f),
            style = MenuDefaults.textStyle(entry.kind == MenuEntry.Kind.Radio && entry.checked),
            color = tint,
        )
        if (entry.kind != MenuEntry.Kind.Item && entry.checked) {
            Box(Modifier.size(16.dp).drawBehind { drawCheckGlyph(tint, 1.8.dp.toPx()) })
        }
    }
}

private object BelowAnchorPositionProvider : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset = menuPosition(anchorBounds, windowSize, layoutDirection, popupContentSize)
}

/**
 * Aligns the menu's start edge with the anchor's (the right edge, minus the width, in right-to-left), keeps it inside the
 * window, and opens below the anchor, above it when only that fits, or on the side with more room when neither does.
 */
internal fun menuPosition(
    anchor: IntRect,
    window: IntSize,
    direction: LayoutDirection,
    size: IntSize,
): IntOffset {
    val start = if (direction == LayoutDirection.Rtl) anchor.right - size.width else anchor.left
    val x = start.coerceIn(0, (window.width - size.width).coerceAtLeast(0))
    val below = window.height - anchor.bottom
    val above = anchor.top
    val y =
        when {
            size.height <= below -> anchor.bottom
            size.height <= above -> anchor.top - size.height
            below >= above -> anchor.bottom.coerceAtMost((window.height - size.height).coerceAtLeast(0))
            else -> (anchor.top - size.height).coerceAtLeast(0)
        }
    return IntOffset(x, y)
}
