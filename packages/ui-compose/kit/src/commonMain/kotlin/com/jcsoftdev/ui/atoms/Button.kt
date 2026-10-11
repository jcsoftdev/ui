package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.theme.ThemeColors
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiSizes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

public enum class ButtonVariant { Primary, Secondary, Ghost, Danger }

public enum class ButtonSize { Sm, Md }

internal fun ButtonVariant.container(c: ThemeColors): Color =
    when (this) {
        ButtonVariant.Primary -> c.accent
        ButtonVariant.Secondary -> c.surface
        ButtonVariant.Ghost -> Color.Transparent
        ButtonVariant.Danger -> c.dangerSoft
    }

internal fun ButtonVariant.content(c: ThemeColors): Color =
    when (this) {
        ButtonVariant.Primary -> c.onAccent
        ButtonVariant.Secondary -> c.ink
        ButtonVariant.Ghost -> c.ink2
        ButtonVariant.Danger -> c.danger
    }

internal fun ButtonSize.height(): Dp = if (this == ButtonSize.Sm) UiSizes.controlHeightSm else UiSizes.controlHeight

private val SmallLabel = UiTypography.control.copy(fontSize = 12.5.sp)
private val PrimaryWeight = FontWeight.Bold

/**
 * Action button. [loading] swaps [leading] for a spinner and ignores taps without dimming; [loadingDescription]
 * (already localized) is announced as the state. The visual height is 30/36dp, the touch target is at least 48dp.
 */
@Composable
public fun Button(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Secondary,
    size: ButtonSize = ButtonSize.Md,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = UiTheme.colors
    val source = remember { MutableInteractionSource() }
    val contentColor = variant.content(colors)
    val base = if (size == ButtonSize.Sm) SmallLabel else UiTypography.control
    val style = if (variant == ButtonVariant.Primary) base.copy(fontWeight = PrimaryWeight) else base
    Row(
        modifier =
            modifier
                .pressableTarget(onClick, enabled && !loading, Role.Button, source)
                .semantics { if (loading && loadingDescription != null) stateDescription = loadingDescription }
                .graphicsLayer { alpha = if (enabled) 1f else DISABLED_ALPHA }
                .clip(UiShapes.control)
                .background(variant.container(colors))
                .then(if (variant == ButtonVariant.Secondary) Modifier.border(1.dp, colors.lineControl, UiShapes.control) else Modifier)
                .defaultMinSize(minHeight = size.height())
                .padding(horizontal = if (size == ButtonSize.Sm) 12.dp else UiSizes.space14),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides contentColor) {
            if (loading) Spinner(contentColor) else leading?.invoke()
            Text(text, Modifier.weight(1f, fill = false), style, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
