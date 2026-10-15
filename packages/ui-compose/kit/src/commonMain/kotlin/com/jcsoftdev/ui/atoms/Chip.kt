package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.UiTheme

public enum class ChipTone { Neutral, Info, Danger, Warning, Success, Accent, Solid, Outline }

public enum class LedStatus { Success, Warning, Danger, Idle }

/** Colors of a [Chip]: fill, content and an optional outline. */
@Immutable
public class ChipColors(
    public val container: Color,
    public val content: Color,
    public val border: Color = Color.Transparent,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        content: Color = this.content,
        border: Color = this.border,
    ): ChipColors = ChipColors(container, content, border)
}

/** Default colors, shape and metrics of [Chip]. */
public object ChipDefaults {
    /** The colors of [tone] in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(tone: ChipTone = ChipTone.Neutral): ChipColors {
        val c = UiTheme.colors
        return when (tone) {
            ChipTone.Neutral -> ChipColors(c.surface2, c.ink2)
            ChipTone.Info -> ChipColors(c.infoSoft, c.info)
            ChipTone.Danger -> ChipColors(c.dangerSoft, c.danger)
            ChipTone.Warning -> ChipColors(c.warningSoft, c.warning)
            ChipTone.Success -> ChipColors(c.successSoft, c.success)
            ChipTone.Accent -> ChipColors(c.accentSoft, c.accentInk)
            ChipTone.Solid -> ChipColors(c.accent, c.onAccent)
            ChipTone.Outline -> ChipColors(Color.Transparent, c.ink2, c.lineStrong)
        }
    }

    /** A full pill, or the small chip radius when [square]. */
    @Composable
    @ReadOnlyComposable
    public fun shape(square: Boolean = false): Shape = if (square) UiTheme.shapes.chip else UiTheme.shapes.pill

    /** Minimum visual height. */
    public val minHeight: Dp = 24.dp

    /** Padding around the label row. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 10.dp)

    /** Gap between the slots and the label. */
    public val spacing: Dp = 6.dp

    /** Label style; the theme `chipText`. */
    public val textStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.chipText
}

/** Label chip. [square] uses the small chip radius instead of a full pill. A non-null [onRemove] appends a remove button named [removeLabel] with a 48dp touch target. Restyle with [colors], [shape], [contentPadding] and [textStyle] (see [ChipDefaults]). */
@Composable
public fun Chip(
    text: String,
    modifier: Modifier = Modifier,
    tone: ChipTone = ChipTone.Neutral,
    square: Boolean = false,
    colors: ChipColors = ChipDefaults.colors(tone),
    shape: Shape = ChipDefaults.shape(square),
    contentPadding: PaddingValues = ChipDefaults.contentPadding,
    textStyle: TextStyle = ChipDefaults.textStyle,
    onRemove: (() -> Unit)? = null,
    removeLabel: String = UiTheme.strings.remove,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val borderWidth = UiTheme.sizes.borderWidth
    Row(
        modifier =
            modifier
                .clip(shape)
                .background(colors.container)
                .then(if (colors.border.alpha > 0f) Modifier.border(borderWidth, colors.border, shape) else Modifier)
                .defaultMinSize(minHeight = ChipDefaults.minHeight)
                .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(ChipDefaults.spacing),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides colors.content) {
            leading?.invoke()
            Text(text, Modifier.weight(1f, fill = false), textStyle, maxLines = 1, overflow = TextOverflow.Ellipsis)
            trailing?.invoke()
            if (onRemove != null) RemoveGlyph(onRemove, removeLabel)
        }
    }
}

@Composable
private fun RemoveGlyph(
    onRemove: () -> Unit,
    label: String,
) {
    val source = remember { MutableInteractionSource() }
    val color = LocalContentColor.current
    Box(
        Modifier
            .pressableTarget(onRemove, true, Role.Button, source)
            .semantics { contentDescription = label }
            .size(RemoveGlyphSize)
            .drawBehind {
                val stroke = 1.5.dp.toPx()
                val inset = size.width * 0.28f
                drawLine(color, Offset(inset, inset), Offset(size.width - inset, size.height - inset), stroke, StrokeCap.Round)
                drawLine(color, Offset(size.width - inset, inset), Offset(inset, size.height - inset), stroke, StrokeCap.Round)
            },
    )
}

private val RemoveGlyphSize = 16.dp

/** Colors of a [StatusPill]: fill, outline, label and the status dot. */
@Immutable
public class StatusPillColors(
    public val container: Color,
    public val border: Color,
    public val content: Color,
    public val led: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        container: Color = this.container,
        border: Color = this.border,
        content: Color = this.content,
        led: Color = this.led,
    ): StatusPillColors = StatusPillColors(container, border, content, led)
}

/** Default colors, shape and metrics of [StatusPill]. */
public object StatusPillDefaults {
    /** The colors for [status] in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(status: LedStatus): StatusPillColors {
        val c = UiTheme.colors
        val led =
            when (status) {
                LedStatus.Success -> c.success
                LedStatus.Warning -> c.warning
                LedStatus.Danger -> c.danger
                LedStatus.Idle -> c.ink3
            }
        return StatusPillColors(c.surface, c.hair, c.ink2, led)
    }

    /** Pill shape. */
    public val shape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.pill

    /** Diameter of the status dot. */
    public val ledSize: Dp = 7.dp

    /** Padding around the dot and label. */
    public val contentPadding: PaddingValues = PaddingValues(horizontal = 10.dp)
}

/** Pill with a status dot and its label. Without [onSelect] it is decorative and not focusable. */
@Composable
public fun StatusPill(
    status: LedStatus,
    label: String,
    modifier: Modifier = Modifier,
    colors: StatusPillColors = StatusPillDefaults.colors(status),
    shape: Shape = StatusPillDefaults.shape,
    contentPadding: PaddingValues = StatusPillDefaults.contentPadding,
    textStyle: TextStyle = ChipDefaults.textStyle,
    onSelect: (() -> Unit)? = null,
) {
    val source = remember { MutableInteractionSource() }
    val sizes = UiTheme.sizes
    Row(
        modifier =
            modifier
                .then(if (onSelect != null) Modifier.pressableTarget(onSelect, true, Role.Button, source) else Modifier)
                .clip(shape)
                .background(colors.container)
                .border(sizes.borderWidth, colors.border, shape)
                .defaultMinSize(minHeight = sizes.controlHeightSm)
                .padding(contentPadding),
        horizontalArrangement = Arrangement.spacedBy(ChipDefaults.spacing),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(StatusPillDefaults.ledSize).background(colors.led, CircleShape))
        Text(label, style = textStyle, color = colors.content, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
