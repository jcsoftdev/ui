package com.jcsoftdev.ui.states

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of an [EmptyState]: icon, title and description. */
@Immutable
public class EmptyStateColors(
    public val icon: Color,
    public val title: Color,
    public val description: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        icon: Color = this.icon,
        title: Color = this.title,
        description: Color = this.description,
    ): EmptyStateColors = EmptyStateColors(icon, title, description)
}

/** Default colors and metrics of [EmptyState] and [ErrorState]. */
public object EmptyStateDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): EmptyStateColors {
        val c = UiTheme.colors
        return EmptyStateColors(c.ink3, c.ink, c.ink3)
    }

    /** Padding around the block. */
    public val contentPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space16, vertical = UiTheme.sizes.space28)

    /** Gap between the icon, texts and action. */
    public val spacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space8

    /** Title style; the theme `rowTitle` in semibold. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.rowTitle.copy(fontWeight = FontWeight.SemiBold)

    /** Description style; the theme `control`. */
    public val descriptionStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control
}

/**
 * Centered placeholder for a list or screen without content. The [title] is a heading; [icon] is decorative (hidden from
 * accessibility); [action] is the call to action, for example a button.
 *
 * ```
 * EmptyState(
 *     title = "Sin citas para hoy",
 *     description = "Cuando un cliente reserve, su cita aparecerá aquí.",
 *     icon = { Icon(Icons.CalendarX, null, size = 32.dp) },
 *     action = { Button("Nueva cita", ::create) },
 * )
 * ```
 *
 * Restyle through [colors], [contentPadding] and the text styles (start from [EmptyStateDefaults]).
 */
@Composable
public fun EmptyState(
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    icon: (@Composable () -> Unit)? = null,
    action: (@Composable () -> Unit)? = null,
    colors: EmptyStateColors = EmptyStateDefaults.colors(),
    contentPadding: PaddingValues = EmptyStateDefaults.contentPadding,
    titleStyle: TextStyle = EmptyStateDefaults.titleStyle,
    descriptionStyle: TextStyle = EmptyStateDefaults.descriptionStyle,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(contentPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EmptyStateDefaults.spacing),
    ) {
        if (icon != null) {
            CompositionLocalProvider(LocalContentColor provides colors.icon) {
                Column(Modifier.clearAndSetSemantics {}) { icon() }
            }
        }
        Text(title, Modifier.semantics { heading() }, titleStyle, colors.title, TextAlign.Center)
        if (description != null) Text(description, style = descriptionStyle, color = colors.description, textAlign = TextAlign.Center)
        if (action != null) action()
    }
}
