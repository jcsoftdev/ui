package com.jcsoftdev.ui.overlays

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.primitives.ToastHost
import com.jcsoftdev.ui.primitives.ToastHostState
import com.jcsoftdev.ui.primitives.ToastItem
import com.jcsoftdev.ui.primitives.ToastTone
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of the [Toaster]: surface, text and the status dot of each tone (the neutral tone has no dot). */
@Immutable
public class ToastColors(
    public val container: Color,
    public val content: Color,
    public val success: Color,
    public val error: Color,
    public val info: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
        success: Color = this.success,
        error: Color = this.error,
        info: Color = this.info,
    ): ToastColors = ToastColors(container, content, success, error, info)

    internal fun dot(tone: ToastTone): Color? =
        when (tone) {
            ToastTone.Neutral -> null
            ToastTone.Success -> success
            ToastTone.Error -> error
            ToastTone.Info -> info
        }
}

/** Default colors, shape and metrics of the [Toaster]. */
public object ToasterDefaults {
    /** Colors in the active theme; the surface is dark in both themes, so the dots use the dark palette. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): ToastColors {
        val c = UiTheme.colors
        return ToastColors(c.toastBg, c.toastInk, UiColors.Dark.success, UiColors.Dark.danger, UiColors.Dark.info)
    }

    /** Shape of a toast; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Widest a toast grows. */
    public val maxWidth: Dp = 420.dp

    /** Padding inside a toast. */
    public val contentPadding: PaddingValues = PaddingValues(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 6.dp)

    /** Diameter of the tone dot. */
    public val dotSize: Dp = 8.dp

    /** Message style; the theme `control`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control

    /** Gap between the toasts and the window edges (inside the safe insets), at the start, end and bottom; the theme `space12`. `bottomBarHeight` adds to the bottom. */
    public val margin: PaddingValues
        @Composable @ReadOnlyComposable
        get() = PaddingValues(start = UiTheme.sizes.space12, end = UiTheme.sizes.space12, bottom = UiTheme.sizes.space12)
}

/**
 * Draws the toasts of [state] centered above the bottom safe insets (which include the keyboard), lifted by
 * [bottomBarHeight] when the host screen has its own bottom bar, with [margin] to the other edges. It is the styled
 * layer over the headless [ToastHost]: each toast is a polite live region; touching or focusing a toast pauses its
 * countdown, and the system accessibility timeout (when the platform gives one) replaces its duration. [Toaster] draws
 * above sheets and dialogs.
 */
@Composable
public fun Toaster(
    state: ToastHostState,
    modifier: Modifier = Modifier,
    bottomBarHeight: Dp = 0.dp,
    colors: ToastColors = ToasterDefaults.colors(),
    shape: Shape = ToasterDefaults.shape,
    maxWidth: Dp = ToasterDefaults.maxWidth,
    contentPadding: PaddingValues = ToasterDefaults.contentPadding,
    textStyle: TextStyle = ToasterDefaults.textStyle,
    margin: PaddingValues = ToasterDefaults.margin,
    dotSize: Dp = ToasterDefaults.dotSize,
) {
    val sizes = UiTheme.sizes
    val lifted = remember(margin, bottomBarHeight) { LiftedPadding(margin, bottomBarHeight) }
    ToastHost(
        state,
        modifier,
        contentPadding = lifted,
        spacing = sizes.space8,
    ) { item -> ToastRow(item, state, colors, shape, maxWidth, contentPadding, textStyle, dotSize) }
}

private class LiftedPadding(
    private val base: PaddingValues,
    private val extraBottom: Dp,
) : PaddingValues {
    override fun calculateLeftPadding(layoutDirection: LayoutDirection) = base.calculateLeftPadding(layoutDirection)

    override fun calculateTopPadding() = base.calculateTopPadding()

    override fun calculateRightPadding(layoutDirection: LayoutDirection) = base.calculateRightPadding(layoutDirection)

    override fun calculateBottomPadding() = base.calculateBottomPadding() + extraBottom
}

@Composable
private fun ToastRow(
    item: ToastItem,
    state: ToastHostState,
    colors: ToastColors,
    shape: Shape,
    maxWidth: Dp,
    contentPadding: PaddingValues,
    textStyle: TextStyle,
    dotSize: Dp,
) {
    val sizes = UiTheme.sizes
    Row(
        Modifier
            .widthIn(max = maxWidth)
            .clip(shape)
            .background(colors.container)
            .defaultMinSize(minHeight = sizes.minTouchTarget)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(sizes.space10),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val dot = colors.dot(item.tone)
        if (dot != null) Box(Modifier.size(dotSize).background(dot, CircleShape))
        Text(item.message, Modifier.weight(1f, fill = false), style = textStyle, color = colors.content)
        val action = item.action
        if (action != null) {
            Box(
                Modifier
                    .defaultMinSize(minHeight = sizes.minTouchTarget)
                    .clip(shape)
                    .clickable(role = Role.Button) {
                        action.onClick()
                        state.dismiss(item.id)
                    }.padding(horizontal = sizes.space12),
                contentAlignment = Alignment.Center,
            ) {
                Text(action.label, style = textStyle.copy(fontWeight = FontWeight.Bold), color = colors.content)
            }
        }
    }
}
