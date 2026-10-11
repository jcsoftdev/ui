package com.jcsoftdev.ui.containers

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.IconButton
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.icons.CircleAlert
import com.jcsoftdev.ui.icons.CircleCheck
import com.jcsoftdev.ui.icons.Icon
import com.jcsoftdev.ui.icons.Icons
import com.jcsoftdev.ui.icons.Info
import com.jcsoftdev.ui.icons.TriangleAlert
import com.jcsoftdev.ui.icons.X
import com.jcsoftdev.ui.theme.UiTheme

/** Meaning of a [Banner]. Only [Danger] interrupts screen readers; the other tones are polite notices. */
public enum class BannerTone { Info, Success, Warning, Danger }

/** Colors of a [Banner]: fill, text and the leading icon. */
@Immutable
public class BannerColors(
    public val container: Color,
    public val content: Color,
    public val icon: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
        icon: Color = this.icon,
    ): BannerColors = BannerColors(container, content, icon)
}

/** Default colors, shape and metrics of [Banner]. */
public object BannerDefaults {
    /** English fallback for the dismiss button label; pass a localized `dismissLabel` to [Banner]. */
    public const val DISMISS_LABEL: String = "Dismiss"

    /** The colors of [tone] in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(tone: BannerTone = BannerTone.Info): BannerColors {
        val c = UiTheme.colors
        return when (tone) {
            BannerTone.Info -> BannerColors(c.infoSoft, c.ink, c.info)
            BannerTone.Success -> BannerColors(c.successSoft, c.ink, c.success)
            BannerTone.Warning -> BannerColors(c.warningSoft, c.ink, c.warning)
            BannerTone.Danger -> BannerColors(c.dangerSoft, c.ink, c.danger)
        }
    }

    /** The icon for [tone]. */
    public fun icon(tone: BannerTone): ImageVector =
        when (tone) {
            BannerTone.Info -> Icons.Info
            BannerTone.Success -> Icons.CircleCheck
            BannerTone.Warning -> Icons.TriangleAlert
            BannerTone.Danger -> Icons.CircleAlert
        }

    /** Corner shape; the theme `banner` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.banner

    /** Padding around the banner row. */
    public val contentPadding: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(horizontal = UiTheme.sizes.space14, vertical = UiTheme.sizes.space12)

    /** Gap between the icon, the text, the action and the dismiss button. */
    public val spacing: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.space12

    /** Size of the leading icon. */
    public val iconSize: Dp = 18.dp

    /** Offset that lines the leading icon up with the first text line. */
    public val iconTopPadding: Dp = 2.dp

    /** Size of the glyph in the dismiss button. */
    public val dismissIconSize: Dp = 16.dp

    /** Bold first line; the theme `rowTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.rowTitle.copy(fontWeight = FontWeight.SemiBold)

    /** Message style; the theme `control`. */
    public val messageStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control
}

/**
 * Inline notice for the whole screen or a section. [message] and the optional [title] are one live region (assertive for
 * [BannerTone.Danger], polite otherwise), so screen readers announce them when the banner appears. [icon] is decorative; pass
 * `null` to hide it. [action] sits at the end (for example a retry button) and [onDismiss] adds a close button labelled [dismissLabel].
 *
 * ```
 * Banner(
 *     message = "No pudimos guardar los cambios.",
 *     tone = BannerTone.Danger,
 *     title = "Sin conexión",
 *     onDismiss = { visible = false },
 *     dismissLabel = "Cerrar",
 *     action = { Button("Reintentar", onRetry, size = ButtonSize.Sm) },
 * )
 * ```
 *
 * Restyle one banner through [colors], [shape], [contentPadding], [titleStyle] and [messageStyle] (start from [BannerDefaults]).
 */
@Composable
public fun Banner(
    message: String,
    modifier: Modifier = Modifier,
    tone: BannerTone = BannerTone.Info,
    title: String? = null,
    icon: ImageVector? = BannerDefaults.icon(tone),
    onDismiss: (() -> Unit)? = null,
    dismissLabel: String = BannerDefaults.DISMISS_LABEL,
    action: (@Composable () -> Unit)? = null,
    colors: BannerColors = BannerDefaults.colors(tone),
    shape: Shape = BannerDefaults.shape,
    contentPadding: PaddingValues = BannerDefaults.contentPadding,
    titleStyle: TextStyle = BannerDefaults.titleStyle,
    messageStyle: TextStyle = BannerDefaults.messageStyle,
) {
    val mode = if (tone == BannerTone.Danger) LiveRegionMode.Assertive else LiveRegionMode.Polite
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(colors.container)
                .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(BannerDefaults.spacing),
        verticalAlignment = Alignment.Top,
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.padding(top = BannerDefaults.iconTopPadding),
                tint = colors.icon,
                size = BannerDefaults.iconSize,
            )
        }
        Column(Modifier.weight(1f).semantics(mergeDescendants = true) { liveRegion = mode }) {
            if (title != null) Text(title, style = titleStyle, color = colors.content)
            Text(message, style = messageStyle, color = colors.content)
        }
        CompositionLocalProvider(LocalContentColor provides colors.content) {
            action?.invoke()
            if (onDismiss != null) {
                IconButton(onDismiss, dismissLabel, size = ButtonSize.Sm) {
                    Icon(Icons.X, contentDescription = null, size = BannerDefaults.dismissIconSize)
                }
            }
        }
    }
}
