package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.primitives.rememberRovingFocus
import com.jcsoftdev.ui.primitives.rovingItem
import com.jcsoftdev.ui.primitives.rovingSelection
import com.jcsoftdev.ui.theme.UiTheme

@Immutable
public class SegmentedOption(
    public val value: String,
    public val label: String,
)

/** Colors of [Segmented]: track, selected segment and the labels. */
@Immutable
public class SegmentedColors(
    public val track: Color,
    public val selected: Color,
    public val selectedContent: Color,
    public val content: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        track: Color = this.track,
        selected: Color = this.selected,
        selectedContent: Color = this.selectedContent,
        content: Color = this.content,
    ): SegmentedColors = SegmentedColors(track, selected, selectedContent, content)
}

/** Default colors, shape and metrics of [Segmented]. */
public object SegmentedDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): SegmentedColors {
        val c = UiTheme.colors
        return SegmentedColors(c.segTrack, c.segOn, c.ink, c.ink2)
    }

    /** Shape of the track and of each segment; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Padding between the track edge and the segments. */
    public val trackPadding: Dp = 3.dp

    /** Padding inside a segment. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp)

    /** Label style (selected labels are bold); the theme `control`. */
    @Composable
    @ReadOnlyComposable
    public fun textStyle(selected: Boolean): TextStyle =
        UiTheme.typography.control.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold)
}

/** Exclusive selector for 2 to 4 options; one radio group to assistive tech, and the arrow keys, Home and End move the selection (see [rovingSelection]). Each segment is at least 48dp tall. */
@Composable
public fun Segmented(
    options: List<SegmentedOption>,
    value: String?,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: SegmentedColors = SegmentedDefaults.colors(),
    shape: Shape = SegmentedDefaults.shape,
    contentPadding: PaddingValues = SegmentedDefaults.contentPadding,
) {
    val minHeight = UiTheme.sizes.minTouchTarget
    val values = remember(options) { options.map { it.value } }
    val focus = rememberRovingFocus<String>()
    Row(
        modifier
            .dimWhenDisabled(enabled)
            .clip(shape)
            .background(colors.track)
            .padding(SegmentedDefaults.trackPadding)
            .horizontalScroll(rememberScrollState())
            .selectableGroup()
            .rovingSelection(values, value, onValueChange, enabled = enabled, focus = focus),
    ) {
        options.forEach { option ->
            val on = option.value == value
            Box(
                Modifier
                    .clip(shape)
                    .rovingItem(focus, option.value)
                    .selectable(on, enabled = enabled, role = Role.RadioButton) { onValueChange(option.value) }
                    .background(if (on) colors.selected else Color.Transparent)
                    .heightIn(min = minHeight)
                    .padding(contentPadding),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.label,
                    style = SegmentedDefaults.textStyle(on),
                    color = if (on) colors.selectedContent else colors.content,
                    maxLines = 1,
                )
            }
        }
    }
}
