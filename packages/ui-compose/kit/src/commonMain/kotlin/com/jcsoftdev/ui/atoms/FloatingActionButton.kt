package com.jcsoftdev.ui.atoms

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of a floating action button: fill and content (icon and label). */
@Immutable
public class FabColors(
    public val container: Color,
    public val content: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
    ): FabColors = FabColors(container, content)
}

/** Default colors, shape and metrics of [FloatingActionButton] and [ExtendedFloatingActionButton]; read the theme, so a custom [UiTheme] flows through. */
public object FabDefaults {
    /** The accent fill with its `onAccent` content. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): FabColors {
        val c = UiTheme.colors
        return FabColors(c.accent, c.onAccent)
    }

    /** The colors while disabled: the neutral fill of a disabled primary [Button], with a label that stays legible. */
    @Composable
    @ReadOnlyComposable
    public fun disabledColors(): FabColors {
        val c = ButtonDefaults.disabledColors(ButtonVariant.Primary)
        return FabColors(c.container, c.content)
    }

    /** A full pill; the icon-only button is a circle. The theme `pill` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.pill

    /** Height of both buttons and the width of the icon-only one. Above the 48dp touch target. */
    public val size: Dp = 56.dp

    /** Drop shadow that lifts the button off the content; none while disabled. */
    public val elevation: Dp = 6.dp

    /** Gap kept between a button and the screen edge when it floats in a corner. */
    public val margin: Dp = 16.dp

    /** Horizontal padding of the extended button. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp)

    /** Gap between the icon and the label of the extended button. */
    public val iconSpacing: Dp = 8.dp

    /** Label style of the extended button; the theme `control` in bold, one step larger. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control.copy(fontSize = UiTheme.typography.control.fontSize * 1.1f, fontWeight = FontWeight.Bold)
}

/**
 * Icon-only floating action button: a 56dp circle for the one primary action of a screen. [contentDescription] is required
 * (already localized) because there is no visible label; the semantics role is a button and the touch target is at least 48dp.
 * Press feedback follows the theme motion, so it is a jump cut with reduced motion.
 *
 * Place it in a `Box` over the content (for example `Modifier.align(Alignment.BottomEnd).padding(FabDefaults.margin)`), above
 * a [com.jcsoftdev.ui.navigation.BottomActionBar] or dock when there is one.
 */
@Composable
public fun FloatingActionButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: FabColors = FabDefaults.colors(),
    disabledColors: FabColors = FabDefaults.disabledColors(),
    shape: Shape = FabDefaults.shape,
    elevation: Dp = FabDefaults.elevation,
    icon: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val shown = if (enabled) colors else disabledColors
    Box(
        modifier =
            modifier
                .pressableTarget(onClick, enabled, Role.Button, source)
                .semantics { this.contentDescription = contentDescription }
                .size(FabDefaults.size)
                .shadow(if (enabled) elevation else 0.dp, shape, clip = false)
                .clip(shape)
                .background(shown.container),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(LocalContentColor provides shown.content, content = icon)
    }
}

/**
 * Floating action button with a label: a 56dp pill with an optional [icon] and [text]. Set [expanded] to false to collapse it
 * to the icon (for example while the list scrolls); the label then becomes the accessibility description, and the width
 * animates with the theme motion (a jump cut when animations are removed). Without an [icon] the button never collapses.
 *
 * The label wraps to two lines above a font scale of 1.3 instead of being cut.
 */
@Composable
public fun ExtendedFloatingActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    expanded: Boolean = true,
    colors: FabColors = FabDefaults.colors(),
    disabledColors: FabColors = FabDefaults.disabledColors(),
    shape: Shape = FabDefaults.shape,
    elevation: Dp = FabDefaults.elevation,
    contentPadding: PaddingValues = FabDefaults.contentPadding,
    textStyle: TextStyle = FabDefaults.textStyle,
    icon: (@Composable () -> Unit)? = null,
) {
    val source = remember { MutableInteractionSource() }
    val shown = if (enabled) colors else disabledColors
    val showText = expanded || icon == null
    val motion = UiTheme.motion
    Row(
        modifier =
            modifier
                .pressableTarget(onClick, enabled, Role.Button, source)
                .semantics { if (!showText) this.contentDescription = text }
                .shadow(if (enabled) elevation else 0.dp, shape, clip = false)
                .clip(shape)
                .background(shown.container)
                .animateContentSize(motion.tween())
                .defaultMinSize(minWidth = FabDefaults.size, minHeight = FabDefaults.size)
                .padding(if (showText) contentPadding else PaddingValues(0.dp)),
        horizontalArrangement = Arrangement.spacedBy(FabDefaults.iconSpacing, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides shown.content) {
            if (icon != null) icon()
            if (showText) {
                Text(text, Modifier.weight(1f, fill = false), textStyle, maxLines = labelMaxLines(), overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
