package com.jcsoftdev.ui.containers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.icons.ArrowLeft
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a [PageHeader]: eyebrow, title and lede. */
@Immutable
public class PageHeaderColors(
    public val eyebrow: Color,
    public val title: Color,
    public val lede: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        eyebrow: Color = this.eyebrow,
        title: Color = this.title,
        lede: Color = this.lede,
    ): PageHeaderColors = PageHeaderColors(eyebrow, title, lede)
}

/** Default colors and metrics of [PageHeader]. */
public object PageHeaderDefaults {
    /** English fallback for the back button label; pass a localized `backLabel` to [PageHeader]. */
    public const val BACK_LABEL: String = "Back"

    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): PageHeaderColors {
        val c = UiTheme.colors
        return PageHeaderColors(c.ink3, c.ink, c.ink2)
    }

    /** Padding around the header row. */
    public val contentPadding: PaddingValues = PaddingValues()

    /** Gap between the back button, the titles and the actions. */
    public val spacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space12

    /** Page title style; the theme `pageTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.pageTitle

    /** Eyebrow style; the theme `meta`. */
    public val eyebrowStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta

    /** Lede style; the theme `lede`. */
    public val ledeStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.lede
}

/**
 * Top of a screen: optional [eyebrow], the [title] (announced as a heading), an optional [lede] and an [actions] slot at the end.
 * With [onBack] a back button labelled [backLabel] leads the row; set [handleSystemBack] to also answer the system back through the
 * kit's [BackHandler] (at [BackPriority.TAB], so sheets and dialogs above it win).
 *
 * ```
 * PageHeader(
 *     title = "Agenda",
 *     eyebrow = "Sucursal Miraflores",
 *     onBack = { navigator.pop() },
 *     backLabel = "Atrás",
 *     handleSystemBack = true,
 *     actions = { Button("Nueva cita", ::create, variant = ButtonVariant.Primary, size = ButtonSize.Sm) },
 * )
 * ```
 *
 * Restyle through [colors], [contentPadding] and the text styles (start from [PageHeaderDefaults]).
 */
@Composable
public fun PageHeader(
    title: String,
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    lede: String? = null,
    onBack: (() -> Unit)? = null,
    backLabel: String = PageHeaderDefaults.BACK_LABEL,
    handleSystemBack: Boolean = false,
    actions: (@Composable RowScope.() -> Unit)? = null,
    colors: PageHeaderColors = PageHeaderDefaults.colors(),
    contentPadding: PaddingValues = PageHeaderDefaults.contentPadding,
    titleStyle: TextStyle = PageHeaderDefaults.titleStyle,
    eyebrowStyle: TextStyle = PageHeaderDefaults.eyebrowStyle,
    ledeStyle: TextStyle = PageHeaderDefaults.ledeStyle,
) {
    if (onBack != null) BackHandler(enabled = handleSystemBack, priority = BackPriority.TAB, onBack = onBack)
    Row(
        modifier = modifier.fillMaxWidth().padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(PageHeaderDefaults.spacing),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(onBack, backLabel) { Icon(Icons.ArrowLeft, contentDescription = null) }
        }
        Column(Modifier.weight(1f)) {
            if (eyebrow != null) Text(eyebrow, style = eyebrowStyle, color = colors.eyebrow)
            Text(title, Modifier.semantics { heading() }, titleStyle, colors.title)
            if (lede != null) Text(lede, style = ledeStyle, color = colors.lede)
        }
        if (actions != null) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(PageHeaderDefaults.spacing),
                verticalAlignment = Alignment.CenterVertically,
                content = actions,
            )
        }
    }
}
