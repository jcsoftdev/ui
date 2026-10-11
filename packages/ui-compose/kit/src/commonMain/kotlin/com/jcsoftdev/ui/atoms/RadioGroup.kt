package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

@Immutable
public class RadioOption(
    public val value: String,
    public val label: String,
    public val description: String? = null,
)

/** Controlled single choice list; [value] is the selected [RadioOption.value] or null. Each row is at least 48dp tall. */
@Composable
public fun RadioGroup(
    options: List<RadioOption>,
    value: String?,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Column(modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            RadioRow(option, option.value == value, enabled, onValueChange)
        }
    }
}

@Composable
private fun RadioRow(
    option: RadioOption,
    selected: Boolean,
    enabled: Boolean,
    onValueChange: (String) -> Unit,
) {
    val colors = UiTheme.colors
    val ring = if (selected) colors.accent else colors.lineStrong
    Row(
        Modifier
            .fillMaxWidth()
            .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
            .clip(UiShapes.control)
            .selectable(selected, enabled = enabled, role = Role.RadioButton) { onValueChange(option.value) }
            .border(1.dp, if (selected) colors.accent else colors.hair, UiShapes.control)
            .heightIn(min = 48.dp)
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(16.dp).drawBehind {
                val stroke = 1.5.dp.toPx()
                drawCircle(ring, size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
                if (selected) drawCircle(colors.accent, 4.dp.toPx())
            },
        )
        Column(Modifier.weight(1f)) {
            Text(option.label, style = UiTypography.control.copy(fontWeight = FontWeight.SemiBold))
            if (option.description != null) Text(option.description, style = UiTypography.meta, color = colors.ink3)
        }
    }
}
