package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.UiTheme

@Immutable
public class RadioOption(
    public val value: String,
    public val label: String,
    public val description: String? = null,
)

/** Colors of a [RadioGroup]: outlines, ring and dot, label and description. */
@Immutable
public class RadioColors(
    public val border: Color,
    public val selectedBorder: Color,
    public val ring: Color,
    public val selectedRing: Color,
    public val label: Color,
    public val description: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        border: Color = this.border,
        selectedBorder: Color = this.selectedBorder,
        ring: Color = this.ring,
        selectedRing: Color = this.selectedRing,
        label: Color = this.label,
        description: Color = this.description,
    ): RadioColors = RadioColors(border, selectedBorder, ring, selectedRing, label, description)
}

/** Default colors, shape and metrics of [RadioGroup]. */
public object RadioDefaults {
    /** Colors in the active theme; the selected row and ring use the accent. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): RadioColors {
        val c = UiTheme.colors
        return RadioColors(c.hair, c.accent, c.lineStrong, c.accent, c.ink, c.ink3)
    }

    /** Row shape; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Padding inside a row. */
    public val contentPadding: PaddingValues = PaddingValues(10.dp)

    /** Gap between rows. */
    public val itemSpacing: Dp = 8.dp

    /** Label style. */
    public val labelStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control.copy(fontWeight = FontWeight.SemiBold)

    /** Description style. */
    public val descriptionStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta
}

/** Controlled single choice list; [value] is the selected [RadioOption.value] or null. Each row is at least 48dp tall. */
@Composable
public fun RadioGroup(
    options: List<RadioOption>,
    value: String?,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: RadioColors = RadioDefaults.colors(),
    shape: Shape = RadioDefaults.shape,
    contentPadding: PaddingValues = RadioDefaults.contentPadding,
    itemSpacing: Dp = RadioDefaults.itemSpacing,
) {
    Column(modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(itemSpacing)) {
        options.forEach { option ->
            RadioRow(option, option.value == value, enabled, colors, shape, contentPadding, onValueChange)
        }
    }
}

@Composable
private fun RadioRow(
    option: RadioOption,
    selected: Boolean,
    enabled: Boolean,
    colors: RadioColors,
    shape: Shape,
    contentPadding: PaddingValues,
    onValueChange: (String) -> Unit,
) {
    val ring = if (selected) colors.selectedRing else colors.ring
    val sizes = UiTheme.sizes
    Row(
        Modifier
            .fillMaxWidth()
            .dimWhenDisabled(enabled)
            .clip(shape)
            .selectable(selected, enabled = enabled, role = Role.RadioButton) { onValueChange(option.value) }
            .border(sizes.borderWidth, if (selected) colors.selectedBorder else colors.border, shape)
            .heightIn(min = sizes.minTouchTarget)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(sizes.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(16.dp).drawBehind {
                val stroke = 1.5.dp.toPx()
                drawCircle(ring, size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
                if (selected) drawCircle(ring, 4.dp.toPx())
            },
        )
        Column(Modifier.weight(1f)) {
            Text(option.label, style = RadioDefaults.labelStyle, color = colors.label)
            if (option.description != null) Text(option.description, style = RadioDefaults.descriptionStyle, color = colors.description)
        }
    }
}
