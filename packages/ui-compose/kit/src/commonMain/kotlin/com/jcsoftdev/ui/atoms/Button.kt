package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.theme.UiTheme

public enum class ButtonVariant { Primary, Secondary, Ghost, Danger }

public enum class ButtonSize { Sm, Md, Lg }

/** Colors of a button: fill, content (label, icons, spinner) and an optional [border]. */
@Immutable
public class ButtonColors(
    public val container: Color,
    public val content: Color,
    public val border: Color = Color.Transparent,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
        border: Color = this.border,
    ): ButtonColors = ButtonColors(container, content, border)
}

/** Default colors, shape, metrics and text styles of [Button] and [IconButton]; read the theme, so a custom [UiTheme] flows through. */
public object ButtonDefaults {
    /** The colors of [variant] in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(variant: ButtonVariant = ButtonVariant.Secondary): ButtonColors {
        val c = UiTheme.colors
        return when (variant) {
            ButtonVariant.Primary -> ButtonColors(c.accent, c.onAccent)
            ButtonVariant.Secondary -> ButtonColors(c.surface, c.ink, c.lineControl)
            ButtonVariant.Ghost -> ButtonColors(Color.Transparent, c.ink2)
            ButtonVariant.Danger -> ButtonColors(c.dangerSoft, c.danger)
        }
    }

    /**
     * The colors of [variant] while the button is disabled. The label keeps at least 4.5:1 against the fill (a dimmed
     * primary button would fall to about 1.4:1 for its label), and the fill drops to a neutral tone so the button still
     * reads as unavailable; there is no opacity dimming on top.
     */
    @Composable
    @ReadOnlyComposable
    public fun disabledColors(variant: ButtonVariant = ButtonVariant.Secondary): ButtonColors {
        val c = UiTheme.colors
        return when (variant) {
            ButtonVariant.Primary, ButtonVariant.Danger -> ButtonColors(c.sunken, c.ink3)
            ButtonVariant.Secondary -> ButtonColors(c.surface, c.ink3, c.line)
            ButtonVariant.Ghost -> ButtonColors(Color.Transparent, c.ink3)
        }
    }

    /** Corner shape; the theme `control` shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.control

    /** Visual (not touch target) height of [size]. */
    @Composable
    @ReadOnlyComposable
    public fun height(size: ButtonSize = ButtonSize.Md): Dp {
        val s = UiTheme.sizes
        return when (size) {
            ButtonSize.Sm -> s.controlHeightSm
            ButtonSize.Md -> s.controlHeight
            ButtonSize.Lg -> s.controlHeightLg
        }
    }

    /** Padding around the label row. */
    @Composable
    @ReadOnlyComposable
    public fun contentPadding(size: ButtonSize = ButtonSize.Md): PaddingValues {
        val s = UiTheme.sizes
        return PaddingValues(horizontal = if (size == ButtonSize.Sm) s.space12 else s.space14)
    }

    /** The default loading indicator: a spinning arc in the label color. Replace it through [Button]'s `loadingIndicator`. */
    public val LoadingIndicator: @Composable (color: Color) -> Unit = { color -> Spinner(color) }

    /** Gap between the spinner or [Button] `leading` slot, the label and `trailing`. */
    public val iconSpacing: Dp = 6.dp

    /** Label style of [size]; the primary variant is bold. */
    @Composable
    @ReadOnlyComposable
    public fun textStyle(
        size: ButtonSize = ButtonSize.Md,
        variant: ButtonVariant = ButtonVariant.Secondary,
    ): TextStyle {
        val control = UiTheme.typography.control
        val base =
            when (size) {
                ButtonSize.Sm -> control.copy(fontSize = 12.5.sp)
                ButtonSize.Md -> control
                ButtonSize.Lg -> control.copy(fontSize = 14.sp)
            }
        return if (variant == ButtonVariant.Primary) base.copy(fontWeight = FontWeight.Bold) else base
    }
}

/**
 * Action button. [loading] swaps [leading] for a spinner and ignores taps without dimming; [loadingDescription]
 * (already localized) is announced as the state. The visual height is 30/36/52dp (sm/md/lg) by default, [block] fills the width,
 * the touch target is at least the theme `minTouchTarget` (48dp).
 *
 * A disabled button swaps to [disabledColors] (a neutral fill with a label that stays legible) instead of dimming its
 * [colors], so pass both when you restyle a button.
 *
 * Restyle one button through [colors], [disabledColors], [shape], [height], [contentPadding], [textStyle] and the [loadingIndicator] glyph (start from [ButtonDefaults]), or
 * every button through the [UiTheme] tokens.
 */
@Composable
public fun Button(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Secondary,
    size: ButtonSize = ButtonSize.Md,
    block: Boolean = false,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String? = null,
    colors: ButtonColors = ButtonDefaults.colors(variant),
    disabledColors: ButtonColors = ButtonDefaults.disabledColors(variant),
    shape: Shape = ButtonDefaults.shape,
    height: Dp = ButtonDefaults.height(size),
    contentPadding: PaddingValues = ButtonDefaults.contentPadding(size),
    textStyle: TextStyle = ButtonDefaults.textStyle(size, variant),
    loadingIndicator: @Composable (color: Color) -> Unit = ButtonDefaults.LoadingIndicator,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val source = remember { MutableInteractionSource() }
    val borderWidth = UiTheme.sizes.borderWidth
    val shown = if (enabled) colors else disabledColors
    Row(
        modifier =
            modifier
                .then(if (block) Modifier.fillMaxWidth() else Modifier)
                .pressableTarget(onClick, enabled && !loading, Role.Button, source)
                .semantics { if (loading && loadingDescription != null) stateDescription = loadingDescription }
                .clip(shape)
                .background(shown.container)
                .then(if (shown.border.alpha > 0f) Modifier.border(borderWidth, shown.border, shape) else Modifier)
                .defaultMinSize(minHeight = height)
                .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(ButtonDefaults.iconSpacing, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides shown.content) {
            if (loading) loadingIndicator(shown.content) else leading?.invoke()
            Text(text, Modifier.weight(1f, fill = false), textStyle, maxLines = labelMaxLines(), overflow = TextOverflow.Ellipsis)
            trailing?.invoke()
        }
    }
}

@Composable
private fun Spinner(color: Color) {
    val phase = rememberLoopPhase(900)
    Box(
        Modifier.size(14.dp).drawBehind {
            val stroke = 2.dp.toPx()
            rotate(phase.value * 360f) {
                drawArc(
                    color = color,
                    startAngle = 0f,
                    sweepAngle = 270f,
                    useCenter = false,
                    topLeft = Offset(stroke / 2, stroke / 2),
                    size = Size(size.width - stroke, size.height - stroke),
                    style = Stroke(stroke, cap = StrokeCap.Round),
                )
            }
        },
    )
}
