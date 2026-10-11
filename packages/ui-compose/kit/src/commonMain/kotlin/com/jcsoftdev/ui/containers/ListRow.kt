package com.jcsoftdev.ui.containers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.dimWhenDisabled
import com.jcsoftdev.ui.foundation.pressScale
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [ListRow]: fill (normal and [ListRow] `selected`) and its three texts. */
@Immutable
public class ListRowColors(
    public val container: Color,
    public val selectedContainer: Color,
    public val title: Color,
    public val subtitle: Color,
    public val meta: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        selectedContainer: Color = this.selectedContainer,
        title: Color = this.title,
        subtitle: Color = this.subtitle,
        meta: Color = this.meta,
    ): ListRowColors = ListRowColors(container, selectedContainer, title, subtitle, meta)
}

/** Default colors, shape and metrics of [ListRow]. */
public object ListRowDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): ListRowColors {
        val c = UiTheme.colors
        return ListRowColors(Color.Transparent, c.accentSoft, c.ink, c.ink3, c.ink3)
    }

    /** Corner shape; square, so rows stack in a list. */
    public val shape: Shape = RectangleShape

    /** Least row height; the theme `minTouchTarget` (48dp). */
    public val minHeight: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.minTouchTarget

    /** Padding around the row. */
    public val contentPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space16, vertical = UiTheme.sizes.space10)

    /** Gap between the slots. */
    public val spacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space12

    /** Title style; the theme `rowTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.rowTitle

    /** Subtitle style; the theme `meta`. */
    public val subtitleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta

    /** Style of the trailing [ListRow] `meta` text; the theme `meta`. */
    public val metaStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta
}

/**
 * One row of a list or settings screen: [leading] slot, [title] with an optional [subtitle], a [meta] text and a [trailing] slot.
 * It is at least 48dp tall. With [onClick] the whole row is one button for accessibility (descendants merge into one node, so the
 * screen reader reads title, subtitle and meta together, and [selected] is exposed); without it only the title and subtitle
 * merge, so controls in [trailing] stay separate.
 *
 * ```
 * ListRow(
 *     title = "Corte clásico",
 *     subtitle = "30 min",
 *     meta = "S/ 35",
 *     leading = { Avatar("Ana Ruiz") },
 *     trailing = { Icon(Icons.ChevronRight, null) },
 *     onClick = { open(service) },
 * )
 * ```
 *
 * Restyle through [colors], [shape], [contentPadding], [minHeight] and the text styles (start from [ListRowDefaults]).
 */
@Composable
public fun ListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    meta: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    selected: Boolean = false,
    onClickLabel: String? = null,
    colors: ListRowColors = ListRowDefaults.colors(),
    shape: Shape = ListRowDefaults.shape,
    contentPadding: PaddingValues = ListRowDefaults.contentPadding,
    minHeight: Dp = ListRowDefaults.minHeight,
    titleStyle: TextStyle = ListRowDefaults.titleStyle,
    subtitleStyle: TextStyle = ListRowDefaults.subtitleStyle,
    metaStyle: TextStyle = ListRowDefaults.metaStyle,
) {
    val source = remember { MutableInteractionSource() }
    val interactive = onClick != null
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(
                    if (onClick != null) {
                        Modifier
                            .clickable(source, null, enabled, onClickLabel, Role.Button, onClick)
                            .pressScale(source)
                            .dimWhenDisabled(enabled)
                    } else {
                        Modifier
                    },
                ).then(if (interactive || selected) Modifier.semantics { this.selected = selected } else Modifier)
                .clip(shape)
                .background(if (selected) colors.selectedContainer else colors.container)
                .defaultMinSize(minHeight = minHeight)
                .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(ListRowDefaults.spacing),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        Column(Modifier.weight(1f).then(if (interactive) Modifier else Modifier.semantics(mergeDescendants = true) {})) {
            Text(title, style = titleStyle, color = colors.title)
            if (subtitle != null) Text(subtitle, style = subtitleStyle, color = colors.subtitle)
        }
        if (meta != null) Text(meta, style = metaStyle, color = colors.meta, maxLines = 1, overflow = TextOverflow.Ellipsis)
        trailing?.invoke()
    }
}
