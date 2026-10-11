package com.jcsoftdev.ui.navigation

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

@Immutable
public class TabItem(
    public val value: String,
    public val label: String,
    public val count: Int? = null,
)

/** Colors of [Tabs]: baseline, active underline, labels and counts. */
@Immutable
public class TabsColors(
    public val divider: Color,
    public val indicator: Color,
    public val selectedContent: Color,
    public val content: Color,
    public val count: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        divider: Color = this.divider,
        indicator: Color = this.indicator,
        selectedContent: Color = this.selectedContent,
        content: Color = this.content,
        count: Color = this.count,
    ): TabsColors = TabsColors(divider, indicator, selectedContent, content, count)
}

/** Default colors and metrics of [Tabs]. */
public object TabsDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): TabsColors {
        val c = UiTheme.colors
        return TabsColors(c.hair, c.accentWord, c.ink, c.ink3, c.ink3)
    }

    /** Padding inside one tab. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 10.dp)

    /** Thickness of the active underline. */
    public val indicatorHeight: Dp = 2.dp

    /** Label style (the active label is bold); the theme `control`. */
    @Composable
    @ReadOnlyComposable
    public fun textStyle(selected: Boolean): TextStyle =
        UiTheme.typography.control.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold)
}

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
    colors: TabsColors = TabsDefaults.colors(),
    contentPadding: PaddingValues = TabsDefaults.contentPadding,
    indicatorHeight: Dp = TabsDefaults.indicatorHeight,
) {
    val sizes = UiTheme.sizes
    val countStyle = UiTheme.typography.count
    Row(
        modifier
            .drawBehind {
                drawLine(
                    colors.divider,
                    Offset(0f, size.height - 0.5f),
                    Offset(size.width, size.height - 0.5f),
                    sizes.borderWidth.toPx(),
                )
            }.horizontalScroll(rememberScrollState())
            .selectableGroup()
            .padding(horizontal = sizes.space8),
        horizontalArrangement = Arrangement.spacedBy(sizes.space2),
    ) {
        tabs.forEach { tab ->
            val on = tab.value == value
            Row(
                Modifier
                    .selectable(on, role = Role.Tab) { onValueChange(tab.value) }
                    .heightIn(min = sizes.minTouchTarget)
                    .drawBehind {
                        if (on) {
                            val h = indicatorHeight.toPx()
                            drawRect(
                                colors.indicator,
                                Offset(0f, size.height - h),
                                androidx.compose.ui.geometry
                                    .Size(size.width, h),
                            )
                        }
                    }.padding(contentPadding),
                horizontalArrangement = Arrangement.spacedBy(sizes.space6),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    tab.label,
                    style = TabsDefaults.textStyle(on),
                    color = if (on) colors.selectedContent else colors.content,
                    maxLines = 1,
                )
                if (tab.count != null) Text(tab.count.toString(), style = countStyle, color = colors.count)
            }
        }
    }
}
