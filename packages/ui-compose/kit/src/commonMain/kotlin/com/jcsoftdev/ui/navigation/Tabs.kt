package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

@Immutable
public class TabItem(
    public val value: String,
    public val label: String,
    public val count: Int? = null,
)

/**
 * Tab strip with an underline on the active tab; scrolls sideways when the tabs do not fit. Panels are the caller's:
 * show the content that matches [value]. Tabs expose `Role.Tab` and selected state.
 */
@Composable
public fun Tabs(
    tabs: List<TabItem>,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = UiTheme.colors
    Row(
        modifier
            .drawBehind { drawLine(colors.hair, Offset(0f, size.height - 0.5f), Offset(size.width, size.height - 0.5f), 1.dp.toPx()) }
            .horizontalScroll(rememberScrollState())
            .selectableGroup()
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        tabs.forEach { tab ->
            val on = tab.value == value
            Row(
                Modifier
                    .selectable(on, role = Role.Tab) { onValueChange(tab.value) }
                    .heightIn(min = 48.dp)
                    .drawBehind {
                        if (on) {
                            val h = 2.dp.toPx()
                            drawRect(
                                colors.accentWord,
                                Offset(0f, size.height - h),
                                androidx.compose.ui.geometry
                                    .Size(size.width, h),
                            )
                        }
                    }.padding(horizontal = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    tab.label,
                    style = UiTypography.control.copy(fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold),
                    color = if (on) colors.ink else colors.ink3,
                    maxLines = 1,
                )
                if (tab.count != null) Text(tab.count.toString(), style = UiTypography.count, color = colors.ink3)
            }
        }
    }
}
