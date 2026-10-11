package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.DISABLED_ALPHA
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

@Immutable
public class SegmentedOption(
    public val value: String,
    public val label: String,
)

/** Exclusive selector for 2 to 4 options; one radio group to assistive tech. Each segment is at least 48dp tall. */
@Composable
public fun Segmented(
    options: List<SegmentedOption>,
    value: String?,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = UiTheme.colors
    Row(
        modifier
            .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
            .clip(UiShapes.control)
            .background(colors.segTrack)
            .padding(3.dp)
            .horizontalScroll(rememberScrollState())
            .selectableGroup(),
    ) {
        options.forEach { option ->
            val on = option.value == value
            Box(
                Modifier
                    .clip(UiShapes.control)
                    .selectable(on, enabled = enabled, role = Role.RadioButton) { onValueChange(option.value) }
                    .background(if (on) colors.segOn else androidx.compose.ui.graphics.Color.Transparent)
                    .heightIn(min = 48.dp)
                    .padding(horizontal = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.label,
                    style = UiTypography.control.copy(fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold),
                    color = if (on) colors.ink else colors.ink2,
                    maxLines = 1,
                )
            }
        }
    }
}
